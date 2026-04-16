"""Skills 服务层：通过 docker exec 在容器内读写 SKILL.md 文件。

约定：
- 每个 agent 容器内有一个技能目录（默认 `/root/.claude/skills`，
  可被容器 label `hermes.skillsDir` 覆盖，也可被全局 env `HERMES_SKILLS_DIR` 覆盖）
- 每个技能位于 `<skillsDir>/<name>/SKILL.md`
- SKILL.md 使用 YAML frontmatter 描述元信息：
    ---
    name: tweet-writer
    description: 撰写推文
    version: 2
    ---
    <Markdown 正文>

技能 ID = base64url(agentId:filePath)，前端视为不透明字符串。
"""
from __future__ import annotations

import base64
import logging
import shlex
from datetime import datetime, timezone
from typing import Optional

import yaml
from docker.errors import APIError, DockerException
from docker.models.containers import Container

from ..config import settings
from ..docker_client import DockerUnavailableError, get_client
from ..schemas.skill import SKILL_NAME_RE, Skill
from .agents import (
    AgentNotFoundError,
    AgentOperationError,
    _api_error_message,
    _find_container,
    _is_hermes_container,
)

logger = logging.getLogger(__name__)


# ---------- 领域异常 ----------


class SkillNotFoundError(LookupError):
    """技能不存在。"""


class SkillValidationError(ValueError):
    """技能请求不合法（名称、路径等）。"""


# ---------- ID 编解码 ----------


def _encode_skill_id(agent_id: str, file_path: str) -> str:
    raw = f"{agent_id}\x1f{file_path}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _decode_skill_id(skill_id: str) -> tuple[str, str]:
    try:
        padding = "=" * (-len(skill_id) % 4)
        raw = base64.urlsafe_b64decode(skill_id + padding).decode("utf-8")
        agent_id, file_path = raw.split("\x1f", 1)
    except Exception as exc:
        raise SkillValidationError(f"非法的技能 ID: {skill_id}") from exc
    return agent_id, file_path


# ---------- 容器内操作（exec_run 包装）----------


def _require_running(container: Container) -> None:
    state = (container.attrs or {}).get("State", {}) or {}
    if state.get("Status") != "running" or state.get("Paused"):
        raise AgentOperationError(
            "容器未运行，无法读写技能文件；请先启动 agent"
        )


def _exec(container: Container, cmd: list[str]) -> tuple[int, bytes]:
    """执行命令并返回 (exit_code, bytes_output)。"""
    try:
        result = container.exec_run(cmd, demux=False)
    except APIError as exc:
        raise AgentOperationError(f"exec 失败: {_api_error_message(exc)}") from exc
    except DockerException as exc:
        raise AgentOperationError(f"exec 异常: {exc}") from exc
    output = result.output or b""
    if isinstance(output, tuple):
        output = (output[0] or b"") + (output[1] or b"")
    return result.exit_code or 0, output


def _get_skills_dir(container: Container) -> str:
    labels = container.labels or {}
    return (
        labels.get("hermes.skillsDir")
        or settings.hermes_skills_dir
    ).rstrip("/")


# ---------- Frontmatter 解析 / 构建 ----------


def _parse_frontmatter(content: str) -> dict:
    """解析 `---\\n...\\n---` YAML 头部；失败返回空 dict。"""
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    _, fm_text, _ = parts
    try:
        meta = yaml.safe_load(fm_text)
    except yaml.YAMLError:
        logger.warning("SKILL.md frontmatter 解析失败", exc_info=True)
        return {}
    return meta if isinstance(meta, dict) else {}


# ---------- 容器内文件读写 ----------


def _read_file(container: Container, path: str) -> Optional[str]:
    """读取文件内容（utf-8）；不存在返回 None。"""
    _require_running(container)
    exit_code, output = _exec(container, ["cat", path])
    if exit_code != 0:
        return None
    try:
        return output.decode("utf-8")
    except UnicodeDecodeError:
        return output.decode("utf-8", errors="replace")


def _stat_mtime(container: Container, path: str) -> Optional[datetime]:
    """取文件 mtime（UTC）。"""
    exit_code, output = _exec(container, ["stat", "-c", "%Y", path])
    if exit_code != 0:
        return None
    try:
        ts = int(output.decode().strip())
    except (ValueError, UnicodeDecodeError):
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def _write_file(container: Container, path: str, content: str) -> None:
    """用 base64 管道安全写入容器内文件（避免 shell 注入）。"""
    _require_running(container)
    parent = "/".join(path.split("/")[:-1]) or "/"
    encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")
    # 路径已在入口校验，此处再 shlex.quote 双保险
    cmd = [
        "sh",
        "-c",
        f"mkdir -p {shlex.quote(parent)} && "
        f"printf %s {encoded} | base64 -d > {shlex.quote(path)}",
    ]
    exit_code, output = _exec(container, cmd)
    if exit_code != 0:
        raise AgentOperationError(
            f"写入失败 ({path}): exit={exit_code} {output.decode(errors='replace')[:200]}"
        )


def _delete_file(container: Container, path: str) -> None:
    _require_running(container)
    # 删文件，再尝试清理空的父目录（技能目录）
    parent = "/".join(path.split("/")[:-1])
    cmd = [
        "sh",
        "-c",
        f"rm -f {shlex.quote(path)} && rmdir {shlex.quote(parent)} 2>/dev/null || true",
    ]
    exit_code, _ = _exec(container, cmd)
    if exit_code != 0:
        raise AgentOperationError(f"删除失败: exit={exit_code}")


# ---------- 单条技能：文件 → Skill ----------


def _file_to_skill(
    container: Container,
    agent_id: str,
    file_path: str,
    content: Optional[str] = None,
) -> Skill:
    if content is None:
        content = _read_file(container, file_path)
        if content is None:
            raise SkillNotFoundError(file_path)

    meta = _parse_frontmatter(content)

    # name fallback: 父目录名
    dir_name = file_path.rstrip("/").split("/")[-2] if "/" in file_path else "skill"
    name = str(meta.get("name") or dir_name)
    description = str(meta.get("description") or "")
    try:
        version = int(meta.get("version") or 1)
    except (TypeError, ValueError):
        version = 1

    mtime = _stat_mtime(container, file_path) or datetime.now(timezone.utc)

    return Skill(
        id=_encode_skill_id(agent_id, file_path),
        agentId=agent_id,
        name=name,
        version=version,
        description=description,
        content=content,
        updatedAt=mtime.isoformat(),
        filePath=file_path,
    )


# ---------- 对外 API ----------


def list_skills(agent_id: Optional[str] = None) -> list[Skill]:
    """列出技能；传 agent_id 则只列该 agent。"""
    if agent_id:
        container = _find_container(agent_id)
        if container is None:
            raise AgentNotFoundError(agent_id)
        return _list_skills_in_container(container, agent_id)

    # 列出全部 agent 的技能
    client = get_client()
    try:
        containers = client.containers.list(all=True)
    except DockerException as exc:
        raise DockerUnavailableError(f"Docker 操作失败: {exc}") from exc

    result: list[Skill] = []
    for c in containers:
        if not _is_hermes_container(c):
            continue
        try:
            a_id = (c.labels or {}).get("hermes.id") or c.short_id or c.id[:12]
            result.extend(_list_skills_in_container(c, a_id))
        except AgentOperationError as exc:
            logger.warning("跳过 %s 的技能列表: %s", c.name, exc)
        except Exception:
            logger.exception("列出 %s 技能失败", c.name)
    return result


def _list_skills_in_container(container: Container, agent_id: str) -> list[Skill]:
    skills_dir = _get_skills_dir(container)

    # 容器未运行直接返回空列表（不抛错，体验更友好）
    state = (container.attrs or {}).get("State", {}) or {}
    if state.get("Status") != "running" or state.get("Paused"):
        return []

    exit_code, output = _exec(
        container,
        ["find", skills_dir, "-name", "SKILL.md", "-type", "f"],
    )
    if exit_code != 0:
        # 目录不存在等情况：不视为错误
        return []

    skills: list[Skill] = []
    for line in output.decode("utf-8", errors="replace").splitlines():
        path = line.strip()
        if not path:
            continue
        try:
            skills.append(_file_to_skill(container, agent_id, path))
        except Exception:
            logger.exception("解析 SKILL.md 失败: %s", path)
    # 按 name 排序便于前端展示
    skills.sort(key=lambda s: s.name.lower())
    return skills


def get_skill(skill_id: str) -> Skill:
    agent_id, file_path = _decode_skill_id(skill_id)
    container = _find_container(agent_id)
    if container is None:
        raise AgentNotFoundError(agent_id)
    return _file_to_skill(container, agent_id, file_path)


def create_skill(agent_id: str, name: str, content: str) -> Skill:
    if not SKILL_NAME_RE.match(name):
        raise SkillValidationError("技能名只允许字母、数字、下划线、短横线")

    container = _find_container(agent_id)
    if container is None:
        raise AgentNotFoundError(agent_id)

    skills_dir = _get_skills_dir(container)
    file_path = f"{skills_dir}/{name}/SKILL.md"

    # 冲突检查
    existing = _read_file(container, file_path)
    if existing is not None:
        raise SkillValidationError(f"技能已存在: {name}")

    _write_file(container, file_path, content)
    return _file_to_skill(container, agent_id, file_path, content=content)


def update_skill(skill_id: str, content: str) -> Skill:
    agent_id, file_path = _decode_skill_id(skill_id)
    container = _find_container(agent_id)
    if container is None:
        raise AgentNotFoundError(agent_id)

    # 确认原文件存在再更新（避免通过 ID 伪造凭空写路径）
    if _read_file(container, file_path) is None:
        raise SkillNotFoundError(file_path)

    _write_file(container, file_path, content)
    return _file_to_skill(container, agent_id, file_path, content=content)


def delete_skill(skill_id: str) -> None:
    agent_id, file_path = _decode_skill_id(skill_id)
    container = _find_container(agent_id)
    if container is None:
        raise AgentNotFoundError(agent_id)

    if _read_file(container, file_path) is None:
        raise SkillNotFoundError(file_path)

    _delete_file(container, file_path)

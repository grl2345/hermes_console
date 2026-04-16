"""Agent 创建服务：init_agent.sh 的 Python 等价实现。

与原脚本的关键差异：
- **容器创建时就打好 `hermes.*` labels**，不需要事后手工补 label
- 直接用 docker-py 编排（不依赖 docker compose CLI）
- 失败时自动回滚（删容器 + 删宿主目录）
- 可由前端表单 / curl 直接调用，替代 SSH + bash

与原脚本对齐的行为：
- 宿主目录：`<HERMES_AGENT_ROOT>/hermes_agent_<name>/`
- 容器名：`hermes-<name>`
- 镜像：`nousresearch/hermes-agent:latest`（可由 HERMES_AGENT_IMAGE 覆盖）
- 挂载：工作目录、/opt/data、.env、/srv/agents/collab
- `.env` chmod 600 + chown 10000:10000
- OpenRouter key 自动补齐
- 容器起来后通过 hermes CLI 写 config.yaml（model.default / provider / base_url
  + auxiliary.compression.*）
- 配置好后 restart 容器
"""
from __future__ import annotations

import logging
import os
import shutil
import time
from pathlib import Path
from typing import Optional

from docker.errors import APIError, DockerException, NotFound

from ..config import settings
from ..docker_client import DockerUnavailableError, get_client
from ..schemas.agent import Agent, AgentCreateRequest
from .agents import _container_to_agent

logger = logging.getLogger(__name__)

# 等待容器进入 running 的最大次数（× 0.5s）
_WAIT_RUNNING_ATTEMPTS = 40

HERMES_CLI = "/opt/hermes/.venv/bin/hermes"


# ---------- 领域异常 ----------


class AgentAlreadyExistsError(ValueError):
    """同名容器已存在。"""


class AgentCreationError(RuntimeError):
    """创建过程中发生不可恢复的错误。"""


# ---------- 辅助 ----------


def _container_name_for(agent_name: str) -> str:
    return f"hermes-{agent_name}"


def _base_dir_for(agent_name: str) -> Path:
    return Path(settings.hermes_agent_root) / f"hermes_agent_{agent_name}"


def _chown_recursively(path: Path, uid: int, gid: int) -> None:
    """尽力 chown；权限不足时静默跳过（但会 warning）。"""
    try:
        os.chown(path, uid, gid)
    except (PermissionError, OSError) as exc:
        logger.warning("chown %s 失败（可能非 root 运行）: %s", path, exc)
        return
    if path.is_dir():
        for root, dirs, files in os.walk(path):
            for name in dirs + files:
                p = Path(root) / name
                try:
                    os.chown(p, uid, gid)
                except (PermissionError, OSError):
                    pass


def _should_inject_openrouter_key(req: AgentCreateRequest) -> bool:
    if req.openaiApiKey.startswith("sk-or-"):
        return True
    for url in (req.openaiBaseUrl, req.modelBaseUrl):
        if url and "openrouter.ai" in url:
            return True
    return False


def _write_env_file(path: Path, req: AgentCreateRequest, work_dir: str) -> None:
    """按 init_agent.sh 第 4 步生成 `.env`，并设置权限。"""
    lines: list[str] = [
        "# 由 hermes_console_remote 自动生成；勿手工编辑",
        f"TELEGRAM_BOT_TOKEN={req.telegramBotToken}",
        f"OPENAI_API_KEY={req.openaiApiKey}",
    ]
    if _should_inject_openrouter_key(req):
        lines.append(f"OPENROUTER_API_KEY={req.openaiApiKey}")
    if req.openaiBaseUrl:
        lines.append(f"OPENAI_BASE_URL={req.openaiBaseUrl}")
    lines.extend(
        [
            f"GATEWAY_ALLOW_ALL_USERS={'true' if req.gatewayAllowAllUsers else 'false'}",
            f"MESSAGING_CWD={work_dir}",
            f"TERMINAL_CWD={work_dir}",
            "TERMINAL_ENV=local",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")
    path.chmod(0o600)
    _chown_recursively(path, settings.hermes_container_uid, settings.hermes_container_gid)


def _wait_running(container, timeout_s: float = 20.0) -> None:
    """轮询等待容器进入 running 状态。"""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            container.reload()
        except DockerException:
            pass
        state = (container.attrs or {}).get("State", {}) or {}
        if state.get("Status") == "running" and not state.get("Paused"):
            return
        time.sleep(0.5)
    raise AgentCreationError("容器启动超时（>20s 未进入 running）")


def _build_labels(req: AgentCreateRequest) -> dict[str, str]:
    """生成 hermes.* labels；让容器一出生就能被后端识别。"""
    display_name = req.displayName or req.agentName
    short_name = (req.shortName or display_name[:1] or req.agentName[:1]).strip()
    role = req.role or "Agent"

    labels = {
        settings.hermes_label_key: settings.hermes_label_value,
        "hermes.id": req.agentName,
        "hermes.name": display_name,
        "hermes.shortName": short_name,
        "hermes.role": role,
        "hermes.level": req.level,
        "hermes.model": req.apiModel,
    }
    if req.reportsTo:
        labels["hermes.reportsTo"] = req.reportsTo
    if req.avatarColor:
        labels["hermes.avatarColor"] = req.avatarColor
    return labels


def _apply_runtime_config(container, req: AgentCreateRequest) -> list[str]:
    """按 init_agent.sh 第 5.5 步通过 hermes CLI 写 config.yaml。

    返回失败的命令列表（用于 warning）；不直接抛错——config 缺失时容器仍能跑。
    """
    config_base_url = req.modelBaseUrl or req.openaiBaseUrl
    cmds: list[list[str]] = [
        [HERMES_CLI, "config", "set", "model.default", req.apiModel],
    ]
    if config_base_url:
        cmds.append([HERMES_CLI, "config", "set", "model.provider", "custom"])
        cmds.append([HERMES_CLI, "config", "set", "model.base_url", config_base_url])
    else:
        cmds.append([HERMES_CLI, "config", "set", "model.provider", "auto"])

    cmds.append([HERMES_CLI, "config", "set", "auxiliary.compression.provider", "main"])
    cmds.append([HERMES_CLI, "config", "set", "auxiliary.compression.model", req.apiModel])
    if config_base_url:
        cmds.append([HERMES_CLI, "config", "set", "auxiliary.compression.base_url", config_base_url])

    failed: list[str] = []
    for cmd in cmds:
        try:
            result = container.exec_run(cmd, user="hermes", demux=False)
        except DockerException as exc:
            failed.append(f"{' '.join(cmd)}: {exc}")
            continue
        if (result.exit_code or 0) != 0:
            output = (result.output or b"").decode("utf-8", errors="replace")
            failed.append(f"{' '.join(cmd)} (exit={result.exit_code}): {output[:200]}")
    return failed


def _rollback(container_name: str, base_dir: Path) -> None:
    """最佳努力清理；任何子步失败都继续。"""
    client = None
    try:
        client = get_client()
    except Exception:  # noqa: BLE001
        pass
    if client is not None:
        try:
            c = client.containers.get(container_name)
            try:
                c.stop(timeout=5)
            except Exception:  # noqa: BLE001
                pass
            try:
                c.remove(force=True)
            except Exception:  # noqa: BLE001
                pass
        except NotFound:
            pass
        except Exception:  # noqa: BLE001
            logger.exception("回滚：查找容器 %s 失败", container_name)
    try:
        shutil.rmtree(base_dir, ignore_errors=True)
    except Exception:  # noqa: BLE001
        logger.exception("回滚：删除目录 %s 失败", base_dir)


# ---------- 主流程 ----------


def create_agent(req: AgentCreateRequest) -> Agent:
    """完整创建流程：建目录 → 写 .env → docker run → 等待 → 配置 → 重启。"""
    container_name = _container_name_for(req.agentName)
    base_dir = _base_dir_for(req.agentName)
    data_dir = base_dir / "data"
    work_dir = f"/workspace/{req.agentName}"

    client = get_client()

    # 1) 冲突检查
    try:
        client.containers.get(container_name)
        raise AgentAlreadyExistsError(f"容器 {container_name} 已存在")
    except NotFound:
        pass
    if base_dir.exists():
        raise AgentAlreadyExistsError(f"宿主目录 {base_dir} 已存在")

    created_container_name: Optional[str] = None
    try:
        # 2) 建目录
        data_dir.mkdir(parents=True, exist_ok=False)
        _chown_recursively(base_dir, settings.hermes_container_uid, settings.hermes_container_gid)

        # 3) 写 .env
        env_path = data_dir / ".env"
        _write_env_file(env_path, req, work_dir)

        # 4) 构造 docker run 参数
        labels = _build_labels(req)
        env_dict: dict[str, str] = {
            "TZ": "Asia/Shanghai",
            "HTTP_PROXY": "",
            "HTTPS_PROXY": "",
            "NO_PROXY": "localhost,127.0.0.1,host.docker.internal",
            "MESSAGING_CWD": work_dir,
            "TERMINAL_CWD": work_dir,
            "TERMINAL_ENV": "local",
        }
        if req.openaiBaseUrl:
            env_dict["OPENAI_BASE_URL"] = req.openaiBaseUrl

        volumes = {
            str(base_dir): {"bind": work_dir, "mode": "rw"},
            str(data_dir): {"bind": "/opt/data", "mode": "rw"},
            str(env_path): {"bind": "/opt/data/.env", "mode": "rw"},
            "/srv/agents/collab": {"bind": "/workspace/collab", "mode": "rw"},
        }

        # 5) 启动容器
        try:
            container = client.containers.run(
                settings.hermes_agent_image,
                command=["gateway", "run"],
                name=container_name,
                detach=True,
                environment=env_dict,
                volumes=volumes,
                working_dir=work_dir,
                labels=labels,
                shm_size="1g",
                restart_policy={"Name": "unless-stopped"},
            )
        except APIError as exc:
            raise AgentCreationError(f"docker run 失败: {exc.explanation or exc}") from exc
        created_container_name = container_name

        # 6) 等待 running
        _wait_running(container)

        # 7) 容器起来后 chown /opt/data（entrypoint 可能以 root 落文件）
        _chown_recursively(data_dir, settings.hermes_container_uid, settings.hermes_container_gid)

        # 8) 写 hermes 配置
        failed_cfg = _apply_runtime_config(container, req)
        if failed_cfg:
            logger.warning("部分 config 设置失败 (agent=%s):\n%s", req.agentName, "\n".join(failed_cfg))

        # 9) restart 让配置生效
        try:
            container.restart(timeout=10)
        except DockerException as exc:
            logger.warning("restart 失败（继续）：%s", exc)

        _wait_running(container)
        _chown_recursively(data_dir, settings.hermes_container_uid, settings.hermes_container_gid)

        # 10) 最终状态
        container.reload()
        return _container_to_agent(container)

    except Exception:
        if created_container_name is not None or base_dir.exists():
            logger.info("创建失败，开始回滚 agent=%s", req.agentName)
            _rollback(container_name, base_dir)
        raise

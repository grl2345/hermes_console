"""Agent 服务层：从 Docker 容器提取 Agent 元信息。

阶段 2 实现只读列表与详情。阶段 3 之后扩展启停/统计等。
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from docker.errors import APIError, DockerException, NotFound
from docker.models.containers import Container

from ..config import settings
from ..docker_client import DockerUnavailableError, get_client
from ..schemas.agent import Agent, AgentLevel, AgentStatus

logger = logging.getLogger(__name__)


class AgentNotFoundError(LookupError):
    """找不到对应的 Hermes agent。"""


class AgentOperationError(RuntimeError):
    """Docker 操作失败（容器层错误，非连接层）。"""

# 头像默认色板（无 hermes.avatarColor 时按 name 哈希派生）
_AVATAR_PALETTE = [
    "#3B82F6",  # blue
    "#10B981",  # emerald
    "#F59E0B",  # amber
    "#EF4444",  # red
    "#8B5CF6",  # violet
    "#EC4899",  # pink
    "#14B8A6",  # teal
    "#F97316",  # orange
]

_VALID_LEVELS: set[AgentLevel] = {"ceo", "director", "staff"}


# ---------- 识别 ----------

def _is_hermes_container(container: Container) -> bool:
    """判断容器是否是 Hermes agent。"""
    labels = container.labels or {}
    key, expected = settings.hermes_label_key, settings.hermes_label_value
    if labels.get(key) == expected:
        return True
    prefix = settings.hermes_name_prefix
    if prefix and (container.name or "").startswith(prefix):
        return True
    return False


# ---------- 辅助 ----------

def _derive_avatar_color(name: str) -> str:
    h = sum(ord(c) for c in name) if name else 0
    return _AVATAR_PALETTE[h % len(_AVATAR_PALETTE)]


def _normalize_level(raw: Optional[str]) -> AgentLevel:
    if raw and raw.lower() in _VALID_LEVELS:
        return raw.lower()  # type: ignore[return-value]
    return "staff"


def _parse_docker_datetime(value: Optional[str]) -> Optional[datetime]:
    """解析 Docker 返回的 ISO-like 时间；Docker 有纳秒精度前端用不到，裁掉。"""
    if not value or value.startswith("0001-01-01"):
        return None
    # Docker: "2024-09-01T12:34:56.123456789Z"
    trimmed = value.replace("Z", "+00:00")
    # 纳秒 → 微秒
    if "." in trimmed:
        head, tail = trimmed.split(".", 1)
        frac, tz = tail[:-6], tail[-6:]
        frac = (frac + "000000")[:6]
        trimmed = f"{head}.{frac}{tz}"
    try:
        return datetime.fromisoformat(trimmed)
    except ValueError:
        return None


def _humanize_uptime(started_at: Optional[datetime]) -> str:
    if started_at is None:
        return "-"
    delta = datetime.now(timezone.utc) - started_at
    total_seconds = int(delta.total_seconds())
    if total_seconds < 0:
        return "-"
    days, rem = divmod(total_seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, seconds = divmod(rem, 60)
    if days:
        return f"{days}d {hours}h"
    if hours:
        return f"{hours}h {minutes}m"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def _derive_status(state: dict) -> AgentStatus:
    """阶段 2 只区分 online / offline；busy 状态阶段 6 再填。"""
    status = (state or {}).get("Status", "")
    if status == "running" and not (state or {}).get("Paused"):
        return "online"
    return "offline"


# ---------- 主转换函数 ----------

def _container_to_agent(container: Container) -> Agent:
    """把 docker Container 对象转换成 Agent 模型。"""
    labels = container.labels or {}
    attrs = container.attrs or {}
    state = attrs.get("State", {}) or {}

    container_name = (container.name or "").lstrip("/")

    # 各字段：label > 容器元数据 > 兜底
    stable_id = labels.get("hermes.id") or container.short_id or container.id[:12]
    name = labels.get("hermes.name") or container_name or stable_id
    short_name = labels.get("hermes.shortName") or (name[:1] if name else "?")
    role = labels.get("hermes.role") or "Agent"
    level = _normalize_level(labels.get("hermes.level"))
    reports_to = labels.get("hermes.reportsTo") or None
    model = labels.get("hermes.model") or "—"
    avatar_color = labels.get("hermes.avatarColor") or _derive_avatar_color(name)
    # 校验 avatarColor 格式，非法则回退
    if not (isinstance(avatar_color, str) and len(avatar_color) == 7 and avatar_color.startswith("#")):
        avatar_color = _derive_avatar_color(name)

    status = _derive_status(state)
    started_at = _parse_docker_datetime(state.get("StartedAt"))
    finished_at = _parse_docker_datetime(state.get("FinishedAt"))
    uptime = _humanize_uptime(started_at) if status == "online" else "-"

    error_message = state.get("Error") or None
    stopped_at_iso = finished_at.isoformat() if finished_at and status == "offline" else None

    return Agent(
        id=stable_id,
        name=name,
        shortName=short_name,
        role=role,
        model=model,
        containerId=container.id or "",
        status=status,
        uptime=uptime,
        reportsTo=reports_to,
        level=level,
        avatarColor=avatar_color,
        errorMessage=error_message,
        stoppedAt=stopped_at_iso,
    )


# ---------- 对外 API ----------

def list_agents() -> list[Agent]:
    """扫描所有容器（含停止的），过滤出 Hermes agent 后转换。"""
    try:
        client = get_client()
    except DockerUnavailableError as exc:
        logger.error("Docker 不可用：%s", exc)
        raise

    try:
        containers = client.containers.list(all=True)
    except DockerException as exc:
        logger.exception("列出容器失败")
        raise DockerUnavailableError(f"Docker 操作失败: {exc}") from exc

    agents: list[Agent] = []
    for c in containers:
        if not _is_hermes_container(c):
            continue
        try:
            agents.append(_container_to_agent(c))
        except Exception:
            # 单个容器解析失败不影响整体列表
            logger.exception("解析容器 %s 失败，已跳过", c.id)
    # 按 level 再按 name 稳定排序，方便前端展示
    level_order = {"ceo": 0, "director": 1, "staff": 2}
    agents.sort(key=lambda a: (level_order.get(a.level, 9), a.name))
    return agents


def _find_container(agent_id: str) -> Optional[Container]:
    """按稳定 id / 容器 id / 容器名定位容器；仅返回被判定为 Hermes agent 的容器。"""
    client = get_client()

    # 1) 优先按 label hermes.id 精确匹配
    try:
        matched = client.containers.list(
            all=True,
            filters={"label": f"hermes.id={agent_id}"},
        )
        for c in matched:
            if _is_hermes_container(c):
                return c
    except DockerException:
        logger.exception("按 label 查找失败")

    # 2) 回退：按容器 id / name
    try:
        container = client.containers.get(agent_id)
        if _is_hermes_container(container):
            return container
    except NotFound:
        pass
    except DockerException:
        logger.exception("按 id/name 查找失败")

    return None


def get_agent(agent_id: str) -> Optional[Agent]:
    """按稳定 id / 容器 id / 容器名 查找单个 Agent。"""
    container = _find_container(agent_id)
    return _container_to_agent(container) if container is not None else None


# ---------- 生命周期控制（阶段 3） ----------

# stop 的 SIGTERM 宽限期（秒）。超过后发 SIGKILL。
_STOP_TIMEOUT = 10


def _api_error_message(exc: APIError) -> str:
    """安全地提取 docker APIError 的可读信息，避免其 __str__ 因缺字段抛异常。"""
    explanation = getattr(exc, "explanation", None)
    if explanation:
        return str(explanation)
    try:
        return str(exc)
    except Exception:  # noqa: BLE001
        return "未知错误"


def _refresh_and_return(container: Container) -> Agent:
    """执行动作后重新加载容器状态并返回 Agent。"""
    try:
        container.reload()
    except DockerException:
        logger.exception("reload 容器状态失败（忽略，继续返回）")
    return _container_to_agent(container)


def start_agent(agent_id: str) -> Agent:
    """启动容器。若容器已在运行则视为成功（幂等）。"""
    container = _find_container(agent_id)
    if container is None:
        raise AgentNotFoundError(agent_id)

    container.reload()
    state = container.attrs.get("State", {}) or {}
    if state.get("Status") == "running" and not state.get("Paused"):
        logger.info("start: %s 已在运行，幂等成功", agent_id)
        return _container_to_agent(container)

    try:
        container.start()
    except APIError as exc:
        # 304: 已启动；视为成功
        if getattr(exc, "status_code", None) == 304:
            logger.info("start: %s 已启动（304）", agent_id)
        else:
            logger.exception("start 失败")
            raise AgentOperationError(f"启动失败: {_api_error_message(exc)}") from exc
    except DockerException as exc:
        logger.exception("start 异常")
        raise AgentOperationError(f"启动失败: {exc}") from exc

    return _refresh_and_return(container)


def stop_agent(agent_id: str) -> Agent:
    """停止容器。若容器已停止则视为成功（幂等）。"""
    container = _find_container(agent_id)
    if container is None:
        raise AgentNotFoundError(agent_id)

    container.reload()
    state = container.attrs.get("State", {}) or {}
    if state.get("Status") not in ("running", "restarting") or state.get("Paused"):
        logger.info("stop: %s 已非运行态，幂等成功", agent_id)
        return _container_to_agent(container)

    try:
        container.stop(timeout=_STOP_TIMEOUT)
    except APIError as exc:
        if getattr(exc, "status_code", None) == 304:
            logger.info("stop: %s 已停止（304）", agent_id)
        else:
            logger.exception("stop 失败")
            raise AgentOperationError(f"停止失败: {_api_error_message(exc)}") from exc
    except DockerException as exc:
        logger.exception("stop 异常")
        raise AgentOperationError(f"停止失败: {exc}") from exc

    return _refresh_and_return(container)


def restart_agent(agent_id: str) -> Agent:
    """重启容器。非运行状态的容器也会被拉起。"""
    container = _find_container(agent_id)
    if container is None:
        raise AgentNotFoundError(agent_id)

    try:
        container.restart(timeout=_STOP_TIMEOUT)
    except DockerException as exc:
        logger.exception("restart 异常")
        raise AgentOperationError(f"重启失败: {exc}") from exc

    return _refresh_and_return(container)

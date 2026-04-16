"""Task 服务层：内存任务库 + 后台执行器。

职责：
- 外部（阶段 7 的 scheduler / 前端重试按钮 / 未来主 agent 触发）调用 `trigger_task()`
  创建一条任务记录并启动后台线程执行 `docker exec <container> <command>`
- 进度/结果写回任务记录
- 提供查询 / 过滤接口供 /tasks 路由使用

非目标（明确不做）：
- 不追踪 Hermes agent 内部自发行为（如处理 Telegram 消息）—— 那需要 Hermes
  自己上报或暴露 API；在现有条件下做不到。
- 重启即丢失；存储上限 1000 条，FIFO 淘汰。
"""
from __future__ import annotations

import logging
import threading
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from docker.errors import DockerException

from ..schemas.task import Task, TaskStatus
from .agents import (
    AgentNotFoundError,
    AgentOperationError,
    _api_error_message,
    _find_container,
)

logger = logging.getLogger(__name__)

# 任务库上限；超过后淘汰最老
_MAX_TASKS = 1000
# 单个任务 stdout+stderr 保留上限（字节），防爆内存
_MAX_OUTPUT_BYTES = 64 * 1024


# ---------- 领域异常 ----------


class TaskNotFoundError(LookupError):
    """任务不存在。"""


# ---------- 内部记录 ----------


@dataclass
class TaskRecord:
    id: str
    agent_id: str
    name: str
    command: list[str]          # 内部字段，不对外
    source: str                 # manual / scheduled / retry / ...
    status: TaskStatus
    started_at: datetime
    finished_at: Optional[datetime] = None
    exit_code: Optional[int] = None
    output: bytes = b""          # 截断的 stdout+stderr，内部调试
    error: Optional[str] = None
    tokens: Optional[int] = None
    # 预留给未来扩展
    extras: dict = field(default_factory=dict)


# ---------- 任务库 ----------


class TaskStore:
    """线程安全、有界的任务字典（按创建时间 FIFO 淘汰）。"""

    def __init__(self, max_size: int = _MAX_TASKS) -> None:
        self._lock = threading.RLock()
        self._tasks: "OrderedDict[str, TaskRecord]" = OrderedDict()
        self._max_size = max_size

    def add(self, task: TaskRecord) -> None:
        with self._lock:
            self._tasks[task.id] = task
            while len(self._tasks) > self._max_size:
                self._tasks.popitem(last=False)

    def update(self, task: TaskRecord) -> None:
        """任务已在库中，不改变顺序，仅更新字段。"""
        with self._lock:
            if task.id in self._tasks:
                self._tasks[task.id] = task

    def get(self, task_id: str) -> Optional[TaskRecord]:
        with self._lock:
            return self._tasks.get(task_id)

    def list(self, agent_id: Optional[str] = None) -> list[TaskRecord]:
        with self._lock:
            items = list(self._tasks.values())
        if agent_id is not None:
            items = [t for t in items if t.agent_id == agent_id]
        # 最新在前
        items.sort(key=lambda t: t.started_at, reverse=True)
        return items

    def clear(self) -> None:
        """仅用于测试。"""
        with self._lock:
            self._tasks.clear()


task_store = TaskStore()


# ---------- 格式化 ----------


def _humanize_duration(seconds: float) -> str:
    total = int(seconds)
    if total < 0:
        return "-"
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h {m}m"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


def _record_to_task(rec: TaskRecord) -> Task:
    duration: Optional[str] = None
    if rec.finished_at is not None:
        duration = _humanize_duration((rec.finished_at - rec.started_at).total_seconds())
    return Task(
        id=rec.id,
        agentId=rec.agent_id,
        name=rec.name,
        status=rec.status,
        source=rec.source,
        startedAt=rec.started_at.isoformat(),
        duration=duration,
        tokens=rec.tokens,
        error=rec.error,
    )


# ---------- 后台执行 ----------


def _run_task_body(task_id: str) -> None:
    """在后台线程里跑的执行函数。"""
    rec = task_store.get(task_id)
    if rec is None:
        logger.warning("_run_task_body: 任务 %s 丢失", task_id)
        return

    try:
        container = _find_container(rec.agent_id)
    except Exception as exc:  # noqa: BLE001
        rec.status = "failed"
        rec.error = f"查找容器失败: {exc}"
        rec.finished_at = datetime.now(timezone.utc)
        task_store.update(rec)
        return

    if container is None:
        rec.status = "failed"
        rec.error = f"未找到 agent: {rec.agent_id}"
        rec.finished_at = datetime.now(timezone.utc)
        task_store.update(rec)
        return

    # 状态 pending → running
    rec.status = "running"
    rec.started_at = datetime.now(timezone.utc)
    task_store.update(rec)

    try:
        # 验证容器运行
        state = (container.attrs or {}).get("State", {}) or {}
        if state.get("Status") != "running" or state.get("Paused"):
            raise AgentOperationError("容器未运行")

        result = container.exec_run(
            rec.command,
            demux=False,
            stream=False,
            stdout=True,
            stderr=True,
        )
    except DockerException as exc:
        rec.status = "failed"
        rec.error = f"Docker 执行失败: {_api_error_message(exc) if hasattr(exc, 'explanation') else exc}"
        rec.finished_at = datetime.now(timezone.utc)
        task_store.update(rec)
        return
    except AgentOperationError as exc:
        rec.status = "failed"
        rec.error = str(exc)
        rec.finished_at = datetime.now(timezone.utc)
        task_store.update(rec)
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("任务执行未知异常")
        rec.status = "failed"
        rec.error = f"未知异常: {exc}"
        rec.finished_at = datetime.now(timezone.utc)
        task_store.update(rec)
        return

    # 解析执行结果
    output = result.output or b""
    if isinstance(output, tuple):
        output = (output[0] or b"") + (output[1] or b"")
    if len(output) > _MAX_OUTPUT_BYTES:
        output = output[-_MAX_OUTPUT_BYTES:]

    rec.exit_code = result.exit_code or 0
    rec.output = output
    rec.finished_at = datetime.now(timezone.utc)
    if rec.exit_code == 0:
        rec.status = "success"
        rec.error = None
    else:
        rec.status = "failed"
        tail = output.decode("utf-8", errors="replace")[-400:]
        rec.error = f"退出码 {rec.exit_code}: {tail.strip()}" if tail.strip() else f"退出码 {rec.exit_code}"
    task_store.update(rec)


# ---------- 对外 API ----------


def trigger_task(
    *,
    agent_id: str,
    name: str,
    command: list[str],
    source: str = "manual",
) -> Task:
    """创建一条任务记录并**立刻返回**；实际执行在后台线程中进行。

    若 agent 不存在，抛 AgentNotFoundError。
    """
    # 前置校验：agent 必须存在（否则没必要入库）
    container = _find_container(agent_id)
    if container is None:
        raise AgentNotFoundError(agent_id)

    now = datetime.now(timezone.utc)
    rec = TaskRecord(
        id=f"task_{uuid.uuid4().hex[:12]}",
        agent_id=agent_id,
        name=name,
        command=list(command),
        source=source,
        status="pending",
        started_at=now,
    )
    task_store.add(rec)

    t = threading.Thread(target=_run_task_body, args=(rec.id,), daemon=True)
    t.start()

    return _record_to_task(rec)


def list_tasks(agent_id: Optional[str] = None) -> list[Task]:
    return [_record_to_task(r) for r in task_store.list(agent_id)]


def get_task(task_id: str) -> Task:
    rec = task_store.get(task_id)
    if rec is None:
        raise TaskNotFoundError(task_id)
    return _record_to_task(rec)


def retry_task(task_id: str) -> Task:
    """基于原任务的 command / name 重新触发；返回**新创建**的任务。"""
    original = task_store.get(task_id)
    if original is None:
        raise TaskNotFoundError(task_id)
    return trigger_task(
        agent_id=original.agent_id,
        name=original.name,
        command=original.command,
        source="retry",
    )

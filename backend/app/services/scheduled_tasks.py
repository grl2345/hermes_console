"""ScheduledTask 服务层：APScheduler + 内存存储。

cron 到点触发时：
1. 查对应 agent 的 `hermes.taskHandler` label（缺省用全局 HERMES_TASK_HANDLER）
2. 调用 phase 6 的 `trigger_task(agent_id, name, command=[handler, name], source="scheduled")`
3. 记录 last_run / last_task_id；前端 GET 时反查 task_store 得到最新 lastStatus

存储：内存字典（重启丢失，与当前"无持久化"约定一致）。
"""
from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from cron_descriptor import ExpressionDescriptor, Options

from ..config import settings
from ..schemas.scheduled_task import ScheduledTask
from .agents import AgentNotFoundError, _find_container
from .tasks import TaskNotFoundError, task_store as tasks_task_store, trigger_task

logger = logging.getLogger(__name__)


# ---------- 领域异常 ----------


class ScheduledTaskNotFoundError(LookupError):
    """定时任务不存在。"""


class ScheduledTaskValidationError(ValueError):
    """请求不合法（cron 非法等）。"""


# ---------- 内部记录 ----------


@dataclass
class ScheduledTaskRecord:
    id: str
    agent_id: str
    name: str
    cron: str
    cron_description: str
    enabled: bool = True
    last_run: Optional[datetime] = None
    last_task_id: Optional[str] = None


# ---------- 时区 ----------


def _get_tz() -> ZoneInfo:
    try:
        return ZoneInfo(settings.hermes_timezone)
    except Exception:  # noqa: BLE001
        logger.warning("非法时区 %s，回退 UTC", settings.hermes_timezone)
        return ZoneInfo("UTC")


# ---------- cron 描述 ----------


def _describe_cron(cron: str) -> str:
    """把 cron 表达式翻译成人话（zh_CN）。失败回退原表达式。"""
    try:
        options = Options()
        options.locale_code = "zh_CN"
        options.use_24hour_time_format = True
        return ExpressionDescriptor(cron, options).get_description()
    except Exception:  # noqa: BLE001
        return cron


def _validate_cron(cron: str) -> CronTrigger:
    """验证 cron 语法；失败抛 ValidationError。"""
    try:
        return CronTrigger.from_crontab(cron, timezone=_get_tz())
    except ValueError as exc:
        raise ScheduledTaskValidationError(f"非法 cron 表达式: {exc}") from exc


# ---------- 存储 ----------


class ScheduledTaskStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._items: dict[str, ScheduledTaskRecord] = {}

    def add(self, record: ScheduledTaskRecord) -> None:
        with self._lock:
            self._items[record.id] = record

    def get(self, rec_id: str) -> Optional[ScheduledTaskRecord]:
        with self._lock:
            return self._items.get(rec_id)

    def all(self) -> list[ScheduledTaskRecord]:
        with self._lock:
            return list(self._items.values())

    def remove(self, rec_id: str) -> bool:
        with self._lock:
            return self._items.pop(rec_id, None) is not None

    def clear(self) -> None:
        """仅用于测试。"""
        with self._lock:
            self._items.clear()


store = ScheduledTaskStore()


# ---------- 调度器单例 ----------


class _SchedulerHolder:
    """封装 BackgroundScheduler 以便单测里替换。"""

    def __init__(self) -> None:
        self._scheduler: Optional[BackgroundScheduler] = None
        self._lock = threading.Lock()

    def get(self) -> BackgroundScheduler:
        with self._lock:
            if self._scheduler is None:
                self._scheduler = BackgroundScheduler(timezone=_get_tz())
                self._scheduler.start()
                logger.info("APScheduler 启动，时区=%s", settings.hermes_timezone)
            return self._scheduler

    def shutdown(self) -> None:
        with self._lock:
            if self._scheduler is not None:
                try:
                    self._scheduler.shutdown(wait=False)
                except Exception:  # noqa: BLE001
                    logger.exception("scheduler 停止异常")
                self._scheduler = None


scheduler_holder = _SchedulerHolder()


def _job_id(record_id: str) -> str:
    return f"sched_{record_id}"


def _task_handler_for(container) -> str:
    labels = (container.labels or {}) if container else {}
    return labels.get("hermes.taskHandler") or settings.hermes_task_handler


# ---------- cron 到点的回调（后台线程中执行）----------


def _on_fire(record_id: str) -> None:
    record = store.get(record_id)
    if record is None:
        logger.warning("_on_fire: 记录 %s 已删除，跳过", record_id)
        return
    if not record.enabled:
        logger.info("_on_fire: %s 已禁用，跳过", record_id)
        return

    container = _find_container(record.agent_id)
    if container is None:
        logger.warning("_on_fire: agent %s 不存在", record.agent_id)
        record.last_run = datetime.now(_get_tz())
        store.add(record)
        return

    handler = _task_handler_for(container)
    try:
        task = trigger_task(
            agent_id=record.agent_id,
            name=record.name,
            command=[handler, record.name],
            source="scheduled",
        )
        record.last_run = datetime.now(_get_tz())
        record.last_task_id = task.id
        store.add(record)
        logger.info("cron 触发 %s → task %s", record.id, task.id)
    except AgentNotFoundError:
        logger.warning("触发时 agent 消失: %s", record.agent_id)
        record.last_run = datetime.now(_get_tz())
        store.add(record)


# ---------- 调度器管理 ----------


def _register(record: ScheduledTaskRecord) -> None:
    sched = scheduler_holder.get()
    trigger = _validate_cron(record.cron)
    sched.add_job(
        _on_fire,
        trigger,
        args=[record.id],
        id=_job_id(record.id),
        replace_existing=True,
    )


def _unregister(record_id: str) -> None:
    sched = scheduler_holder.get()
    try:
        sched.remove_job(_job_id(record_id))
    except Exception:  # noqa: BLE001
        pass


def _next_run(record: ScheduledTaskRecord) -> Optional[datetime]:
    if not record.enabled:
        return None
    sched = scheduler_holder.get()
    job = sched.get_job(_job_id(record.id))
    if job is None:
        return None
    return job.next_run_time


# ---------- 记录 → API ----------


def _record_to_api(rec: ScheduledTaskRecord) -> ScheduledTask:
    last_status = None
    if rec.last_task_id:
        t = tasks_task_store.get(rec.last_task_id)
        if t is not None:
            last_status = t.status

    nxt = _next_run(rec)
    return ScheduledTask(
        id=rec.id,
        agentId=rec.agent_id,
        name=rec.name,
        cron=rec.cron,
        cronDescription=rec.cron_description,
        nextRun=nxt.isoformat() if nxt else None,
        enabled=rec.enabled,
        lastRun=rec.last_run.isoformat() if rec.last_run else None,
        lastStatus=last_status,
    )


# ---------- 对外 API ----------


def list_scheduled(agent_id: Optional[str] = None) -> list[ScheduledTask]:
    records = store.all()
    if agent_id is not None:
        records = [r for r in records if r.agent_id == agent_id]
    # 按 name 稳定排序
    records.sort(key=lambda r: r.name.lower())
    return [_record_to_api(r) for r in records]


def get_scheduled(rec_id: str) -> ScheduledTask:
    rec = store.get(rec_id)
    if rec is None:
        raise ScheduledTaskNotFoundError(rec_id)
    return _record_to_api(rec)


def create_scheduled(
    *,
    agent_id: str,
    name: str,
    cron: str,
    cron_description: Optional[str] = None,
    enabled: bool = True,
) -> ScheduledTask:
    _validate_cron(cron)  # 早失败

    # 允许为不存在的 agent 建吗？保守起见要求 agent 存在。
    container = _find_container(agent_id)
    if container is None:
        raise AgentNotFoundError(agent_id)

    record = ScheduledTaskRecord(
        id=f"sched_{uuid.uuid4().hex[:12]}",
        agent_id=agent_id,
        name=name,
        cron=cron,
        cron_description=cron_description or _describe_cron(cron),
        enabled=enabled,
    )
    store.add(record)
    if record.enabled:
        _register(record)
    return _record_to_api(record)


def update_scheduled(
    rec_id: str,
    *,
    name: Optional[str] = None,
    cron: Optional[str] = None,
    cron_description: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> ScheduledTask:
    rec = store.get(rec_id)
    if rec is None:
        raise ScheduledTaskNotFoundError(rec_id)

    if cron is not None and cron != rec.cron:
        _validate_cron(cron)
        rec.cron = cron
        # 没手动传新描述，自动重新生成
        if cron_description is None:
            rec.cron_description = _describe_cron(cron)

    if cron_description is not None:
        rec.cron_description = cron_description

    if name is not None:
        rec.name = name

    if enabled is not None:
        rec.enabled = enabled

    store.add(rec)

    # 重新注册调度
    _unregister(rec.id)
    if rec.enabled:
        _register(rec)

    return _record_to_api(rec)


def delete_scheduled(rec_id: str) -> None:
    rec = store.get(rec_id)
    if rec is None:
        raise ScheduledTaskNotFoundError(rec_id)
    _unregister(rec_id)
    store.remove(rec_id)


def toggle_scheduled(rec_id: str, enabled: bool) -> ScheduledTask:
    rec = store.get(rec_id)
    if rec is None:
        raise ScheduledTaskNotFoundError(rec_id)
    rec.enabled = enabled
    store.add(rec)
    _unregister(rec_id)
    if enabled:
        _register(rec)
    return _record_to_api(rec)


def run_scheduled_now(rec_id: str) -> ScheduledTask:
    """立即触发一次（不影响 cron 下次时间，也不因 disabled 跳过）。"""
    rec = store.get(rec_id)
    if rec is None:
        raise ScheduledTaskNotFoundError(rec_id)

    container = _find_container(rec.agent_id)
    if container is None:
        raise AgentNotFoundError(rec.agent_id)

    handler = _task_handler_for(container)
    task = trigger_task(
        agent_id=rec.agent_id,
        name=rec.name,
        command=[handler, rec.name],
        source="manual",  # 手动触发走 manual 便于区分
    )
    rec.last_run = datetime.now(_get_tz())
    rec.last_task_id = task.id
    store.add(rec)
    return _record_to_api(rec)


# ---------- 生命周期钩子 ----------


def start_scheduler() -> None:
    """在 FastAPI lifespan 启动时调用。"""
    scheduler_holder.get()


def stop_scheduler() -> None:
    """在 FastAPI lifespan 关闭时调用。"""
    scheduler_holder.shutdown()

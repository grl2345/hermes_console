"""ScheduledTask 服务层：APScheduler + 内存存储。

cron 到点触发时：
1. 查对应 agent 的 `hermes.taskHandler` label（缺省用全局 HERMES_TASK_HANDLER）
2. 调用 phase 6 的 `trigger_task(agent_id, name, command=[handler, name], source="scheduled")`
3. 记录 last_run / last_task_id；前端 GET 时反查 task_store 得到最新 lastStatus

存储：内存字典（重启丢失，与当前"无持久化"约定一致）。
"""
from __future__ import annotations

import json
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
from ..docker_client import get_client
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


def _map_job_status(raw_status: Optional[str]) -> Optional[str]:
    """把 cron jobs.json 的状态映射到前端 TaskStatus。"""
    if not raw_status:
        return None
    normalized = raw_status.strip().lower()
    if normalized in {"ok", "success", "succeeded"}:
        return "success"
    if normalized in {"fail", "failed", "error"}:
        return "failed"
    if normalized in {"running", "executing"}:
        return "running"
    return "pending"


def _list_scheduled_from_container_cron(container, agent_id: str) -> list[ScheduledTask]:
    """从容器内 /opt/data/cron/jobs.json 读取定时任务（优先真实数据源）。"""
    # 先走容器 label 覆盖，再回退默认目录
    labels = container.labels or {}
    cron_dir = (labels.get("hermes.cronDir") or "/opt/data/cron").rstrip("/")
    jobs_file = f"{cron_dir}/jobs.json"

    # 容器不运行时直接返回空
    state = (container.attrs or {}).get("State", {}) or {}
    if state.get("Status") != "running" or state.get("Paused"):
        return []

    # jobs.json 可能不存在（视为暂无任务）
    try:
        result = container.exec_run(["cat", jobs_file], demux=False)
        exit_code = result.exit_code or 0
        output = result.output or b""
        if isinstance(output, tuple):
            output = (output[0] or b"") + (output[1] or b"")
    except Exception:  # noqa: BLE001
        logger.exception("读取 jobs.json 失败: %s", jobs_file)
        return []
    if exit_code != 0:
        return []

    try:
        payload = json.loads(output.decode("utf-8", errors="replace"))
    except json.JSONDecodeError:
        logger.warning("jobs.json 解析失败: %s", jobs_file)
        return []

    jobs = payload.get("jobs") if isinstance(payload, dict) else None
    if not isinstance(jobs, list):
        return []

    result: list[ScheduledTask] = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        job_id = str(job.get("id") or "")
        name = str(job.get("name") or "")
        if not job_id or not name:
            continue
        schedule = job.get("schedule") if isinstance(job.get("schedule"), dict) else {}
        cron_expr = str(schedule.get("expr") or job.get("schedule_display") or "")
        if not cron_expr:
            continue
        cron_desc = str(schedule.get("display") or job.get("schedule_display") or cron_expr)
        last_status = _map_job_status(job.get("last_status"))

        result.append(
            ScheduledTask(
                id=job_id,
                agentId=agent_id,
                name=name,
                cron=cron_expr,
                cronDescription=cron_desc,
                nextRun=job.get("next_run_at"),
                enabled=bool(job.get("enabled", True)),
                lastRun=job.get("last_run_at"),
                lastStatus=last_status,  # type: ignore[arg-type]
            )
        )

    result.sort(key=lambda t: t.name.lower())
    return result


def _get_hermes_containers():
    client = get_client()
    containers = client.containers.list(all=True)
    return [c for c in containers if (c.labels or {}).get("hermes.agent") == "true"]


def _agent_id_for_container(container) -> str:
    labels = container.labels or {}
    return labels.get("hermes.id") or container.short_id or container.id[:12]


def _load_cron_payload(container) -> tuple[str, dict]:
    labels = container.labels or {}
    cron_dir = (labels.get("hermes.cronDir") or "/opt/data/cron").rstrip("/")
    jobs_file = f"{cron_dir}/jobs.json"
    result = container.exec_run(["cat", jobs_file], demux=False)
    if (result.exit_code or 0) != 0:
        raise ScheduledTaskNotFoundError(jobs_file)
    output = result.output or b""
    if isinstance(output, tuple):
        output = (output[0] or b"") + (output[1] or b"")
    payload = json.loads(output.decode("utf-8", errors="replace"))
    if not isinstance(payload, dict):
        raise ScheduledTaskValidationError("jobs.json 格式错误")
    if not isinstance(payload.get("jobs"), list):
        payload["jobs"] = []
    return jobs_file, payload


def _save_cron_payload(container, jobs_file: str, payload: dict) -> None:
    content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    encoded = content.encode("utf-8").hex()
    cmd = [
        "sh",
        "-c",
        (
            "python3 - <<'PY'\n"
            "from pathlib import Path\n"
            f"hex_data = '{encoded}'\n"
            f"target = Path({json.dumps(jobs_file)})\n"
            "target.parent.mkdir(parents=True, exist_ok=True)\n"
            "target.write_bytes(bytes.fromhex(hex_data))\n"
            "PY"
        ),
    ]
    result = container.exec_run(cmd, demux=False)
    if (result.exit_code or 0) != 0:
        raise ScheduledTaskValidationError("写回 jobs.json 失败")


def _find_cron_job(rec_id: str):
    for container in _get_hermes_containers():
        agent_id = _agent_id_for_container(container)
        try:
            jobs_file, payload = _load_cron_payload(container)
        except Exception:
            continue
        jobs = payload.get("jobs") or []
        for idx, job in enumerate(jobs):
            if isinstance(job, dict) and str(job.get("id") or "") == rec_id:
                return container, agent_id, jobs_file, payload, idx, job
    return None


def _job_to_api(agent_id: str, job: dict) -> ScheduledTask:
    schedule = job.get("schedule") if isinstance(job.get("schedule"), dict) else {}
    cron_expr = str(schedule.get("expr") or job.get("schedule_display") or "")
    cron_desc = str(schedule.get("display") or job.get("schedule_display") or cron_expr)
    return ScheduledTask(
        id=str(job.get("id") or ""),
        agentId=agent_id,
        name=str(job.get("name") or ""),
        cron=cron_expr,
        cronDescription=cron_desc,
        nextRun=job.get("next_run_at"),
        enabled=bool(job.get("enabled", True)),
        lastRun=job.get("last_run_at"),
        lastStatus=_map_job_status(job.get("last_status")),  # type: ignore[arg-type]
    )


# ---------- 对外 API ----------


def list_scheduled(agent_id: Optional[str] = None) -> list[ScheduledTask]:
    # 优先返回容器真实 cron 文件中的任务
    if agent_id is not None:
        container = _find_container(agent_id)
        if container is None:
            raise AgentNotFoundError(agent_id)
        from_cron = _list_scheduled_from_container_cron(container, agent_id)
        if from_cron:
            return from_cron

    if agent_id is None:
        # 聚合所有 Hermes 容器的 cron 任务
        try:
            client = get_client()
            containers = client.containers.list(all=True)
        except Exception:  # noqa: BLE001
            containers = []
        merged: list[ScheduledTask] = []
        for c in containers:
            labels = c.labels or {}
            if labels.get("hermes.agent") != "true":
                continue
            a_id = labels.get("hermes.id") or c.short_id or c.id[:12]
            merged.extend(_list_scheduled_from_container_cron(c, a_id))
        if merged:
            merged.sort(key=lambda t: t.name.lower())
            return merged

    # 回退：兼容旧的内存调度模型
    records = store.all()
    if agent_id is not None:
        records = [r for r in records if r.agent_id == agent_id]
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
    if rec is not None:
        rec.enabled = enabled
        store.add(rec)
        _unregister(rec_id)
        if enabled:
            _register(rec)
        return _record_to_api(rec)

    # 回退：处理来自 jobs.json 的真实任务 ID
    found = _find_cron_job(rec_id)
    if found is None:
        raise ScheduledTaskNotFoundError(rec_id)
    container, agent_id, jobs_file, payload, idx, job = found
    job["enabled"] = enabled
    # 与 agent 侧语义保持一致
    if enabled:
        job["state"] = "scheduled"
        job["paused_at"] = None
    else:
        job["state"] = "paused"
        job["paused_at"] = datetime.now(_get_tz()).isoformat()
    payload["jobs"][idx] = job
    _save_cron_payload(container, jobs_file, payload)
    return _job_to_api(agent_id, job)


def run_scheduled_now(rec_id: str) -> ScheduledTask:
    """立即触发一次（不影响 cron 下次时间，也不因 disabled 跳过）。"""
    rec = store.get(rec_id)
    if rec is not None:
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

    # 回退：处理来自 jobs.json 的真实任务 ID
    found = _find_cron_job(rec_id)
    if found is None:
        raise ScheduledTaskNotFoundError(rec_id)
    container, agent_id, jobs_file, payload, idx, job = found
    name = str(job.get("name") or rec_id)
    handler = _task_handler_for(container)
    task = trigger_task(
        agent_id=agent_id,
        name=name,
        command=[handler, name],
        source="manual",
    )
    now_iso = datetime.now(_get_tz()).isoformat()
    job["last_run_at"] = now_iso
    job["last_status"] = "ok"
    job["state"] = "scheduled"
    payload["jobs"][idx] = job
    _save_cron_payload(container, jobs_file, payload)
    api_task = _job_to_api(agent_id, job)
    api_task.lastStatus = task.status
    return api_task


# ---------- 生命周期钩子 ----------


def start_scheduler() -> None:
    """在 FastAPI lifespan 启动时调用。"""
    scheduler_holder.get()


def stop_scheduler() -> None:
    """在 FastAPI lifespan 关闭时调用。"""
    scheduler_holder.shutdown()

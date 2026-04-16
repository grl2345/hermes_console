"""Agent 实时指标采集（阶段 9）。

架构：
- 后台线程池（由 APScheduler 驱动，每 15s 触发一次）并行调用
  `container.stats(stream=False)` 采样所有 Hermes agent 容器
- 采样结果缓存在进程内；路由层读缓存，延迟 <1ms
- 首次启动后 ~15s 内缓存为空（cpu/memory 返回 0），之后稳定

不做：
- Token / 费用：Hermes agent 本身暂未记账，保持 0 + `—` 显示
- 历史曲线：阶段 9 只做"瞬时快照"；要折线图需加时序存储，属下一阶段
"""
from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from docker.errors import DockerException
from docker.models.containers import Container

from ..docker_client import DockerUnavailableError, get_client
from .agents import _is_hermes_container

logger = logging.getLogger(__name__)

# 刷新间隔；docker.stats(stream=False) 单次约 1s，N 个容器并行刷新
_REFRESH_SECONDS = 15
_MAX_SAMPLE_WORKERS = 5
# 缓存记录超过此年龄视为失效
_CACHE_MAX_AGE_SECONDS = 60


@dataclass
class StatsSnapshot:
    cpu_percent: float
    memory_mb: float
    memory_limit_mb: float
    read_at: datetime

    def age_seconds(self) -> float:
        return (datetime.now(timezone.utc) - self.read_at).total_seconds()


class _StatsCache:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._data: dict[str, StatsSnapshot] = {}

    def set(self, agent_id: str, snapshot: StatsSnapshot) -> None:
        with self._lock:
            self._data[agent_id] = snapshot

    def get(self, agent_id: str) -> Optional[StatsSnapshot]:
        with self._lock:
            snap = self._data.get(agent_id)
        if snap is None:
            return None
        if snap.age_seconds() > _CACHE_MAX_AGE_SECONDS:
            return None
        return snap

    def remove(self, agent_id: str) -> None:
        with self._lock:
            self._data.pop(agent_id, None)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


cache = _StatsCache()


# ---------- 计算 ----------


def _calc_cpu_percent(stats: dict) -> float:
    """docker stats JSON → CPU 百分比（0~100 * num_cpus）。"""
    try:
        cpu = stats.get("cpu_stats", {})
        pre = stats.get("precpu_stats", {})
        cpu_total = cpu.get("cpu_usage", {}).get("total_usage", 0)
        pre_total = pre.get("cpu_usage", {}).get("total_usage", 0)
        system = cpu.get("system_cpu_usage", 0)
        pre_system = pre.get("system_cpu_usage", 0)
        cpu_delta = cpu_total - pre_total
        system_delta = system - pre_system
        if system_delta <= 0 or cpu_delta <= 0:
            return 0.0
        num_cpus = cpu.get("online_cpus") or len(
            cpu.get("cpu_usage", {}).get("percpu_usage") or [1]
        )
        return round((cpu_delta / system_delta) * num_cpus * 100.0, 2)
    except Exception:  # noqa: BLE001
        return 0.0


def _calc_memory(stats: dict) -> tuple[float, float]:
    """docker stats JSON → (usage_mb, limit_mb)。"""
    try:
        mem = stats.get("memory_stats", {}) or {}
        usage = mem.get("usage") or 0
        # 扣掉内核 cache，更接近 RSS；字段路径随 docker 版本微差
        inner = mem.get("stats") or {}
        cache_bytes = inner.get("cache", inner.get("total_cache", 0)) or 0
        rss = max(usage - cache_bytes, 0)
        limit = mem.get("limit") or 0
        mb = 1024 * 1024
        return round(rss / mb, 1), round(limit / mb, 1)
    except Exception:  # noqa: BLE001
        return 0.0, 0.0


def _sample_one(container: Container) -> Optional[StatsSnapshot]:
    try:
        stats = container.stats(stream=False)
    except DockerException:
        logger.debug("stats 读取失败: %s", container.name, exc_info=True)
        return None
    cpu_pct = _calc_cpu_percent(stats)
    mem_mb, limit_mb = _calc_memory(stats)
    return StatsSnapshot(
        cpu_percent=cpu_pct,
        memory_mb=mem_mb,
        memory_limit_mb=limit_mb,
        read_at=datetime.now(timezone.utc),
    )


# ---------- 对外 API ----------


def get_cached(agent_id: str) -> Optional[StatsSnapshot]:
    return cache.get(agent_id)


def sample_now(container: Container) -> Optional[StatsSnapshot]:
    """立刻采样一次并写入缓存（用于 /agents/{id}/stats 强制刷新）。"""
    snap = _sample_one(container)
    if snap is not None:
        agent_id = (container.labels or {}).get("hermes.id") or container.short_id
        cache.set(agent_id, snap)
    return snap


def _agent_id_for(container: Container) -> str:
    return (container.labels or {}).get("hermes.id") or container.short_id or container.id[:12]


def refresh_all() -> int:
    """采样所有正在运行的 Hermes agent。返回成功采样数量。"""
    try:
        client = get_client()
    except DockerUnavailableError:
        logger.warning("stats 刷新：Docker 不可达")
        return 0

    try:
        containers = client.containers.list(all=False)  # 只采运行中的
    except DockerException:
        logger.exception("stats 刷新：列出容器失败")
        return 0

    targets = [c for c in containers if _is_hermes_container(c)]
    if not targets:
        return 0

    count = 0
    with ThreadPoolExecutor(max_workers=_MAX_SAMPLE_WORKERS) as pool:
        futures = {pool.submit(_sample_one, c): c for c in targets}
        for fut in as_completed(futures):
            container = futures[fut]
            try:
                snap = fut.result()
            except Exception:  # noqa: BLE001
                logger.exception("采样 %s 异常", container.name)
                continue
            if snap is not None:
                cache.set(_agent_id_for(container), snap)
                count += 1
    logger.debug("stats 刷新完成：%d / %d", count, len(targets))
    return count


# ---------- 调度器集成 ----------


_JOB_ID = "agent_stats_refresh"


def start_refresher() -> None:
    """把刷新任务挂到已有的 APScheduler 上。"""
    # 延迟 import，避免循环依赖
    from .scheduled_tasks import scheduler_holder

    sched = scheduler_holder.get()
    sched.add_job(
        refresh_all,
        "interval",
        seconds=_REFRESH_SECONDS,
        id=_JOB_ID,
        replace_existing=True,
        # 启动后立刻触发一次（不等第一个间隔）
        next_run_time=datetime.now(timezone.utc),
    )
    logger.info("stats 刷新任务已注册：每 %ds 一次", _REFRESH_SECONDS)


def stop_refresher() -> None:
    try:
        from .scheduled_tasks import scheduler_holder

        sched = scheduler_holder.get()
        sched.remove_job(_JOB_ID)
    except Exception:  # noqa: BLE001
        pass
    cache.clear()

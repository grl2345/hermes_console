"""仪表盘统计接口。

阶段 9：从 `task_store` 实时计算活跃 / 今日完成 / 今日任务，而不是从容器 label
或 agent 字段读取（那些是静态元数据或 0）。
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter

from ..services.agents import list_agents
from ..services.scheduled_tasks import _get_tz
from ..services.tasks import task_store

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats() -> dict:
    """返回首页统计卡片所需的聚合数据。"""
    agents = list_agents()
    online_count = sum(1 for agent in agents if agent.status == "online")

    records = task_store.list()
    today_start = datetime.now(_get_tz()).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    active_task_count = sum(
        1 for r in records if r.status in ("pending", "running")
    )
    today_started = [r for r in records if r.started_at >= today_start]
    today_completed = sum(1 for r in today_started if r.status == "success")

    return {
        "onlineCount": online_count,
        "totalAgents": len(agents),
        "activeTaskCount": active_task_count,
        "todayCompleted": today_completed,
        "todayTasks": len(today_started),
        # Hermes 暂未记 token / 费用，保持 0；有数据后从这里聚合
        "todayTokens": 0,
        "todayCost": 0.0,
    }

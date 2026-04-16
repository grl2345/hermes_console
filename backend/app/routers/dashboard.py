"""仪表盘统计接口。"""
from __future__ import annotations

from fastapi import APIRouter

from ..services.agents import list_agents

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats() -> dict:
    """返回首页统计卡片所需的聚合数据。"""
    agents = list_agents()
    online_count = sum(1 for agent in agents if agent.status == "online")
    active_task_count = sum(agent.activeTaskCount for agent in agents)
    today_completed = sum(agent.todayTaskCount for agent in agents)
    today_tokens = sum(agent.weeklyTokens for agent in agents)

    return {
        "onlineCount": online_count,
        "totalAgents": len(agents),
        "activeTaskCount": active_task_count,
        "todayCompleted": today_completed,
        "todayTokens": today_tokens,
    }

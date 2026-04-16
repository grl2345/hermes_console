"""/agents/* 路由。

阶段 2：只读列表 + 详情
阶段 3：生命周期控制（start / stop / restart）
"""
from __future__ import annotations

import logging
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import require_api_key
from ..docker_client import DockerUnavailableError
from ..schemas.agent import Agent
from ..services import agents as agent_service
from ..services.agents import AgentNotFoundError, AgentOperationError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/agents",
    tags=["agents"],
    dependencies=[Depends(require_api_key)],
)


@router.get("", response_model=list[Agent])
async def list_agents() -> list[Agent]:
    try:
        return agent_service.list_agents()
    except DockerUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )


@router.get("/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str) -> Agent:
    try:
        agent = agent_service.get_agent(agent_id)
    except DockerUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 Agent: {agent_id}",
        )
    return agent


# ---------- 阶段 3：启停重启 ----------

def _run_lifecycle(
    action: Callable[[str], Agent], agent_id: str, verb: str
) -> dict:
    """调用生命周期动作并把服务层异常映射为 HTTP 错误。"""
    try:
        agent = action(agent_id)
    except DockerUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except AgentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 Agent: {agent_id}",
        )
    except AgentOperationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    logger.info("%s agent=%s 成功，当前状态=%s", verb, agent_id, agent.status)
    # 前端仅关心 success，但附带 agent 方便未来直接取新状态
    return {"success": True, "agent": agent.model_dump()}


@router.post("/{agent_id}/start")
async def start_agent(agent_id: str) -> dict:
    return _run_lifecycle(agent_service.start_agent, agent_id, "start")


@router.post("/{agent_id}/stop")
async def stop_agent(agent_id: str) -> dict:
    return _run_lifecycle(agent_service.stop_agent, agent_id, "stop")


@router.post("/{agent_id}/restart")
async def restart_agent(agent_id: str) -> dict:
    return _run_lifecycle(agent_service.restart_agent, agent_id, "restart")

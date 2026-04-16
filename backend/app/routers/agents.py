"""/agents/* 路由：阶段 2 只读列表 + 详情。"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import require_api_key
from ..docker_client import DockerUnavailableError
from ..schemas.agent import Agent
from ..services import agents as agent_service

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

"""/agents/* 路由。

阶段 2：只读列表 + 详情
阶段 3：生命周期控制（start / stop / restart）
阶段 4：日志流（SSE 由 Next.js 代理层包装；后端直接吐 raw bytes）
"""
from __future__ import annotations

import logging
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from ..config import settings
from ..deps import require_api_key
from ..docker_client import DockerUnavailableError
from ..schemas.agent import Agent, AgentCreateRequest
from ..services import agent_creation, agents as agent_service
from ..services.agent_creation import (
    AgentAlreadyExistsError,
    AgentCreationError,
)
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


# ---------- 阶段 8：一键创建新 Agent ----------


@router.post("", response_model=Agent, status_code=status.HTTP_201_CREATED)
async def create_agent(payload: AgentCreateRequest) -> Agent:
    """创建新 agent，等价于 init_agent.sh 的 Python 版 + 自动打 hermes.* label。"""
    try:
        return agent_creation.create_agent(payload)
    except AgentAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except DockerUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except AgentCreationError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"权限不足：需要访问 {settings.hermes_agent_root}。错误：{exc}",
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


# ---------- 阶段 4：日志流 ----------


@router.get("/{agent_id}/logs")
async def get_agent_logs(
    agent_id: str,
    follow: bool = Query(default=True, description="true 流式，false 一次性"),
    tail: int = Query(default=200, ge=1, le=10000),
):
    """返回容器日志。

    - 默认 `follow=true`，返回 `text/plain` 字节流；Next.js 代理层会按
      `data: <chunk>\\n\\n` 封成 SSE 给浏览器 EventSource 消费。
    - `follow=false` 返回最近 `tail` 行的快照。
    """
    try:
        gen = agent_service.stream_agent_logs(agent_id, follow=follow, tail=tail)
    except DockerUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except AgentNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"未找到 Agent: {agent_id}")
    except AgentOperationError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    # 禁用中间层缓冲：nginx / proxy 见到 X-Accel-Buffering 就直通
    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(gen, media_type="text/plain; charset=utf-8", headers=headers)

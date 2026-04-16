"""/tasks/* 路由（阶段 6）。"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..deps import require_api_key
from ..schemas.task import Task
from ..services import tasks as task_service
from ..services.agents import AgentNotFoundError
from ..services.tasks import TaskNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
    dependencies=[Depends(require_api_key)],
)


@router.get("", response_model=list[Task])
async def list_tasks(
    agentId: Optional[str] = Query(default=None, description="按 agent 过滤"),
) -> list[Task]:
    return task_service.list_tasks(agent_id=agentId)


@router.get("/{task_id}", response_model=Task)
async def get_task(task_id: str) -> Task:
    try:
        return task_service.get_task(task_id)
    except TaskNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到任务: {task_id}",
        )


@router.post("/{task_id}/retry", response_model=Task)
async def retry_task(task_id: str) -> Task:
    try:
        return task_service.retry_task(task_id)
    except TaskNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到任务: {task_id}",
        )
    except AgentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 Agent: {exc.args[0] if exc.args else ''}",
        )

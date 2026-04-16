"""/scheduled-tasks/* 路由（阶段 7）。"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..deps import require_api_key
from ..schemas.scheduled_task import (
    ScheduledTask,
    ScheduledTaskCreate,
    ScheduledTaskToggle,
    ScheduledTaskUpdate,
)
from ..services import scheduled_tasks as sched_service
from ..services.agents import AgentNotFoundError
from ..services.scheduled_tasks import (
    ScheduledTaskNotFoundError,
    ScheduledTaskValidationError,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/scheduled-tasks",
    tags=["scheduled-tasks"],
    dependencies=[Depends(require_api_key)],
)


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


@router.get("", response_model=list[ScheduledTask])
async def list_scheduled(
    agentId: Optional[str] = Query(default=None),
) -> list[ScheduledTask]:
    return sched_service.list_scheduled(agent_id=agentId)


@router.get("/{rec_id}", response_model=ScheduledTask)
async def get_scheduled(rec_id: str) -> ScheduledTask:
    try:
        return sched_service.get_scheduled(rec_id)
    except ScheduledTaskNotFoundError:
        raise _not_found(f"未找到定时任务: {rec_id}")


@router.post("", response_model=ScheduledTask, status_code=status.HTTP_201_CREATED)
async def create_scheduled(payload: ScheduledTaskCreate) -> ScheduledTask:
    try:
        return sched_service.create_scheduled(
            agent_id=payload.agentId,
            name=payload.name,
            cron=payload.cron,
            cron_description=payload.cronDescription,
            enabled=payload.enabled,
        )
    except ScheduledTaskValidationError as exc:
        raise _bad(str(exc))
    except AgentNotFoundError:
        raise _not_found(f"未找到 Agent: {payload.agentId}")


@router.put("/{rec_id}", response_model=ScheduledTask)
async def update_scheduled(rec_id: str, payload: ScheduledTaskUpdate) -> ScheduledTask:
    try:
        return sched_service.update_scheduled(
            rec_id,
            name=payload.name,
            cron=payload.cron,
            cron_description=payload.cronDescription,
            enabled=payload.enabled,
        )
    except ScheduledTaskNotFoundError:
        raise _not_found(f"未找到定时任务: {rec_id}")
    except ScheduledTaskValidationError as exc:
        raise _bad(str(exc))


@router.delete("/{rec_id}")
async def delete_scheduled(rec_id: str) -> dict:
    try:
        sched_service.delete_scheduled(rec_id)
    except ScheduledTaskNotFoundError:
        raise _not_found(f"未找到定时任务: {rec_id}")
    return {"success": True}


@router.patch("/{rec_id}/toggle", response_model=ScheduledTask)
async def toggle_scheduled(rec_id: str, payload: ScheduledTaskToggle) -> ScheduledTask:
    try:
        return sched_service.toggle_scheduled(rec_id, payload.enabled)
    except ScheduledTaskNotFoundError:
        raise _not_found(f"未找到定时任务: {rec_id}")


@router.post("/{rec_id}/run")
async def run_scheduled(rec_id: str) -> dict:
    try:
        sched_service.run_scheduled_now(rec_id)
    except ScheduledTaskNotFoundError:
        raise _not_found(f"未找到定时任务: {rec_id}")
    except AgentNotFoundError as exc:
        raise _not_found(f"未找到 Agent: {exc.args[0] if exc.args else ''}")
    return {"success": True}

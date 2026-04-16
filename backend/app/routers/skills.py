"""/skills/* 路由（阶段 5）。"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..deps import require_api_key
from ..docker_client import DockerUnavailableError
from ..schemas.skill import Skill, SkillCreateRequest, SkillUpdateRequest
from ..services import skills as skill_service
from ..services.agents import AgentNotFoundError, AgentOperationError
from ..services.skills import SkillNotFoundError, SkillValidationError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/skills",
    tags=["skills"],
    dependencies=[Depends(require_api_key)],
)


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _unavailable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _internal(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


@router.get("", response_model=list[Skill])
async def list_skills(
    agentId: Optional[str] = Query(default=None, description="按 agent 过滤"),
) -> list[Skill]:
    try:
        return skill_service.list_skills(agent_id=agentId)
    except DockerUnavailableError as exc:
        raise _unavailable(str(exc))
    except AgentNotFoundError:
        raise _not_found(f"未找到 Agent: {agentId}")


@router.get("/{skill_id}", response_model=Skill)
async def get_skill(skill_id: str) -> Skill:
    try:
        return skill_service.get_skill(skill_id)
    except DockerUnavailableError as exc:
        raise _unavailable(str(exc))
    except SkillValidationError as exc:
        raise _bad_request(str(exc))
    except AgentNotFoundError as exc:
        raise _not_found(f"未找到 Agent: {exc.args[0] if exc.args else ''}")
    except SkillNotFoundError as exc:
        raise _not_found(f"未找到技能: {exc.args[0] if exc.args else skill_id}")
    except AgentOperationError as exc:
        raise _internal(str(exc))


@router.post("", response_model=Skill, status_code=status.HTTP_201_CREATED)
async def create_skill(payload: SkillCreateRequest) -> Skill:
    try:
        return skill_service.create_skill(
            agent_id=payload.agentId,
            name=payload.name,
            content=payload.content,
        )
    except DockerUnavailableError as exc:
        raise _unavailable(str(exc))
    except SkillValidationError as exc:
        # 可能是命名不合法，或技能已存在
        msg = str(exc)
        raise _conflict(msg) if "已存在" in msg else _bad_request(msg)
    except AgentNotFoundError:
        raise _not_found(f"未找到 Agent: {payload.agentId}")
    except AgentOperationError as exc:
        raise _internal(str(exc))


@router.put("/{skill_id}", response_model=Skill)
async def update_skill(skill_id: str, payload: SkillUpdateRequest) -> Skill:
    try:
        return skill_service.update_skill(skill_id, payload.content)
    except DockerUnavailableError as exc:
        raise _unavailable(str(exc))
    except SkillValidationError as exc:
        raise _bad_request(str(exc))
    except AgentNotFoundError as exc:
        raise _not_found(f"未找到 Agent: {exc.args[0] if exc.args else ''}")
    except SkillNotFoundError as exc:
        raise _not_found(f"未找到技能: {exc.args[0] if exc.args else skill_id}")
    except AgentOperationError as exc:
        raise _internal(str(exc))


@router.delete("/{skill_id}")
async def delete_skill(skill_id: str) -> dict:
    try:
        skill_service.delete_skill(skill_id)
    except DockerUnavailableError as exc:
        raise _unavailable(str(exc))
    except SkillValidationError as exc:
        raise _bad_request(str(exc))
    except AgentNotFoundError as exc:
        raise _not_found(f"未找到 Agent: {exc.args[0] if exc.args else ''}")
    except SkillNotFoundError as exc:
        raise _not_found(f"未找到技能: {exc.args[0] if exc.args else skill_id}")
    except AgentOperationError as exc:
        raise _internal(str(exc))
    return {"success": True}

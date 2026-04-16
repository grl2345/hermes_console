"""/agents/* 路由。阶段 2 在此实现 Agent 只读列表。"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import require_api_key

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", dependencies=[Depends(require_api_key)])
async def list_agents() -> list:
    """阶段 2 实现；当前返回空列表以保证前端不报错。"""
    return []

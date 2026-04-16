"""健康检查端点。"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ..docker_client import DockerUnavailableError, probe

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict:
    """返回后端与 Docker 的连通状态。"""
    now = datetime.now(timezone.utc).isoformat()
    try:
        info = probe()
        return {
            "status": "ok",
            "timestamp": now,
            "docker": info,
        }
    except DockerUnavailableError as exc:
        return {
            "status": "degraded",
            "timestamp": now,
            "docker": {"connected": False, "error": str(exc)},
        }

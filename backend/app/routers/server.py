"""服务器信息接口。"""
from __future__ import annotations

import socket
from datetime import datetime

from fastapi import APIRouter

router = APIRouter(prefix="/server", tags=["server"])


@router.get("/info")
async def server_info() -> dict:
    """返回控制台头部需要的远程服务器信息。"""
    return {
        "hostname": socket.gethostname(),
        "lastUpdated": datetime.now().strftime("%H:%M"),
    }

"""Task schema（对应前端 lib/types.ts 中的 Task 类型）。"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

TaskStatus = Literal["pending", "running", "success", "failed"]


class Task(BaseModel):
    """任务详情，暴露给前端。"""

    id: str
    agentId: str
    name: str
    status: TaskStatus
    source: str
    startedAt: str
    duration: Optional[str] = None
    tokens: Optional[int] = None
    error: Optional[str] = None

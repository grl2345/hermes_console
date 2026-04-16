"""ScheduledTask schema（对应前端 lib/types.ts 中的 ScheduledTask 类型）。"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from .task import TaskStatus


class ScheduledTask(BaseModel):
    id: str
    agentId: str
    name: str
    cron: str
    cronDescription: str
    nextRun: Optional[str] = None
    enabled: bool = True
    lastRun: Optional[str] = None
    lastStatus: Optional[TaskStatus] = None


class ScheduledTaskCreate(BaseModel):
    agentId: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=128)
    cron: str = Field(min_length=1)
    cronDescription: Optional[str] = None  # 可选，后端会按 cron 自动生成
    enabled: bool = True


class ScheduledTaskUpdate(BaseModel):
    """PUT 时允许部分字段更新（前端 hook 用 Partial<ScheduledTask>）。"""

    name: Optional[str] = Field(default=None, max_length=128)
    cron: Optional[str] = None
    cronDescription: Optional[str] = None
    enabled: Optional[bool] = None


class ScheduledTaskToggle(BaseModel):
    enabled: bool

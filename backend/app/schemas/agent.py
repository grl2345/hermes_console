"""Agent schema（与前端 lib/types.ts 中的 Agent 类型一一对应）。"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

AgentStatus = Literal["online", "busy", "offline"]
AgentLevel = Literal["ceo", "director", "staff"]


class Agent(BaseModel):
    """Agent 详情模型，与前端 Agent interface 保持字段一致。"""

    id: str
    name: str
    shortName: str
    role: str
    model: str
    containerId: str
    status: AgentStatus
    uptime: str

    # 阶段 5/6 填充；当前阶段 0
    skillCount: int = 0
    activeTaskCount: int = 0
    todayTaskCount: int = 0
    currentTask: Optional[str] = None

    # 阶段 9 填充；当前阶段 0
    cpu: float = 0.0
    memory: float = 0.0
    weeklyTokens: int = 0
    weeklyCost: float = 0.0

    # 层级关系
    reportsTo: Optional[str] = None
    level: AgentLevel = "staff"
    avatarColor: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")

    # 错误 / 停止时间
    errorMessage: Optional[str] = None
    stoppedAt: Optional[str] = None

"""Agent schema（与前端 lib/types.ts 中的 Agent 类型一一对应）。"""
from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

AgentStatus = Literal["online", "busy", "offline"]
AgentLevel = Literal["ceo", "director", "staff"]

AGENT_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


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


class AgentCreateRequest(BaseModel):
    """创建新 Agent 的请求体；对应 init_agent.sh 的 7 个参数 + 层级元信息。"""

    # --- 必填 ---
    agentName: str = Field(min_length=1, max_length=64)   # 容器名与 hermes.id
    telegramBotToken: str = Field(min_length=1)
    openaiApiKey: str = Field(min_length=1)
    apiModel: str = Field(min_length=1)                    # 如 moonshotai/kimi-k2.5

    # --- 选填元信息（缺省时派生）---
    displayName: Optional[str] = None
    shortName: Optional[str] = Field(default=None, max_length=4)
    role: Optional[str] = None
    level: AgentLevel = "staff"
    reportsTo: Optional[str] = None
    avatarColor: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")

    # --- 选填运行时 ---
    openaiBaseUrl: Optional[str] = None
    modelBaseUrl: Optional[str] = None                     # 不填则复用 openaiBaseUrl
    gatewayAllowAllUsers: bool = True

    @field_validator("agentName")
    @classmethod
    def _validate_agent_name(cls, v: str) -> str:
        if not AGENT_NAME_RE.match(v):
            raise ValueError("agentName 只允许字母、数字、下划线、短横线")
        return v

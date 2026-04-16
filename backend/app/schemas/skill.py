"""Skill schema（对应前端 lib/types.ts 中的 Skill 类型）。"""
from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

# 技能名只允许字母数字 下划线 短横线，防止 shell 注入 & 文件系统路径问题
SKILL_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


class Skill(BaseModel):
    """技能详情，用于 GET / POST / PUT 的响应。"""

    id: str
    agentId: str
    name: str
    version: int = 1
    description: str = ""
    content: str  # 完整 Markdown（含 frontmatter）
    updatedAt: str
    filePath: str


class SkillCreateRequest(BaseModel):
    agentId: str
    name: str = Field(min_length=1, max_length=64)
    content: str

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        if not SKILL_NAME_RE.match(v):
            raise ValueError("技能名只允许字母、数字、下划线、短横线")
        return v


class SkillUpdateRequest(BaseModel):
    content: str

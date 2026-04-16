"""认证相关的 Pydantic schema（请求 / 响应）。"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class UserResponse(BaseModel):
    """前端 `User` 类型的对应结构。"""

    id: str
    email: str
    name: str
    avatar: Optional[str] = None


class AuthResponse(BaseModel):
    """/auth/login 和 /auth/register 的响应。"""

    user: UserResponse
    token: str


class MeResponse(BaseModel):
    """/auth/me 的响应。"""

    user: UserResponse

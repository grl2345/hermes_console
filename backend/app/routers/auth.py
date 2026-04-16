"""/auth/* 路由。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import settings
from ..deps import get_current_user
from ..schemas.auth import (
    AuthResponse,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    UserResponse,
)
from ..store.memory import UserRecord, auth_store

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_user_response(user: UserRecord) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, name=user.name, avatar=user.avatar)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse:
    user = auth_store.verify_credentials(payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
        )
    token = auth_store.issue_token(user.id, settings.token_ttl_hours)
    return AuthResponse(user=_to_user_response(user), token=token)


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest) -> AuthResponse:
    try:
        user = auth_store.create_user(payload.email, payload.password, payload.name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    token = auth_store.issue_token(user.id, settings.token_ttl_hours)
    return AuthResponse(user=_to_user_response(user), token=token)


@router.get("/me", response_model=MeResponse)
async def me(user: UserRecord = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user=_to_user_response(user))


@router.post("/logout")
async def logout() -> dict:
    """前端 Next.js 层已负责删除 cookie；此端点留作占位。"""
    return {"success": True}

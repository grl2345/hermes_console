"""FastAPI 依赖：API Key 校验、当前用户解析。"""
from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException, status

from .config import settings
from .store.memory import UserRecord, auth_store


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    prefix = "Bearer "
    if authorization.startswith(prefix):
        return authorization[len(prefix):].strip()
    return None


async def require_api_key(
    authorization: Optional[str] = Header(default=None),
) -> None:
    """校验共享 API Key（若 settings.api_key 为空则跳过）。

    这是前端 Next.js 代理层统一使用的认证方式。
    """
    if not settings.api_key:
        return  # 未配置则放行

    token = _extract_bearer(authorization)
    # 允许两种：1) 共享 API Key；2) 登录后的用户 token
    if token == settings.api_key:
        return
    if token and auth_store.resolve_token(token) is not None:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效或缺失的 API Key",
    )


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> UserRecord:
    """解析 Authorization 头，返回当前用户。

    阶段 0 行为：
    - 若 Bearer token 匹配已登录用户 token，返回对应用户；
    - 否则：因前端不转发 user token（仅 API Key），回退为内置管理员。
    """
    token = _extract_bearer(authorization)
    if token:
        user = auth_store.resolve_token(token)
        if user is not None:
            return user

    # 回退：API Key 有效或未启用时，返回管理员账号
    if not settings.api_key or token == settings.api_key:
        admin = auth_store.get_user("admin")
        if admin is not None:
            return admin

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="未认证",
    )

"""进程内内存存储：用户、会话 token。

进程重启后数据丢失。Phase 0 接受此限制。
"""
from __future__ import annotations

import secrets
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional


@dataclass
class UserRecord:
    id: str
    email: str
    name: str
    password: str  # 明文；仅 Phase 0 使用，后续换成 bcrypt
    avatar: Optional[str] = None


@dataclass
class TokenRecord:
    token: str
    user_id: str
    expires_at: datetime


class AuthStore:
    """线程安全的用户 + token 存储。"""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._users_by_email: dict[str, UserRecord] = {}
        self._users_by_id: dict[str, UserRecord] = {}
        self._tokens: dict[str, TokenRecord] = {}

    # ---- 用户 ---------------------------------------------------------

    def seed_admin(self, email: str, password: str, name: str) -> None:
        """幂等地写入内置管理员账号。"""
        with self._lock:
            if email in self._users_by_email:
                return
            user = UserRecord(
                id="admin",
                email=email,
                password=password,
                name=name,
            )
            self._users_by_email[email] = user
            self._users_by_id[user.id] = user

    def create_user(self, email: str, password: str, name: str) -> UserRecord:
        with self._lock:
            if email in self._users_by_email:
                raise ValueError("邮箱已被注册")
            user = UserRecord(
                id=f"user_{secrets.token_hex(6)}",
                email=email,
                password=password,
                name=name,
            )
            self._users_by_email[email] = user
            self._users_by_id[user.id] = user
            return user

    def verify_credentials(self, email: str, password: str) -> Optional[UserRecord]:
        with self._lock:
            user = self._users_by_email.get(email)
            if user is None or user.password != password:
                return None
            return user

    def get_user(self, user_id: str) -> Optional[UserRecord]:
        with self._lock:
            return self._users_by_id.get(user_id)

    # ---- Token --------------------------------------------------------

    def issue_token(self, user_id: str, ttl_hours: int) -> str:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
        with self._lock:
            self._tokens[token] = TokenRecord(
                token=token, user_id=user_id, expires_at=expires_at
            )
        return token

    def resolve_token(self, token: str) -> Optional[UserRecord]:
        """返回 token 对应的用户；过期或不存在则返回 None。"""
        now = datetime.now(timezone.utc)
        with self._lock:
            record = self._tokens.get(token)
            if record is None:
                return None
            if record.expires_at < now:
                self._tokens.pop(token, None)
                return None
            return self._users_by_id.get(record.user_id)

    def revoke_token(self, token: str) -> None:
        with self._lock:
            self._tokens.pop(token, None)


auth_store = AuthStore()

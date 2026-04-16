"""应用配置：从环境变量 / .env 加载。"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # 监听端口
    port: int = 8080

    # Docker 守护进程地址
    docker_host: str = "unix:///var/run/docker.sock"

    # CORS 允许的来源（逗号分隔字符串）
    allowed_origins: str = "http://localhost:3000"

    # 共享 API Key；留空则不校验
    api_key: str = ""

    # 内置管理员
    admin_email: str = "admin@hermes.ai"
    admin_password: str = "admin123"
    admin_name: str = "Administrator"

    # 登录 token 有效期（小时）
    token_ttl_hours: int = 168

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()

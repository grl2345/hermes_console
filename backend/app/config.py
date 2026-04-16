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

    # ---- Agent 识别 ----
    # 主识别：Docker label `hermes.agent=true`
    # 兜底识别：容器名以此前缀开头（留空禁用）
    hermes_label_key: str = "hermes.agent"
    hermes_label_value: str = "true"
    hermes_name_prefix: str = "hermes-"

    # 技能文件默认目录（可被容器 label `hermes.skillsDir` 覆盖）
    hermes_skills_dir: str = "/root/.claude/skills"

    # 定时任务 cron 到点时，在 agent 容器内执行的脚本
    # 调用形式：<handler> <task-name>
    # 可被容器 label `hermes.taskHandler` 覆盖
    hermes_task_handler: str = "/hermes/run-task.sh"

    # 调度器时区；影响 cron 解析和 nextRun 计算
    hermes_timezone: str = "Asia/Shanghai"

    # ---- Agent 创建（阶段 8）----
    # 所有 agent 的宿主根目录。与 init_agent.sh 中的 /root/hermes 对齐。
    # 后端创建新 agent 时会在此目录下生成 `hermes_agent_<name>/`。
    hermes_agent_root: str = "/root/hermes"

    # 创建 agent 时使用的镜像
    hermes_agent_image: str = "nousresearch/hermes-agent:latest"

    # 容器内 hermes 用户 / 组 UID（镜像约定为 10000）
    hermes_container_uid: int = 10000
    hermes_container_gid: int = 10000

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()

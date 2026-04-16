"""FastAPI 应用入口。

启动：
    uvicorn app.main:app --reload --port 8080
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .docker_client import DockerUnavailableError, get_client
from .routers import agents, auth, health
from .store.memory import auth_store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("hermes.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动：写入内置管理员 + 探测 Docker
    auth_store.seed_admin(
        email=settings.admin_email,
        password=settings.admin_password,
        name=settings.admin_name,
    )
    logger.info("内置管理员已就绪：%s", settings.admin_email)

    try:
        get_client()
        logger.info("Docker 连接成功 (%s)", settings.docker_host)
    except DockerUnavailableError as exc:
        # 不阻断启动，/health 会报告 degraded；阶段 2 的 /agents 调用时再抛
        logger.warning("Docker 未连通：%s", exc)

    yield
    # 关闭：无资源需要显式释放


app = FastAPI(
    title="Hermes Console Backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """兜底异常处理：所有未捕获异常返回统一结构，便于前端解析。"""
    logger.exception("未处理异常: %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": f"服务器内部错误: {exc}"},
    )


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(agents.router)


@app.get("/", tags=["system"])
async def root() -> dict:
    return {
        "name": "Hermes Console Backend",
        "version": app.version,
        "docs": "/docs",
    }

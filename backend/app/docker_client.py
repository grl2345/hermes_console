"""Docker 客户端工厂 + 启动自检。"""
from __future__ import annotations

import logging
from typing import Optional

import docker
from docker import DockerClient
from docker.errors import DockerException

from .config import settings

logger = logging.getLogger(__name__)

_client: Optional[DockerClient] = None


class DockerUnavailableError(RuntimeError):
    """Docker 守护进程不可达。"""


def get_client() -> DockerClient:
    """返回全局 Docker 客户端；首次调用时建立连接。"""
    global _client
    if _client is None:
        try:
            _client = docker.DockerClient(base_url=settings.docker_host)
            _client.ping()
        except DockerException as exc:
            raise DockerUnavailableError(
                f"无法连接 Docker ({settings.docker_host}): {exc}"
            ) from exc
    return _client


def probe() -> dict:
    """返回 Docker 连接信息，供 /health 使用。"""
    client = get_client()
    version = client.version()
    return {
        "connected": True,
        "version": version.get("Version"),
        "api_version": version.get("ApiVersion"),
        "os": version.get("Os"),
        "arch": version.get("Arch"),
    }

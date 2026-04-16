FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TZ=Asia/Shanghai

# tzdata：让 APScheduler 能解析 Asia/Shanghai
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8080

# 利用 Python 自带 urllib 探活，避免再装 curl
# urlopen 对非 2xx 会抛 HTTPError → python 进程返回非 0 → docker 标 unhealthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=3)"

# 注意：此进程需要 root 权限以 chown 到容器外 uid 10000（阶段 8 创建新 agent 时）
# 如果你的部署场景不创建新 agent，可改为非 root 用户（添加 USER 指令）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

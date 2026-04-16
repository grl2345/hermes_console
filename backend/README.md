# Hermes Console Backend

Hermes Agent 管理平台的业务后端，基于 FastAPI，通过 Docker SDK 读写宿主机容器。

## 阶段 0 范围

- `/health`：返回服务与 Docker 守护进程连通状态
- `/auth/login`、`/auth/register`、`/auth/me`、`/auth/logout`：基于内存的最小认证
- `/agents`：占位返回空列表（阶段 2 填充）

暂不做：数据库持久化、密码哈希、真正的 RBAC。

## 本地开发

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# 按需调整 .env

uvicorn app.main:app --reload --port 8080
```

打开交互式文档：http://localhost:8080/docs

## Docker 部署

后端需要访问宿主机 Docker socket，因此 compose 已挂载 `/var/run/docker.sock`。

```bash
cd backend
cp .env.example .env   # 如需修改管理员或 API Key
docker compose up -d --build
```

部署到远程服务器时，**后端容器必须与 Hermes agent 容器跑在同一台宿主机**（因为要读写同一个 Docker socket）。

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 后端监听端口 | `8080` |
| `DOCKER_HOST` | Docker 守护进程地址 | `unix:///var/run/docker.sock` |
| `ALLOWED_ORIGINS` | CORS 允许的前端地址（逗号分隔） | `http://localhost:3000` |
| `API_KEY` | 与前端 `REMOTE_SERVER_API_KEY` 匹配；留空则不校验 | `""` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | 内置管理员账号 | `admin@hermes.ai` / `admin123` / `Administrator` |
| `TOKEN_TTL_HOURS` | 登录 token 有效期（小时） | `168` |

## 阶段 0 验收

1. `curl http://localhost:8080/health` → `{"status":"ok","docker":{"connected":true,...}}`
2. `curl -X POST http://localhost:8080/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@hermes.ai","password":"admin123"}'` → 返回 `{user, token}`
3. 前端 `cp .env.example .env.local && pnpm dev`，浏览器 `http://localhost:3000` 用 `admin@hermes.ai / admin123` 登录 → 跳转 `/dashboard`，刷新不掉线

# Hermes Console 部署指南

一份页可跑通的生产部署手册。

## TL;DR

```bash
# 1. 克隆到目标服务器（与 Hermes agent 容器同宿主机）
git clone <repo> /root/hermes/hermes_console_remote
cd /root/hermes/hermes_console_remote

# 2. 配置环境变量
cp .env.example .env                         # 前端
cp backend/.env.example backend/.env         # 后端（必改 ADMIN_PASSWORD、API_KEY）

# 3. 生成强随机 API_KEY
API_KEY=$(openssl rand -hex 24)
sed -i "s/^API_KEY=.*/API_KEY=${API_KEY}/" backend/.env
sed -i "s/^REMOTE_SERVER_API_KEY=.*/REMOTE_SERVER_API_KEY=${API_KEY}/" .env

# 4. 构建并启动
docker compose up -d --build

# 5. 验证
curl http://localhost:8080/health | jq
# 浏览器打开 http://<server>:3000
```

默认管理员 `admin@hermes.ai / admin123` —— **上线前必改** `backend/.env` 的 `ADMIN_PASSWORD`。

---

## 架构

```
┌──────────────────────────────────────────────────────────────┐
│  宿主机 (43.173.76.121)                                       │
│                                                                │
│  ┌────────────────┐         ┌─────────────────┐               │
│  │ frontend :3000 │ ───────▶│ backend :8080    │              │
│  │ (Next.js)       │         │ (FastAPI)       │               │
│  └────────────────┘         └────────┬────────┘               │
│                                      │                          │
│                                      ├─ /var/run/docker.sock   │
│                                      │                          │
│                                      ▼                          │
│         ┌──────────────────────────────────────┐               │
│         │ hermes-agent-main    hermes-agent-X  │               │
│         │ hermes-agent-reddit  ...             │               │
│         └──────────────────────────────────────┘               │
│                                                                │
│         /root/hermes/                                          │
│           hermes_agent_*/                ← 每个 agent 的宿主目录 │
│           hermes_console_remote/         ← 本仓库               │
└──────────────────────────────────────────────────────────────┘
```

**关键约束**：backend **必须**与 Hermes agent 容器同宿主（因为共享 docker socket + `/root/hermes`）。frontend 可选跨机部署，但最简单还是同机。

---

## 环境变量清单

### `backend/.env` 必填项

| 变量 | 说明 |
|---|---|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 内置管理员；**上线前务必改密码** |
| `API_KEY` | 后端与前端的共享 token；用 `openssl rand -hex 24` 生成。**留空相当于匿名暴露 Docker 控制权**，生产必设 |
| `ALLOWED_ORIGINS` | 前端地址，逗号分隔。如 `https://console.example.com` |
| `HERMES_AGENT_ROOT` | 所有 agent 宿主目录的根；要与 `init_agent.sh` 里的路径一致。默认 `/root/hermes` |
| `HERMES_TIMEZONE` | cron 时区，默认 `Asia/Shanghai` |

### `backend/.env` 可选项

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `8080` | 后端监听端口 |
| `TOKEN_TTL_HOURS` | `168` | 登录 token 过期（小时） |
| `HERMES_LABEL_KEY` / `HERMES_LABEL_VALUE` | `hermes.agent=true` | 识别 agent 的 label |
| `HERMES_NAME_PREFIX` | `hermes-` | 兜底识别的容器名前缀 |
| `HERMES_SKILLS_DIR` | `/root/.claude/skills` | agent 容器内技能目录默认值 |
| `HERMES_TASK_HANDLER` | `/hermes/run-task.sh` | cron 到点时执行的脚本默认值 |
| `HERMES_AGENT_IMAGE` | `nousresearch/hermes-agent:latest` | 创建新 agent 时使用的镜像 |
| `HERMES_CONTAINER_UID` / `HERMES_CONTAINER_GID` | `10000` | 容器内 hermes 用户 UID/GID |

### 根 `.env`（前端）

| 变量 | 说明 |
|---|---|
| `REMOTE_SERVER_URL` | 后端地址。compose 部署时写 `http://backend:8080`；开发调试写 `http://localhost:8080` |
| `REMOTE_SERVER_API_KEY` | 与 `backend/.env` 的 `API_KEY` **完全一致** |

---

## Agent 端改造

要让你现有/未来的 agent 被平台完整识别，容器要带这些 label：

```bash
docker run -d --name hermes-main \
  --label hermes.agent=true \
  --label hermes.id=main \
  --label hermes.name=主控Agent \
  --label hermes.shortName=主 \
  --label hermes.role="主 Agent / 协调者" \
  --label hermes.level=ceo \
  --label hermes.model="Hermes Agent Latest" \
  --label hermes.avatarColor=#3B82F6 \
  # 可选：覆盖技能目录 / 任务入口脚本
  --label hermes.skillsDir=/root/.claude/skills \
  --label hermes.taskHandler=/hermes/run-task.sh \
  nousresearch/hermes-agent:latest ...
```

**如果用平台的 `POST /agents` 创建**，上面这些 label 会自动打好，不需要手动加。

对于阶段 7 的定时任务，agent 镜像里需要有一个脚本来接收 task name 并路由：

```bash
# 参考 backend/scripts/run-task.sh.example
# 放到 agent 镜像的 /hermes/run-task.sh 并 chmod +x
```

---

## 安全清单

- [ ] `ADMIN_PASSWORD` 已改（不再是 `admin123`）
- [ ] `API_KEY` 已设成 24 字节随机串
- [ ] 前端和后端的 `REMOTE_SERVER_API_KEY` / `API_KEY` 一致
- [ ] `ALLOWED_ORIGINS` 限定到真实前端域名，不用 `*`
- [ ] 如暴露到公网：
  - [ ] 在前面套 nginx / caddy 反代并上 TLS
  - [ ] 只暴露 `:3000`（前端），`:8080`（后端）留在内网
  - [ ] 考虑加基本的 IP 白名单或 SSO
- [ ] 服务器防火墙只放行 22 + 80 + 443
- [ ] 备份：生产数据目前**没持久化**（阶段 6/7 任务记录重启丢失）；若不能接受，联系实现 SQLite 持久层

---

## 常用操作

### 启动 / 停止 / 更新

```bash
cd /root/hermes/hermes_console_remote

# 拉最新代码 + 重建
git pull
docker compose up -d --build

# 仅重启后端（拉新镜像用）
docker compose up -d --build backend

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 停服务但保留镜像
docker compose stop

# 完全销毁（镜像保留在本地）
docker compose down
```

### 健康检查

```bash
# 后端健康
curl -s http://localhost:8080/health | jq

# 列出所有 Hermes agent（需要 API_KEY）
curl -s -H "Authorization: Bearer ${API_KEY}" http://localhost:8080/agents | jq

# 后端交互式文档
open http://<host>:8080/docs
```

### 创建 Agent（绕开未完成的前端表单）

```bash
curl -X POST http://localhost:8080/agents \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "reddit_g02",
    "telegramBotToken": "<TG_BOT_TOKEN>",
    "openaiApiKey": "sk-or-v1-<...>",
    "apiModel": "moonshotai/kimi-k2.5",
    "displayName": "Reddit G02",
    "shortName": "R",
    "role": "Reddit 运营",
    "level": "director",
    "reportsTo": "main",
    "openaiBaseUrl": "https://openrouter.ai/api/v1"
  }' | jq
```

### 排查容器不被识别

如果 `GET /agents` 看不到某个容器：

```bash
# 1. 确认 label
docker inspect hermes-<name> --format '{{json .Config.Labels}}' | jq

# 2. 必须有 hermes.agent=true （或容器名以 hermes- 开头做兜底）
# 3. 如果 label 缺失，用 POST /agents 重新创建（会自动打齐）
#    或 docker stop + docker rm + 原脚本重建时手动加 --label
```

---

## 已知限制

- **数据不持久化**：任务历史、定时任务、内存用户在后端重启后丢失（这是阶段 0-9 的明确约定；接 SQLite 是独立增量）
- **前端 `/dashboard/new-agent` 表单**：当前只收集元信息（name/role/model），**缺 secrets 字段**。要从 UI 创建 agent 需要扩展表单，或者用上面的 curl
- **Token / 费用指标**：Hermes agent 未记账，所有相关字段恒为 0
- **指标历史曲线**：只有瞬时快照，想画折线要加时序存储

---

## 回滚

```bash
# 回到上一个版本
cd /root/hermes/hermes_console_remote
git log --oneline -5
git checkout <commit>
docker compose up -d --build
```

镜像历史保留在本地：`docker images | grep hermes-console`，可以直接切 tag 跑旧版。

# Hermes Console Backend

Hermes Agent 管理平台的业务后端，基于 FastAPI，通过 Docker SDK 读写宿主机容器。

## 已完成阶段

### 阶段 0：基础设施

- `/health`：返回服务与 Docker 守护进程连通状态
- `/auth/login`、`/auth/register`、`/auth/me`、`/auth/logout`：基于内存的最小认证

### 阶段 2：Agent 只读列表

- `GET /agents`：扫描所有容器（含停止的），过滤出 Hermes agent 并返回
- `GET /agents/{id}`：按稳定 id / 容器 id / 容器名查找单个 agent

### 阶段 3：Agent 生命周期控制

- `POST /agents/{id}/start`：启动容器；已运行时幂等成功
- `POST /agents/{id}/stop`：SIGTERM（10s 宽限）→ SIGKILL；已停止时幂等成功
- `POST /agents/{id}/restart`：无论当前状态都拉起

所有动作**同步阻塞至 Docker ack**，失败立即返回 5xx。响应格式：
```json
{"success": true, "agent": { /* 动作后最新状态 */ }}
```

暂不做：数据库持久化、密码哈希、RBAC、日志流。

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

## Agent 识别约定（阶段 2）

后端通过 Docker label **识别哪些容器是 Hermes agent**，并从 label 读取元信息。

| Label | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `hermes.agent` | ✅ | 固定为 `true`，识别标记 | `true` |
| `hermes.id` | ⭕ | 稳定 ID（容器重建不变）。缺省则用容器短 ID | `secretary` |
| `hermes.name` | ⭕ | 显示名。缺省则用容器名 | `秘书长` |
| `hermes.shortName` | ⭕ | 单字简称。缺省取 name 首字符 | `秘` |
| `hermes.role` | ⭕ | 角色描述 | `主 Agent / 协调者` |
| `hermes.level` | ⭕ | `ceo` / `director` / `staff`。非法值回退 `staff` | `ceo` |
| `hermes.reportsTo` | ⭕ | 上级 agent 的 `hermes.id` | `secretary` |
| `hermes.model` | ⭕ | 使用的模型 | `Claude Sonnet 4.5` |
| `hermes.avatarColor` | ⭕ | `#RRGGBB`。缺省按 name 哈希派生 | `#3B82F6` |

**兜底识别**：没打 `hermes.agent=true` 但容器名以 `hermes-` 开头的也会被识别。
前缀可通过 `HERMES_NAME_PREFIX` 修改；留空则禁用兜底。

### 创建 agent 容器的标准写法

在你的 "自动创建 bot" 脚本中，把 `docker run` 改成类似：

```bash
docker run -d --name hermes-secretary \
  --label hermes.agent=true \
  --label hermes.id=secretary \
  --label hermes.name=秘书长 \
  --label hermes.shortName=秘 \
  --label hermes.role="主 Agent / 协调者" \
  --label hermes.level=ceo \
  --label hermes.model="Claude Sonnet 4.5" \
  <your-hermes-image>
```

## 阶段 2 验收

```bash
# 1. 启动后端（需要 Docker 可用）
docker compose up -d --build

# 2. 用内置脚本创建 4 个 mock agent（含 1 个已停止）
bash scripts/seed-mock-agents.sh

# 3. 登录取 token（可选；未设 API_KEY 时无需）
curl -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@hermes.ai","password":"admin123"}'

# 4. 列出所有 Hermes agent
curl -s http://localhost:8080/agents | jq
# 期望：4 条记录，按 level 排序（ceo → director → staff）
#       online 3 个、offline 1 个；
#       offline 的那个带 errorMessage 和 stoppedAt

# 5. 查询单个 agent
curl -s http://localhost:8080/agents/secretary | jq
# 期望：返回秘书长详情

# 6. 前端打通（另一个终端）
cp ../.env.example ../.env.local
cd .. && pnpm dev
# 浏览器 http://localhost:3000 登录 → Dashboard
# 期望：
#   ✅ 网格视图显示 4 个 agent
#   ✅ 组织架构图展示 秘书长 → (研究员、文案员、已停止演示) 的层级
#   ✅ 已停止的那个头像灰色 / 状态标 offline
#   ✅ 手动 `docker stop hermes-research`，10 秒内前端状态变 offline

# 清理
bash scripts/seed-mock-agents.sh clean
```

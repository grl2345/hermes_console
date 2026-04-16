#!/usr/bin/env bash
# 一键创建 4 个 mock Hermes agent 容器，用于验证阶段 2 列表展示。
#
# 依赖：本机 docker 可用；容器跑的是 alpine 的 `sleep infinity`，占用极小。
#
# 用法：
#   ./seed-mock-agents.sh          # 创建
#   ./seed-mock-agents.sh clean    # 清理

set -euo pipefail

NAMES=(
  "hermes-secretary"
  "hermes-research"
  "hermes-writer"
  "hermes-stopped"
)

clean() {
  for n in "${NAMES[@]}"; do
    docker rm -f "$n" >/dev/null 2>&1 || true
  done
  echo "已清理 ${#NAMES[@]} 个 mock 容器"
}

if [[ "${1:-}" == "clean" ]]; then
  clean
  exit 0
fi

# 先清理同名容器
clean

# 1) 秘书长：CEO 级
docker run -d --name hermes-secretary \
  --label hermes.agent=true \
  --label hermes.id=secretary \
  --label hermes.name=秘书长 \
  --label hermes.shortName=秘 \
  --label hermes.role="主 Agent / 协调者" \
  --label hermes.level=ceo \
  --label hermes.model="Claude Sonnet 4.5" \
  --label hermes.avatarColor=#3B82F6 \
  alpine:3.20 sleep infinity >/dev/null

# 2) 研究员：staff 级，汇报给 secretary
docker run -d --name hermes-research \
  --label hermes.agent=true \
  --label hermes.id=research \
  --label hermes.name=研究员 \
  --label hermes.shortName=研 \
  --label hermes.role="资料检索与整理" \
  --label hermes.level=staff \
  --label hermes.reportsTo=secretary \
  --label hermes.model="Claude Haiku 4.5" \
  alpine:3.20 sleep infinity >/dev/null

# 3) 文案员：director 级（演示多层级），汇报给 secretary，无 avatarColor 走派生色
docker run -d --name hermes-writer \
  --label hermes.agent=true \
  --label hermes.id=writer \
  --label hermes.name=文案员 \
  --label hermes.shortName=文 \
  --label hermes.role="文章撰写" \
  --label hermes.level=director \
  --label hermes.reportsTo=secretary \
  --label hermes.model="Claude Sonnet 4.5" \
  alpine:3.20 sleep infinity >/dev/null

# 4) 故意停掉一个，演示 offline 状态 + stoppedAt + errorMessage
docker run -d --name hermes-stopped \
  --label hermes.agent=true \
  --label hermes.id=stopped-demo \
  --label hermes.name=已停止演示 \
  --label hermes.shortName=停 \
  --label hermes.level=staff \
  --label hermes.reportsTo=secretary \
  alpine:3.20 sh -c "exit 1" >/dev/null || true

echo "已创建 ${#NAMES[@]} 个 mock Hermes agent："
docker ps -a --filter "label=hermes.agent=true" --format "  {{.Names}}\t{{.Status}}"

echo
echo "验证："
echo "  curl -s http://localhost:8080/agents | jq"
echo
echo "清理：./seed-mock-agents.sh clean"

#!/usr/bin/env bash
# 一键启动（Linux / macOS）
#   功能：① 安装依赖；② 复制 env 模板；③ 编译后端；④ 构建前端；⑤ 启动后端并托管前端 dist
# 前提：本地 MongoDB（默认 mongodb://127.0.0.1:27017/luxeceramics），或在 backend/.env 配置 MONGODB_URI
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

log()  { echo -e "\033[36m▶ \033[1m$1\033[0m"; }
warn() { echo -e "\033[33m[WARN]\033[0m $1"; }

log "Step 1) 安装根工作区依赖…"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund --ignore-scripts
fi

log "Step 2) 准备后端 .env…（已存在则跳过）"
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "backend/.env 已初始化，可按需修改商户地址 / DB / SMTP / TronGRID API KEY。"
fi

log "Step 3) 前端构建（生产）…"
if [ ! -d node_modules ] || [ ! -f frontend/dist/index.html ]; then
  ( cd frontend && npm run build )
fi

log "Step 4) 后端编译 + 启动…（如果不希望自动 seed，请把 backend/.env 中 RUN_SEED_ON_BOOT=false）"
cd backend
# 如果后端还没 node_modules
[ -d node_modules ] || npm install --no-audit --no-fund --ignore-scripts
if [ ! -d dist ]; then
  npx tsc -p tsconfig.json
fi

PORT="${PORT:-5000}"
log "🚀 LuxeCeramics Server starting on http://localhost:$PORT"
exec node dist/index.js

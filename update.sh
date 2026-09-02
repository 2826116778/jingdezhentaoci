#!/usr/bin/env bash
# ============================================================================
# LuxeCeramics 轻量更新脚本（生产环境代码迭代用）
#
# 适用场景：已用 deploy.sh 完成首次部署后，pull 新代码并 rebuild + restart
#
# 与 deploy.sh 区别：
#   - 不装系统包、不装 Node.js、不申请 HTTPS 证书
#   - 不重写 Nginx 配置、不动 PM2 startup
#   - 只做：git pull → npm install → build → pm2 restart
#
# 用法：
#   sudo ./update.sh                       # 更新前后端
#   sudo ./update.sh --skip-frontend       # 只更新后端（前端无改动时）
#   sudo ./update.sh --skip-deps           # 跳过 npm install（仅代码改动）
# ============================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PM2_APP_NAME="luxeceramics-backend"

SKIP_FRONTEND=0
SKIP_DEPS=0
for arg in "$@"; do
  case "$arg" in
    --skip-frontend) SKIP_FRONTEND=1 ;;
    --skip-deps)     SKIP_DEPS=1 ;;
    --help|-h)
      grep -E '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
  esac
done

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
err()  { echo -e "${RED}✗ $1${NC}" >&2; }

# 预检：必须 root 或 sudo（pm2 全局命令常需要）
if [ $EUID -ne 0 ] && ! sudo -n true 2>/dev/null; then
  warn "建议用 sudo 运行（pm2 全局命令可能需要权限）"
fi

START_TIME=$(date +%s)
log "LuxeCeramics 代码更新开始"
echo "项目目录: $PROJECT_DIR"
echo ""

# ---------- 1. git pull ----------
log "步骤 1/4：拉取最新代码"
cd "$PROJECT_DIR"
PREV_HEAD=$(git rev-parse --short HEAD)
if ! git pull --ff-only origin main 2>/dev/null; then
  warn "git pull --ff-only 失败，可能有本地未提交改动，尝试普通 pull..."
  git pull origin main
fi
NEW_HEAD=$(git rev-parse --short HEAD)
if [ "$PREV_HEAD" = "$NEW_HEAD" ]; then
  warn "代码无更新（HEAD 仍为 $NEW_HEAD），仅重启服务"
else
  ok "代码已更新：$PREV_HEAD → $NEW_HEAD"
  git log --oneline "$PREV_HEAD..$NEW_HEAD" | head -10
fi
echo ""

# ---------- 2. 安装依赖 ----------
if [ $SKIP_DEPS -eq 0 ]; then
  log "步骤 2/4：安装依赖"
  cd "$BACKEND_DIR"
  if [ -f package-lock.json ]; then
    npm ci --omit=dev --no-audit --no-fund > /dev/null 2>&1 || npm install --no-audit --no-fund --ignore-scripts > /dev/null
  fi
  ok "后端依赖已更新"

  if [ $SKIP_FRONTEND -eq 0 ]; then
    cd "$FRONTEND_DIR"
    if [ -f package-lock.json ]; then
      npm ci --no-audit --no-fund > /dev/null 2>&1 || npm install --no-audit --no-fund --ignore-scripts > /dev/null
    fi
    ok "前端依赖已更新"
  fi
else
  warn "步骤 2/4：跳过依赖安装（--skip-deps）"
fi
echo ""

# ---------- 3. 构建 ----------
log "步骤 3/4：构建"
cd "$BACKEND_DIR"
npm run build > /dev/null 2>&1 || { err "后端构建失败"; npm run build; exit 1; }
ok "后端构建完成"

if [ $SKIP_FRONTEND -eq 0 ]; then
  cd "$FRONTEND_DIR"
  npm run build > /dev/null 2>&1 || { err "前端构建失败"; npm run build; exit 1; }
  ok "前端构建完成"
else
  warn "跳过前端构建（--skip-frontend）"
fi
echo ""

# ---------- 4. 重启 PM2 ----------
log "步骤 4/4：重启 PM2 后端"
if ! command -v pm2 &> /dev/null; then
  err "pm2 未安装，无法自动重启"
  err "手动启动：cd $BACKEND_DIR && node dist/index.js"
  exit 1
fi
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env > /dev/null
  ok "PM2 应用 $PM2_APP_NAME 已重启"
else
  warn "PM2 应用 $PM2_APP_NAME 不存在，新启动..."
  cd "$BACKEND_DIR"
  pm2 start dist/index.js --name "$PM2_APP_NAME" --cwd "$BACKEND_DIR" > /dev/null
  pm2 save > /dev/null 2>&1 || true
  ok "PM2 应用 $PM2_APP_NAME 已启动"
fi

# ---------- 健康检查 ----------
sleep 2
if curl -sf http://127.0.0.1:5000/healthz > /dev/null 2>&1; then
  ok "健康检查通过"
else
  err "健康检查失败，查看日志：pm2 logs $PM2_APP_NAME --lines 50"
  exit 1
fi

# ---------- 完成 ----------
ELAPSED=$(( $(date +%s) - START_TIME ))
echo ""
echo -e "${GREEN}=== 更新完成（用时 ${ELAPSED}s）===${NC}"
echo ""
echo "  常用命令："
echo "    pm2 logs $PM2_APP_NAME --lines 50   # 查看实时日志"
echo "    pm2 status                          # 查看进程状态"
echo "    sudo nginx -t && sudo systemctl reload nginx  # 改 Nginx 后重载"

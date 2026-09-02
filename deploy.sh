#!/usr/bin/env bash
# ============================================================================
# LuxeCeramics 一键生产部署脚本 (Ubuntu 20.04/22.04/24.04)
#
# 覆盖流程：系统依赖 → Node.js 20 → PM2 → 项目依赖 → 前后端构建
#           → .env 配置校验 → PM2 启动 → Nginx 反代 → Let's Encrypt HTTPS
#
# 使用方式：
#   sudo ./deploy.sh                              # 交互式询问域名/邮箱
#   sudo DOMAIN=ceramic.com EMAIL=me@x.com ./deploy.sh   # 非交互模式
#   sudo ./deploy.sh --skip-https                 # 跳过证书申请
#
# 幂等：重复运行不会破坏现有配置，已装依赖会自动跳过
# ============================================================================
set -euo pipefail

# ---------- 配置 ----------
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_ENTRY="$BACKEND_DIR/dist/index.js"
PM2_APP_NAME="luxeceramics-backend"
NGINX_SITE="luxeceramics"
SKIP_HTTPS=0

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${CYAN}▶ ${BOLD}$1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
err()  { echo -e "${RED}✗ $1${NC}" >&2; }

# ---------- 解析命令行参数 ----------
for arg in "$@"; do
  case "$arg" in
    --skip-https) SKIP_HTTPS=1 ;;
    --help|-h)
      grep -E '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
  esac
done

# ---------- 预检 ----------
[[ $EUID -ne 0 ]] && { err "请用 root 或 sudo 运行：sudo ./deploy.sh"; exit 1; }
[[ ! -f "$PROJECT_DIR/package.json" ]] && { err "请在项目根目录运行此脚本"; exit 1; }
if ! command -v apt-get &> /dev/null; then
  err "本脚本仅支持 Debian/Ubuntu 系统"
  err "如使用 CentOS/RHEL，请手动安装 nginx + nodejs + pm2 + certbot 后再运行构建步骤"
  exit 1
fi

log "LuxeCeramics 生产部署脚本启动"
echo "项目目录: $PROJECT_DIR"
echo ""

# ============================================================================
# 阶段 1：系统依赖
# ============================================================================
log "阶段 1/7：安装系统依赖"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl git nginx ufw ca-certificates gnupg lsb-release \
  python3 python3-pip software-properties-common \
  build-essential > /dev/null
ok "基础系统包已就绪"

# 防火墙（幂等：已存在规则不会报错）
ufw allow OpenSSH  > /dev/null 2>&1 || true
ufw allow 'Nginx Full' > /dev/null 2>&1 || true
yes | ufw enable  > /dev/null 2>&1 || ok "防火墙已启用"

# ============================================================================
# 阶段 2：Node.js 20 LTS + PM2 + Certbot
# ============================================================================
log "阶段 2/7：Node.js / PM2 / Certbot"

if ! command -v node &> /dev/null || [[ "$(node -v 2>/dev/null | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  warn "未检测到 Node.js 20+，安装 Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null
fi
ok "Node.js $(node -v)"

if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 > /dev/null 2>&1
fi
ok "PM2 $(pm2 --version 2>/dev/null || echo 'installed')"

if ! command -v certbot &> /dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1 || \
    warn "certbot 安装失败，可用 --skip-https 跳过 HTTPS 步骤"
fi
if command -v certbot &> /dev/null; then
  ok "Certbot $(certbot --version 2>&1 | awk '{print $2}')"
else
  warn "Certbot 未安装（HTTPS 阶段将跳过）"
fi

# ============================================================================
# 阶段 3：项目依赖 + 构建
# ============================================================================
log "阶段 3/7：安装项目依赖 + 构建前后端"

cd "$PROJECT_DIR"
[ -d node_modules ] || npm install --no-audit --no-fund --ignore-scripts > /dev/null 2>&1 || true

cd "$BACKEND_DIR"
if [ ! -d node_modules ]; then
  warn "安装后端依赖（首次较慢）..."
  npm install --no-audit --no-fund --ignore-scripts > /dev/null
fi
warn "编译后端 TypeScript..."
npm run build > /dev/null
[ -f "$BACKEND_ENTRY" ] || { err "后端构建失败：$BACKEND_ENTRY 不存在"; exit 1; }
ok "后端构建完成"

cd "$FRONTEND_DIR"
if [ ! -d node_modules ]; then
  warn "安装前端依赖（首次较慢）..."
  npm install --no-audit --no-fund --ignore-scripts > /dev/null
fi
warn "构建前端生产包..."
npm run build > /dev/null
[ -f "$FRONTEND_DIR/dist/index.html" ] || { err "前端构建失败：dist/index.html 不存在"; exit 1; }
ok "前端构建完成"

# ============================================================================
# 阶段 4：.env 配置
# ============================================================================
log "阶段 4/7：检查 backend/.env"

if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  warn "已从 .env.example 创建 backend/.env"
fi

# 检查关键生产配置
ENV_FILE="$BACKEND_DIR/.env"
warn_if_default() {
  local key="$1" default_pattern="$2" hint="$3"
  local val
  val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2-)
  if [[ -z "$val" || "$val" =~ $default_pattern ]]; then
    warn "  $key 仍为默认/空值 → $hint"
    return 1
  fi
  return 0
}

ENV_INCOMPLETE=0
warn_if_default MONGODB_URI 'mongodb://127.0.0.1' "请配置 MongoDB Atlas 连接串 mongodb+srv://..." || ENV_INCOMPLETE=1
warn_if_default JWT_SECRET 'CHANGE_ME' "请运行 openssl rand -hex 32 生成强随机串" || ENV_INCOMPLETE=1
warn_if_default ADMIN_DEFAULT_PASSWORD 'admin123' "请改默认管理员密码" || ENV_INCOMPLETE=1
warn_if_default TRONGRID_API_KEY '' "生产环境强烈建议申请 https://www.trongrid.io API Key" || ENV_INCOMPLETE=1
warn_if_default MERCHANT_WALLET_TRON 'TC7TFRfTrhEk85dXeyfghM5hqFq9HRXabU' "请改成你自己的 USDT 收款钱包" || ENV_INCOMPLETE=1

# TRON_NETWORK 必须是 mainnet
TRON_NET=$(grep -E "^TRON_NETWORK=" "$ENV_FILE" | tail -1 | cut -d= -f2)
if [[ "$TRON_NET" != "mainnet" ]]; then
  warn "  TRON_NETWORK=$TRON_NET → 生产环境应设为 mainnet，否则客户付款会丢钱"
  ENV_INCOMPLETE=1
fi

if [ $ENV_INCOMPLETE -eq 1 ]; then
  warn ""
  warn "backend/.env 仍有未完成配置，请用 nano/vi 编辑后重新运行此脚本："
  warn "  nano $ENV_FILE"
  warn "完成后保存退出，脚本会跳过已完成步骤，仅做剩余工作。"
  exit 2
fi
ok ".env 关键配置已就绪"

# ============================================================================
# 阶段 5：PM2 启动后端 + 开机自启
# ============================================================================
log "阶段 5/7：PM2 启动后端服务"

cd "$BACKEND_DIR"
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
  warn "PM2 应用 $PM2_APP_NAME 已存在，重启..."
  pm2 restart "$PM2_APP_NAME" --update-env > /dev/null
else
  pm2 start "$BACKEND_ENTRY" --name "$PM2_APP_NAME" --cwd "$BACKEND_DIR" > /dev/null
fi
pm2 save > /dev/null 2>&1 || true

# 开机自启（首次运行会输出一段命令需手动执行）
if ! systemctl is-enabled pm2-root > /dev/null 2>&1; then
  warn "首次配置 PM2 开机自启，按提示执行下面输出的命令："
  pm2 startup systemd 2>&1 | grep -E "sudo|systemctl" | head -3 || true
fi

# 健康检查
sleep 3
if curl -sf http://127.0.0.1:5000/healthz > /dev/null 2>&1; then
  ok "后端健康检查通过 (http://127.0.0.1:5000/healthz)"
else
  err "后端健康检查失败，查看日志：pm2 logs $PM2_APP_NAME --lines 50"
  exit 1
fi

# ============================================================================
# 阶段 6：Nginx 反代
# ============================================================================
log "阶段 6/7：Nginx 反代配置"

if [ -z "${DOMAIN:-}" ]; then
  read -rp "请输入你的域名（如 ceramic.example.com，留空则用 IP 访问）: " DOMAIN
fi

SITE_CONF="/etc/nginx/sites-available/$NGINX_SITE"
if [ -n "$DOMAIN" ]; then
  cat > "$SITE_CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 10M;

    # 静态上传目录（产品/案例图片）
    location /uploads/ {
        alias $BACKEND_DIR/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 反代到后端（含 SPA fallback）
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
else
  cat > "$SITE_CONF" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 10M;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  warn "未配置域名，使用 IP 直连（HTTP），无 HTTPS"
fi

ln -sf "$SITE_CONF" "/etc/nginx/sites-enabled/$NGINX_SITE"
rm -f /etc/nginx/sites-enabled/default

if nginx -t 2> /dev/null; then
  systemctl reload nginx
  ok "Nginx 配置生效"
else
  err "Nginx 配置语法错误，请检查 $SITE_CONF"
  nginx -t
  exit 1
fi

# ============================================================================
# 阶段 7：Let's Encrypt HTTPS
# ============================================================================
log "阶段 7/7：申请 Let's Encrypt HTTPS 证书"

if [ $SKIP_HTTPS -eq 1 ]; then
  warn "已通过 --skip-https 跳过 HTTPS 申请，可后续手动运行：certbot --nginx -d $DOMAIN"
elif [ -z "$DOMAIN" ]; then
  warn "无域名，跳过 HTTPS（建议配置域名后运行：certbot --nginx -d your-domain）"
elif ! command -v certbot &> /dev/null; then
  warn "certbot 未安装，跳过 HTTPS。可手动装：apt install certbot python3-certbot-nginx"
else
  if [ -z "${EMAIL:-}" ]; then
    read -rp "请输入 Let's Encrypt 通知邮箱（用于证书过期提醒）: " EMAIL
  fi
  if [ -n "$EMAIL" ]; then
    warn "申请证书中（DNS 必须已解析到本机，否则会失败）..."
    if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --redirect --non-interactive; then
      ok "HTTPS 证书已申请并自动续期"
    else
      err "证书申请失败，请检查："
      err "  1. DNS A 记录是否已指向本机 IP：dig +short $DOMAIN"
      err "  2. 80 端口是否被防火墙拦截：ufw status"
      err "可稍后手动运行：certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    fi
  fi
fi

# ============================================================================
# 完成
# ============================================================================
echo ""
echo -e "${GREEN}${BOLD}=== 部署完成 ===${NC}"
echo ""
if [ -n "$DOMAIN" ]; then
  echo -e "  访问地址：  ${CYAN}https://$DOMAIN${NC}"
else
  PUB_IP=$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || echo "YOUR_VPS_IP")
  echo -e "  访问地址：  ${CYAN}http://$PUB_IP${NC}"
fi
echo ""
echo "  常用运维命令："
echo "    pm2 status                          # 查看进程状态"
echo "    pm2 logs $PM2_APP_NAME --lines 100   # 看后端日志"
echo "    pm2 restart $PM2_APP_NAME           # 重启后端"
echo "    sudo nginx -t && sudo systemctl reload nginx   # 改 Nginx 后重载"
echo "    sudo certbot renew --dry-run        # 测试证书续期"
echo ""
echo "  更新代码流程（在 VPS 上）："
echo "    cd $PROJECT_DIR && git pull"
echo "    cd backend && npm install && npm run build && pm2 restart $PM2_APP_NAME"
echo "    cd ../frontend && npm install && npm run build"
echo ""
echo "  下一步："
echo "    1. 用 admin / .env 中的密码登录后台，立即改密码"
echo "    2. 在 MongoDB Atlas 后台限制 IP 白名单为本 VPS IP"
echo "    3. 把 RUN_SEED_ON_BOOT 改为 false 避免每次重启覆盖数据"

# jingdezhentaoci — LuxeCeramics 高端陶瓷跨境电商

面向中东/海外客户的高端陶瓷（景德镇）电商系统，支持 USDT-TRC20 链上自动收款、外贸业务工作台（CRM/Lead 开发）、AI 客户研究等功能。

## 技术栈

- **后端**：Node.js 20 + TypeScript + Express + Mongoose + JWT
- **前端**：React 18 + Vite + TypeScript + TailwindCSS + i18next（中/英/阿三语）
- **数据库**：MongoDB（生产推荐 MongoDB Atlas）
- **支付**：USDT-TRC20 链上自动匹配（TronGrid API + cron 轮询）
- **部署**：PM2 + Nginx + Let's Encrypt HTTPS

## 项目结构

```
jingdezhentaoci/
├── backend/                # 后端 Express + TS
│   ├── src/
│   │   ├── config/         # 环境变量、DB、上传配置
│   │   ├── models/         # Mongoose 模型（Order/Product/Lead/Customer 等）
│   │   ├── routes/         # Express 路由（auth/orders/console/ai 等）
│   │   ├── middleware/     # JWT 鉴权、限流、错误处理
│   │   ├── jobs/           # cron 任务（支付匹配、过期扫描）
│   │   ├── ai/             # AI Provider（mock/OpenAI）
│   │   └── seed/           # 首次启动 seed 数据
│   └── .env.example        # 环境变量模板
├── frontend/               # 前端 React + Vite
│   ├── src/pages/          # 页面（Home/Cart/Checkout/Console 等）
│   └── src/api/             # API 调用封装
├── deploy.sh               # 一键生产部署脚本
├── update.sh               # 轻量代码更新脚本
└── README.md
```

## 一键生产部署（推荐）

在 Ubuntu 20.04+ VPS 上：

```bash
# 1. 拉代码
git clone https://github.com/2826116778/jingdezhentaoci.git
cd jingdezhentaoci

# 2. 配置生产 .env（必须，否则脚本会拒绝继续）
cp backend/.env.example backend/.env
nano backend/.env
# 重点改：MONGODB_URI / JWT_SECRET / ADMIN_DEFAULT_PASSWORD
#         TRON_NETWORK=mainnet / TRONGRID_API_KEY / MERCHANT_WALLET_TRON

# 3. DNS A 记录指向 VPS 后运行部署脚本
sudo DOMAIN=你的域名.com EMAIL=你的邮箱 ./deploy.sh
```

脚本自动完成：系统依赖 → Node.js 20 → PM2 → 前后端构建 → .env 校验 → PM2 启动 → Nginx 反代 → Let's Encrypt HTTPS。

详见 [deploy.sh](deploy.sh) 顶部注释。

## 后续代码更新

```bash
# 拉新代码 + 重装依赖 + 重建 + 重启（轻量，不动 Nginx/证书）
sudo ./update.sh

# 只更新后端（前端无改动时）
sudo ./update.sh --skip-frontend

# 跳过依赖安装（仅代码改动）
sudo ./update.sh --skip-deps
```

## 本地开发

```bash
# 后端
cd backend
npm install
npm run dev        # ts-node-dev 热重载，默认端口 5000

# 前端（另开终端）
cd frontend
npm install
npm run dev        # Vite dev server，默认端口 5173，自动代理到后端
```

无本地 MongoDB 时，后端会自动启动 [mongodb-memory-server](https://github.com/nodkz/mongodb-memory-server)（进程内 ephemeral 实例，重启即丢，仅用于开发）。

## 关键配置说明

| 配置项 | 说明 |
|--------|------|
| `MONGODB_URI` | 生产推荐 MongoDB Atlas，URL 末尾带 `&dbName=luxeceramics` |
| `JWT_SECRET` | 至少 32 字符，用 `openssl rand -hex 32` 生成 |
| `TRON_NETWORK` | **生产必须 `mainnet`**，否则客户付款会丢钱 |
| `TRONGRID_API_KEY` | 在 https://www.trongrid.io 免费申请 |
| `MERCHANT_WALLET_TRON` | 你的 USDT 收款钱包地址 |
| `RUN_SEED_ON_BOOT` | 首次 `true`（初始化 admin/产品），稳定后改 `false` |

## 安全要点

- `backend/.env` 已在 `.gitignore` 中，**绝不** push 到 GitHub
- 首次启动后立即登录后台改 admin 密码
- MongoDB Atlas 后台限制 IP 白名单为 VPS IP
- 配置 Cloudflare CDN 隐藏 VPS 真实 IP（可选但推荐）

## 文档

- [部署脚本 deploy.sh](deploy.sh) — 一键生产部署
- [更新脚本 update.sh](update.sh) — 轻量代码迭代
- [后端环境变量模板 backend/.env.example](backend/.env.example) — 含详细中文注释
- [OPERATION.md](OPERATION.md) — 运维操作手册
- [PRD.md](PRD.md) — 产品需求文档
- [DEPLOYMENT.md](DEPLOYMENT.md) — 部署详细文档

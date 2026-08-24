# LuxeCeramics —— 部署文档 DEPLOYMENT.md

> 高端定制陶瓷外贸独立站（React18 + Vite + TS + Tailwind） / 后端（Node.js + Express + MongoDB + Tron 链上收款）
> 项目代号：LuxeCeramics

---

## 0. 前置要求

| 组件 | 推荐版本 | 备注 |
| --- | --- | --- |
| Node.js | **>= 18.17 LTS** | 建议 20.x |
| npm | >= 9.x (node 自带) | 或 pnpm/yarn（脚本使用 npm） |
| MongoDB | >= 6.0 (4.4+ 均可) | 本地 / Atlas 均可 |
| （可选）SMTP | - | 询盘邮件通知；否则使用 demo 模式写本地 .eml 文件 |
| （可选）TronGrid API Key | 免费申请 | 不填也可用，但有 1 次/秒 速率限制，批量订单匹配会被 429 |

---

## 1. 配置环境变量

复制模板：

```bash
cp backend/.env.example backend/.env
```

必须改的 3 项：

```dotenv
# 1) 数据库（默认本机）
MONGODB_URI=mongodb://127.0.0.1:27017/luxeceramics

# 2) 商户 Tron 钱包（TRC20-USDT 收款地址）
MERCHANT_WALLET_TRON=TC7TFRfTrhEk85dXeyfghM5hqFq9HRXabU

# 3) Tron 链网络（nile=测试网，mainnet=主网）
TRON_NETWORK=nile           # 上线前改为 mainnet

# 4) 对外访问域名（用于支付日志、邮件里的链接、SITE_URL）
SITE_URL=https://your-store.com
CORS_ORIGIN=https://your-store.com

# 5) 后台管理员默认账号密码（首次 seed 自动建）
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=please-change-me_@strong_pwd
JWT_SECRET=请替换为 32 字符以上随机字符串
```

**支付相关（默认即可，按需调整）**

```dotenv
USDT_TOLERANCE=0.01            # 金额允许少 0.01 USDT（防止精度）
REQUIRED_CONFIRMATIONS=6      # 链上确认数（主网建议 12+，测试网 1 就够）
ORDER_TTL_MINUTES=15          # 支付窗口（分钟），过期自动关闭
USD_TO_USDT_RATE=1.0          # 默认 1:1
```

**邮件（默认 demo）**

```dotenv
EMAIL_MODE=demo              # demo 写到 logs/inquiry-emails，生产改 smtp
```

---

## 2. 单机部署（一台服务器：前端由后端静态托管）

这是**推荐最小化部署形态**，前端 `/api` 同源访问，避免跨域/回调端口问题。

```bash
# A. 安装
cd project-root
npm install --no-audit --no-fund --ignore-scripts

# B. 构建前端
cd frontend && npm run build && cd ..

# C. 编译后端（输出 backend/dist/*.js）
cd backend
npm install --no-audit --no-fund --ignore-scripts
npx tsc -p tsconfig.json

# D. 首次播种后台账号 + Mock 产品/案例（可选）
#    已在 backend/src/index.ts bootstrap() 里自动执行一次（幂等）
#    如需手动：node dist/seed/seedData.js

# E. 启动
PORT=5000 node dist/index.js
```

此时：

```
HTTP 5000：
  前端页面： https://HOST/           (托管 frontend/dist)
  API：      https://HOST/api/*
  图片：     https://HOST/uploads/*
```

### 2.1 Nginx 反代（HTTPS + 域名）

```nginx
server {
  listen 80;
  server_name your-store.com;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl http2;
  server_name your-store.com;

  ssl_certificate     /etc/letsencrypt/live/your-store.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-store.com/privkey.pem;

  # 单页应用首屏：上传/API 走后端，其它交给前端 dist
  client_max_body_size 50m;  # 产品图 / 询盘附件

  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### 2.2 systemd 守护

```ini
# /etc/systemd/system/luxeceramics.service
[Unit]
Description=LuxeCeramics Node Server
After=network.target mongod.service

[Service]
Type=simple
User=www
WorkingDirectory=/srv/luxeceramics/backend
Environment=NODE_ENV=production
EnvironmentFile=/srv/luxeceramics/backend/.env
ExecStart=/usr/bin/node /srv/luxeceramics/backend/dist/index.js
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable luxeceramics --now
journalctl -u luxeceramics -f
```

---

## 3. 前后端分离部署（可选）

- 前端：Vercel / Cloudflare Pages / OSS + CDN
  - 环境变量设置 `VITE_API_BASE=https://api.your-store.com/api`（需要自行封装 axios baseURL）
  - *当前代码只用相对路径 `/api/*`，请在部署时把 `/api/*` 路径转发到后端或改 api/index.ts baseURL。*
- 后端：同 2.1，但去掉 dist 静态托管即可（代码里如果不存在 dist 会自动跳过）。

> ⚠️ 支付回调与定时匹配不依赖前端域名，因此部署形态不影响支付链路，只要生产环境 `CORS_ORIGIN` 放行前端域名即可。

---

## 4. Docker（可选）

```dockerfile
# Dockerfile
FROM node:20-alpine AS build-front
WORKDIR /app
COPY frontend ./frontend
COPY package*.json ./
RUN npm install --no-audit --no-fund --ignore-scripts \
    && cd frontend && npm install --no-audit --no-fund --ignore-scripts \
    && npm run build

FROM node:20-alpine AS build-back
WORKDIR /app
COPY backend ./backend
COPY --from=build-front /app/frontend/dist ./backend/public/dist
RUN cd backend && npm install --no-audit --no-fund --ignore-scripts \
    && npx tsc -p tsconfig.json

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build-back /app/backend /app/backend
RUN mkdir -p logs public/uploads && chown -R node:node logs public
USER node
EXPOSE 5000
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml 示例（略）
```

---

## 5. 首次登录后台

1. 打开 `/admin/login`
2. 默认账密：`admin` / `admin123`（或 backend/.env 里 `ADMIN_DEFAULT_USERNAME/PASSWORD`）
3. 登录后进入 Dashboard：可以改产品、案例、导出询盘 CSV。
4. 建议：首次登录后，在 MongoDB 把 Admin 密码改为 bcrypt（可通过“忘记密码”脚本，或在后台先进入后台再用接口改密）。

---

## 6. 生产安全清单（必做）

- [ ] `JWT_SECRET` 随机 32+ 字符，不要用默认值
- [ ] 后台管理员默认密码改掉（不要 `admin123`）
- [ ] `TRON_NETWORK=mainnet` + 商户钱包**私钥只在钱包 App/浏览器插件里保存**，服务端仅放收款 base58 地址即可（代码里确实只读地址，没有私钥字段）✅
- [ ] Nginx 开启 HTTPS；禁止 80 端口明文登录
- [ ] `NODE_ENV=production`；Helmet 会开启（index.ts 已判断）
- [ ] MongoDB 授权用户 & 强密码（Atlas 首选）
- [ ] 询盘附件大小 `UPLOAD_MAX_MB=10`，按需要调；上传目录做病毒扫描（生产建议接入 ClamAV 或 S3 + 扫描）

---

## 7. 测试网 → 主网切换

1. `TRON_NETWORK=mainnet`
2. `MERCHANT_WALLET_TRON` 填主网商户地址（当前项目为 `TC7TFRfTrhEk85dXeyfghM5hqFq9HRXabU`）
3. `REQUIRED_CONFIRMATIONS` 建议 12（或 19）
4. `USDT_CONTRACT_MAINNET=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`（已默认）
5. 做 1 笔小额真实支付（如 $10）验证链路 → 检查 `logs/payments/<orderNo>.log`

---

## 8. 备份/监控

- **数据库**：`mongodump --uri="mongodb://..." --out ./dump`，每日 crontab + 上传对象存储
- **日志**：`backend/logs/` 四个子目录建议做定期打包归档
- **监控**：进程用 systemd + 告警；支付到账建议在邮件/SMTP 外再加企业微信/钉钉 webhook（可在 `utils/email.ts` 扩展）

---

## 🚀 部署到国外服务器指南

### 方式一：从 GitHub 克隆（推荐）

```bash
# 在国外服务器上执行
git clone https://github.com/2826116778/jingdezhentaoci.git
cd jingdezhentaoci

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入实际的生产环境配置

# 构建前端
cd frontend && npm run build && cd ..

# 启动服务
npm start
```

### 方式二：直接上传 zip

1. 从 TRAE 下载项目压缩包
2. 在服务器上解压
3. 按上述步骤安装和配置

### 服务器配置建议

- **Ubuntu 22.04+** 或 **CentOS 8+**
- **Node.js 18+** (推荐 20 LTS)
- **MongoDB 6.0+**
- **Nginx** 反向代理
- **PM2** 进程管理

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### PM2 启动命令

```bash
pm2 start backend/dist/index.js --name luxeceramics
pm2 save
pm2 startup systemd
```

# LuxeCeramics —— 运维说明 OPERATION.md

> 日常运营 / 常见故障排查 / 支付相关 FAQ

---

## 一、目录结构（已交付）

```
/workspace
├── PRD.md                 # 需求文档（v1.1，含支付变更说明）
├── DEPLOYMENT.md          # 部署文档
├── OPERATION.md           # 本文件 — 日常运维说明
├── start.sh / start.bat   # 一键启动脚本
├── package.json           # 根工作区 workspace（scripts 已预留）
├── .env.example           # 根环境变量模板（与 backend 相同，方便 Docker 使用）
├── backend/
│   ├── .env.example       # 后端配置模板
│   ├── .env               # 运行时真实配置
│   ├── logs/              # 运行日志（支付/邮件/到账通知）
│   ├── public/uploads/    # 后台上传图片
│   └── dist/              # tsc 编译产物（生产运行 node dist/index.js）
└── frontend/
    ├── dist/              # vite 生产构建产物（后端托管）
    └── public/locales/    # en/ar 翻译 JSON
```

---

## 二、日常操作速查

### 2.1 启动 / 停止 / 重启

单机启动：
```bash
# Linux / macOS
./start.sh

# Windows
start.bat
```

systemd 管理：
```bash
systemctl start|stop|restart|status luxeceramics
journalctl -u luxeceramics -f          # 实时日志
```

### 2.2 查看支付监控日志

```bash
# 每个订单一份日志（orderNo = 订单号）
ls backend/logs/payments/
tail -n 100 backend/logs/payments/LX-<orderNo>.log
```

字段（自动写入）：
- `AUTO_MATCH` 自动 cron 命中
- `USER_TX_SUBMITTED` 用户在 Checkout 手动提交 TXID
- `PAID` 支付成功
- `EXPIRE_SCAN` 过期扫描
- `VALIDATE_FAIL` 6 校验条件未通过（附失败原因）

### 2.3 询盘导出 CSV（后台一键按钮）

后台菜单左侧：`Export Inquiries` → 自动下载 `inquiries-YYYY-MM-DD.csv`（UTF-8 BOM，Excel 直接可打开）。
也可访问：
```
GET /api/admin/inquiries/export?status=new   (要 Authorization: Bearer <adminToken>)
```

### 2.4 后台账号忘记密码

直接在 MongoDB 里删 admin 记录，重启服务器即会重新 seed 默认账密（需先 `backend/.env` 设好 `ADMIN_DEFAULT_PASSWORD`）：

```js
// mongosh
use luxeceramics;
db.admins.deleteOne({ username: 'admin' });
```
然后：
```bash
systemctl restart luxeceramics
```

---

## 三、故障排查

### 3.1 Checkout 页面“支付已提交但一直 pending”

- 看该订单支付日志：`backend/logs/payments/LX-<orderNo>.log`
- 查 TXID 是否确实转给了正确的商户地址（TRONSCAN 查）：`to`、`contract_address`、金额、确认数
- **TronGrid API 限流（429）**：去 [trongrid.io](https://www.trongrid.io) 申请免费 Key，写到 `backend/.env` 的 `TRONGRID_API_KEY`，即可大大提升限额。
- 仍不行：管理员登录后台 → `/admin` → `Dashboard`，或让用户在 Checkout 里用 “Verify TXID” 按钮手动触发一次校验。

### 3.2 支付成功但后台没显示 Paid

- 唯一索引 `txHash` 的幂等保护：同一 TXID 只允许绑定一个订单。
- 核对订单：`mongosh` → `db.orders.find({txHash:'<HASH>'})` 看 paymentStatus。
- 手动触发一次校验：
  ```
  POST /api/orders/id/:id/verify-tx
  body: { txHash }
  ```
- 如果确实转账正确但因特殊原因未识别：
  - 可后台手动把订单状态改为 paid（`PATCH /api/orders/:id/status` body `{status:'paid'}`，目前 Dashboard 没有界面，但可通过接口）。

### 3.3 询盘没收到通知（SMTP 模式）

- 看日志：`logs/inquiry-emails/` 有 demo 模式的 eml；若 SMTP 出错会写到 `stderr`
- 把 `EMAIL_MODE=demo` 临时开 demo，确认收到后再换回 SMTP
- 常见 SMTP 错误：
  - SSL 端口 465 没开安全组 / STARTTLS 587
  - 2FA 账号需用"应用专用密码"（Gmail / Outlook）

### 3.4 后台上传图片报错

- 目录权限：`backend/public/uploads` 对运行用户可写
- 文件大小：默认 10MB，可改 `UPLOAD_MAX_MB`
- 内存：生产部署时建议加 `-max-old-space-size=2048`（处理大文件）

### 3.5 阿拉伯语显示“从左到右”不正常

- i18n.ts 在切换语言时会设置 `document.documentElement.dir = 'rtl'` 以及 Tailwind `tailwindcss-rtl` 插件
- 若某个组件仍显示异常：可能用了绝对 `left/right/md:me-auto` 之类的固定方向样式，请改到 use start/end（tailwindcss-rtl 会翻转）。

### 3.6 前端页面空白 / 构建成功但打开 404

- 生产部署时一定要把所有 URL 交给后端静态托管；Nginx 不能直接服务 dist，要代理回 node（因为是单页 + API 同源）。

---

## 四、支付链路 6 项校验（排障用）

所有 6 项都通过才会 `status=paid`：

| # | 条件 | 日志标签 | 常见失败原因 |
| - | --- | --- | --- |
| 1 | `contractAddress == USDT` 合约 | CONTRACT_MISMATCH | 转成 TRX / 其他代币 |
| 2 | `ret == SUCCESS` | TX_FAILED | 转账失败（回滚 / 余额不足） |
| 3 | `to == 商户钱包 base58` | TO_MISMATCH | 地址输错、大小写错 |
| 4 | 金额 `usdtAmount - usdtTolerance <= amount <= usdtAmount + 5%` | AMOUNT_MISMATCH | 金额不足（用户少转） |
| 5 | 确认数 `block >= REQUIRED_CONFIRMATIONS` | CONFIRMATION_LOW | 刚转账就查询（等 1-2 分钟） |
| 6 | 交易时间在 [订单创建, 过期] 窗口 | TIME_OUT_OF_RANGE | 订单过期后才转 |

---

## 五、定期维护

| 频率 | 任务 | 方法 |
| - | --- | --- |
| 每日 | 备份 MongoDB | `mongodump --uri ... --out ... && gzip` 上传对象存储 |
| 每周 | 清理 logs 目录（归档 > 30 天） | `tar -zcf logs-$(date +%F).tar.gz logs && rm -rf logs/*` |
| 每月 | 依赖升级 | `npm audit` + 小版本升；重大升级在 staging 先测 |
| 每季 | 后台管理员密码轮换 | MongoDB + JWT_SECRET 一起换（换 JWT_SECRET 会踢所有登录） |

---

## 六、紧急联系人 / 外部链接

- TronScan 主网：https://tronscan.org/
- TronScan 测试网(Nile)：https://nile.tronscan.org/
- TronGrid API Key 申请：https://www.trongrid.io/
- USDT 合约地址（主网/Nile 相同）：`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- 商户钱包地址：`TC7TFRfTrhEk85dXeyfghM5hqFq9HRXabU`

# 高端定制陶瓷外贸独立站 PRD（项目拆解文档）

> 项目代号：LuxeCeramics（卢奢陶瓷）
> 目标市场：中东迪拜（英语/阿拉伯语双语）
> 业务模式：B2B 询盘批发为主 + 少量 B2C 零售 + 工程定制 OEM
> 交付日期：开发中，预计 1 轮完成

---

## 一、技术架构总览（技术栈固定，不可替换）

### 1.1 前端（Frontend）
| 项 | 选型 | 说明 |
|---|---|---|
| 框架 | React 18 + TypeScript | 函数组件 + Hooks |
| 构建工具 | Vite 5 | HMR、速度快、海外访问友好 |
| 样式 | Tailwind CSS 3 | 高端极简轻奢风格，RTL 完整适配 |
| 路由 | react-router-dom v6 | 全部页面路由管理 |
| 国际化 | react-i18next + i18next-browser-languagedetector | 双语（en/ar），自动 LTR/RTL 切换 |
| 状态管理 | 轻量方案：React Context + useState | 项目规模小，不上 Redux |
| UI 图标 | lucide-react | 统一线性图标 |
| 图片展示 | react-image-gallery / 自实现放大镜 | 多图轮播 + 细节放大 |
| HTTP 客户端 | axios | 统一请求/响应拦截 |
| SEO | react-helmet-async | 页面 meta 动态注入 |
| 图片懒加载 | 原生 loading="lazy" + IntersectionObserver 兜底 | |

### 1.2 后端（Backend）
| 项 | 选型 | 说明 |
|---|---|---|
| 运行时 | Node.js 18+ | LTS |
| 框架 | Express 4 | RESTful API |
| 语言 | TypeScript | ts-node / tsc 编译运行 |
| 数据库 | MongoDB + Mongoose 7 | 产品、案例、询盘、订单、用户 |
| 身份鉴权 | JWT (jsonwebtoken + bcryptjs) | 后台登录 |
| 文件上传 | multer | 产品图片、证书图片上传 |
| 邮件通知 | nodemailer | 询盘邮件通知（demo 模式下控制台输出 + 保存到 logs/） |
| 环境变量 | dotenv | .env 配置 |
| CORS | cors | 前后端分离跨域 |

### 1.3 运行方式
- 本地开发：`npm run dev` → 并行启动前端(Vite@5173) + 后端(Express@5000) + MongoDB(本地 27017)
- 一键脚本：`start.sh`（Linux）/ `start.bat`（Windows）自动安装依赖并启动
- 生产：Nginx 反代前端静态资源 + PM2 托管后端

---

## 二、目录结构（交付后的文件布局）

```
/workspace
├── PRD.md                          # 本文件
├── DEPLOYMENT.md                   # 部署文档
├── OPERATION.md                    # 运维说明
├── start.sh                        # 一键启动脚本（Linux/Mac）
├── start.bat                       # 一键启动脚本（Windows）
├── package.json                    # 根工作区 + 统一脚本
├── .env.example                    # 环境变量模板
│
├── frontend/                       # 前端（React18 + Vite + TS）
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js          # 含 RTL 插件
│   ├── postcss.config.js
│   ├── index.html
│   ├── public/
│   │   ├── favicon.ico
│   │   └── locales/                # i18n 翻译资源
│   │       ├── en/translation.json
│   │       └── ar/translation.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── i18n.ts                 # i18next 初始化
│       ├── api/                    # axios 封装 + 所有接口
│       ├── context/                # LanguageContext、AuthContext
│       ├── components/
│       │   ├── layout/             # Navbar, Footer, WhatsAppButton, ProtectedRoute
│       │   ├── common/             # ProductCard, CaseCard, ImageGallery, RTLWrapper
│       │   └── admin/              # AdminLayout, Table, Modal
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── ProductList.tsx
│       │   ├── ProductDetail.tsx
│       │   ├── CaseList.tsx
│       │   ├── OEMService.tsx
│       │   ├── About.tsx
│       │   ├── Contact.tsx
│       │   ├── Checkout.tsx        # U(USDT-TRC20) 支付页
│       │   └── admin/
│       │       ├── Login.tsx
│       │       ├── Dashboard.tsx
│       │       ├── Products.tsx
│       │       ├── Inquiries.tsx
│       │       └── Cases.tsx
│       ├── types/                  # 类型定义
│       └── utils/                  # 工具函数（rtl、seo、whatsapp-link 构造）
│
└── backend/                        # 后端（Express + TS + MongoDB）
    ├── package.json
    ├── tsconfig.json
    ├── .env
    └── src/
        ├── index.ts                # 入口：连接数据库、挂载路由
        ├── config/                 # db连接、jwt、email、upload配置
        ├── models/                 # Mongoose Schema
        │   ├── Product.ts
        │   ├── Case.ts
        │   ├── Inquiry.ts
        │   ├── Order.ts
        │   └── Admin.ts
        ├── routes/                 # 路由 + 控制器（放同文件，小项目保持简洁）
        │   ├── products.ts
        │   ├── cases.ts
        │   ├── inquiries.ts
        │   ├── orders.ts
        │   ├── auth.ts
        │   └── upload.ts
        ├── middleware/             # authJWT、errorHandler
        ├── seed/                   # Mock 数据初始化脚本
        │   └── seedData.ts
        └── utils/                  # email发送器（demo模式）、支付签名工具
```

---

## 三、数据模型（MongoDB Collections）

### 3.1 Product（产品）
```ts
{
  _id: ObjectId,
  sku: string,               // SKU: LUX-001
  nameEn: string,            // 英文名称
  nameAr: string,            // 阿拉伯文名称
  descEn: string,            // 英文简短工艺描述
  descAr: string,            // 阿拉伯文工艺描述
  category: string,          // 品类: tableware | vase | art-sculpture | hotel-ware | tiles
  material: string,          // 材质: bone-china | porcelain | stoneware | ceramic
  glazeColor: string,        // 釉色: matte-gold | celadon | cobalt-blue ...
  size: string,              // 尺寸 "Ø25cm × H8cm"
  images: string[],          // 高清图 URL 数组
  detailImages: string[],    // 细节放大图
  isCustom: boolean,         // 是否接受 OEM 定制
  isStock: boolean,          // 是否现货
  moq: number,               // 起订量
  priceMin: number,          // 起步单价（USD）
  priceMax: number,          // 上限单价
  oemOptions: string[],      // OEM 定制选项：["logo", "shape", "glaze", "packaging"]
  careEn: string,            // 英文保养说明
  careAr: string,            // 阿拉伯文保养说明
  shippingNoteEn: string,    // 英文易碎物流提示
  shippingNoteAr: string,    // 阿拉伯文易碎物流提示
  featured: boolean,         // 首页推荐
  sortOrder: number,
  createdAt, updatedAt
}
```

### 3.2 Case（工程案例）
```ts
{
  _id,
  titleEn, titleAr,
  clientNameEn, clientNameAr, // 客户名称：迪拜帆船酒店等
  locationEn, locationAr,     // 地点
  year: number,               // 项目年份
  category: string,           // hotel | villa | commercial
  coverImage: string,         // 封面大图
  images: string[],           // 更多案例图
  descEn, descAr,             // 项目简介
  scopeEn, scopeAr,           // 陶瓷供应范围
  featured: boolean,
  sortOrder,
  createdAt
}
```

### 3.3 Inquiry（询盘）
```ts
{
  _id,
  name,
  email,
  whatsapp,
  country,
  quantity: number,
  customDemand: string,       // 定制需求
  productId?: ObjectId,       // 关联产品（可为空）
  productName?: string,       // 冗余产品名
  status: 'new'|'read'|'replied'|'closed', // 后台管理
  source: 'contact'|'product'|'quote',
  createdAt
}
```

### 3.4 Order（订单 / 支付模拟）
```ts
{
  _id,
  orderNo: string,            // 自生成: OC20260822xxxxx
  items: [{ productId, name, price, qty }],
  totalAmount: number,        // USD
  usdtAmount: number,         // USDT 金额（按汇率换算）
  contactInfo: { name, email, whatsapp, shippingAddress },
  customDemand: string,
  paymentMethod: 'USDT-TRC20',
  paymentStatus: 'pending'|'paid'|'failed'|'refunded',
  txHash?: string,            // 交易哈希
  walletAddress: string,      // 我方固定收款地址
  createdAt, paidAt?
}
```

### 3.5 Admin（后台管理员）
```ts
{
  username: string,
  passwordHash: string,       // bcrypt
  role: 'superadmin'|'editor',
  createdAt
}
```

---

## 四、后端 API 接口清单

> 统一前缀：`/api`
> 响应封装：`{ code: 0|非0, message: string, data: any }`

### 4.1 Public（公开接口，无需鉴权）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /products | 产品列表（支持 ?category=&material=&isCustom=&isStock=&minPrice=&maxPrice=&keyword=&page=&limit=） |
| GET | /products/:id | 产品详情 |
| GET | /products/featured | 首页推荐产品（前 8 条） |
| GET | /cases | 案例列表 |
| GET | /cases/:id | 案例详情 |
| GET | /cases/featured | 首页案例（前 4 条） |
| POST | /inquiries | 提交询盘 → 保存 DB + 邮件通知 |
| POST | /orders | 创建订单（下单） |
| GET | /orders/:orderNo | 订单状态查询 |
| POST | /orders/:orderNo/pay | 支付回调（模拟：传 txHash 即标记 paid） |
| POST | /auth/login | 后台登录 → { token } |

### 4.2 Admin（需要 JWT：Header Authorization: Bearer xxx）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /auth/me | 获取当前管理员 |
| GET | /inquiries | 询盘列表（分页、可导出 CSV） |
| GET | /inquiries/:id | 询盘详情 |
| PATCH | /inquiries/:id/status | 修改状态 |
| GET | /inquiries/export | 导出 CSV |
| POST | /products | 新增产品 |
| PATCH | /products/:id | 更新产品 |
| DELETE | /products/:id | 删除产品 |
| POST | /cases | 新增案例 |
| PATCH | /cases/:id | 更新案例 |
| DELETE | /cases/:id | 删除案例 |
| POST | /upload | 上传图片 → 返回 URL（multer，本地 public/uploads） |

---

## 五、前端 8 大页面详细需求

### 5.1 首页 Home `/`
- **首屏 Banner**：全屏 100vh，高级陶瓷艺术品大图景（可切换 3 张），中央品牌标语（双语），右上角「Get Quote」CTA
- **品牌简介区**：2 列图文，左文字右图片，品牌故事精简版
- **产品分类入口**：6 大品类卡片（餐桌瓷 / 花瓶 / 艺术雕塑 / 酒店瓷 / 瓷砖 / 全套 OEM），hover 微微抬起，金色边线描边
- **工程案例展示**：4 张案例大图轮播 + 案例名称 & 客户名
- **合作客户 LOGO 墙**：灰度展示 8~12 家酒店/房产商 LOGO，hover 恢复彩色
- **工厂实力**：4 项数字卡片（30+年工艺 / 500+工程 / 20000㎡工厂 / 100%手工）
- **底部 CTA 条**：黑色背景哑光金文字「准备好定制您的陶瓷艺术品了吗？」+ Get Quote 按钮
- **全局元素**：右下角悬浮 WhatsApp 按钮（圆形、哑光金渐变，点击跳转 `wa.me/97150xxxxxxx?text=预设文案`）
- 浮动 CTA：滚动时右下角「快速 Get Quote」

### 5.2 产品列表页 `/products`
- 顶部面包屑
- 左侧筛选栏（移动端折叠）：
  - 品类（多选）
  - 材质（多选）
  - 定制/现货（Radio）
  - 价格区间（Slider 双滑块，USD $50 - $5000）
- 主区网格：
  - 4 列(PC) / 2 列(Pad) / 1 列(Mobile)
  - 卡片：方形图片 + 产品名(双语自动切换) + 工艺描述 1 行 + 价格区间 + 两个按钮：「查看详情 / Inquire Now」
- 右上角排序：价格升序 / 价格降序 / 新品
- **RTL 适配**：切换阿拉伯语后，筛选栏移到右侧，文字右对齐，箭头图标翻转

### 5.3 产品详情页 `/products/:id`
- 左 60%：多图轮播（主图 + 4 张缩略图）+ 鼠标悬停放大镜（釉面纹理清晰可见）
- 右 40%：
  - 产品名、品类、SKU
  - 工艺参数表（材质、釉色、尺寸、起订量、单价范围）
  - OEM 定制选项 Tag 列表
  - 数量输入框 + 「Add to Quote / WhatsApp Inquire」按钮（绿 + 哑光金）
  - 「Proceed to Payment (U)」按钮（演示 B2C 支付）
- 下方 Tab：
  - **Description**：详细工艺描述
  - **Care Instructions** 保养说明
  - **Shipping & Logistics** 易碎品物流提示
  - **OEM Customization** 定制需求表单（和右侧按钮联动）
- 询盘表单嵌入：姓名、邮箱、WhatsApp、采购数量、定制需求、提交

### 5.4 工程案例页 `/cases`
- 顶部分类 Tab：全部 / 酒店 / 豪宅别墅 / 商业空间
- 瀑布流 + 大图展示（1:1 或 3:2 网格）
- 每张卡片：大图 + 项目名 + 客户名 + 年份 + 地点
- 点击进入案例详情模态框（或独立页）：多图 + 详细简介 + 陶瓷供应范围

### 5.5 OEM 定制服务页 `/oem`
- 顶部大 Banner「OEM & Private Label Customization」
- 4 大服务模块（卡片形式）：
  1. 贴牌 Private Label（客户 LOGO 烧制）
  2. 来图定制 Custom Design（客户提供 AI/JPG 开模打样）
  3. 器型开发 Mold Development（原创器型设计）
  4. 包装定制 Packaging Solution
- 起订量 MOQ 对照表：3 档阶梯
- 合作流程 Timeline：需求沟通 → 报价 → 打样 → 确认 → 量产 → 验货出运（6 步，竖轴时间线）
- 底部 CTA：「Start Your OEM Project」表单

### 5.6 About Us 关于我们 `/about`
- 品牌故事（长文 + 创始人照片）
- 工厂实力板块：车间照片 3~5 张 + 4 项能力（手工拉坯 / 釉色研发 / 1280℃ 高温烧制 / 全检品控）
- 资质证书：ISO9001 / CE / FDA / 出口中东认证等卡片网格
- 发展历程时间线：1995 创立 → 2008 进迪拜 → 2015 自建新厂 → 2024 全球 500+ 工程

### 5.7 联系页 `/contact`
- 左侧：联系方式卡片（邮箱、电话、WhatsApp、公司地址中英文）
- 中间：谷歌地图占位（iframe 占位图 + 地址文字，生产环境替换为 Google Maps Embed API key）
- 右侧：询盘表单（姓名、邮箱、WhatsApp 号、国家、采购数量、产品名（下拉或自动填入）、定制需求 textarea、提交按钮）

### 5.8 简易后台管理 `/admin/*`
- 登录页 `/admin/login`：用户名 + 密码，默认 `admin / admin123`（首次启动 seed）
- Dashboard `/admin/dashboard`：近 7 天询盘数 / 产品总数 / 案例总数 / 订单总数 + 最近 10 条询盘
- 产品管理 `/admin/products`：列表（缩略图、SKU、名称、分类、价格、推荐开关）+ 新增/编辑模态框 + 删除
- 询盘列表 `/admin/inquiries`：表格 + 筛选 + 状态标签 + 查看详情侧滑 + 导出 CSV 按钮
- 案例管理 `/admin/cases`：同产品管理

---

## 六、核心业务功能设计

### 6.1 双语切换（LTR / RTL）
- 语言 Context：`{ lang: 'en' | 'ar', setLang, t }`
- 切换按钮在 Navbar 右侧，显示「中文/EN / عربي」图标
- 切换时：
  1. `<html lang>` 改变
  2. `<body>` 加 `dir="rtl"` 或 `dir="ltr"`
  3. Tailwind `rtl:` 前缀生效（安装 `tailwindcss-flip` 或 `@tailwindcss/rtl`）
  4. 所有组件内文案通过 `t('key')` 读取，不允许硬编码
- 翻译资源约 200 个 key（导航、按钮、表单、页面标题、产品字段等）

### 6.2 询盘系统
- 前端表单验证：邮箱格式、WhatsApp 号（971 开头或其他）必填
- 提交 → POST `/api/inquiries` → 后端：
  1. 写入 MongoDB `inquiries` 集
  2. 触发邮件发送（demo：写入 `backend/logs/inquiry-emails/时间戳.eml`，控制台打印「[模拟邮件] 发送到 sales@luxeceramics.com：新询盘来自 xxx」，生产环境取消注释 nodemailer SMTP 配置）
  3. 返回成功 → 前端显示 Toast「询盘已提交，我们将在 24 小时内通过 WhatsApp 联系您」

### 6.3 悬浮 WhatsApp 按钮
- 位置：右下 `fixed right-6 bottom-6`（LTR）/ `left-6 bottom-6`（RTL）
- 样式：圆形 56px，哑光金渐变 → 亮金 hover，圆形波纹动画
- 点击：打开新标签 `https://wa.me/971501234567?text=${encodeURIComponent(t('whatsapp_preset'))}`
- 预设文案："Hello LuxeCeramics! I'm interested in your [产品名 or ceramic products]. Please contact me with more details and quote."

### 6.4 U (USDT-TRC20) 支付（业务 demo 链路）
1. 产品详情页点击「Pay with U」→ 进入 `/checkout`
2. 填写联系信息 → 提交创建订单 → 后端计算 `usdtAmount = totalAmount * usdtRate(7.2:1 或读外部接口注释)`
3. 显示支付信息页：
   - 我方收款地址（TRC20）：`TJYvqxxxxxxxxxxxxxxxxxxxxxxxx`
   - 应付金额：xxx USDT
   - 二维码（使用 QRCode React 组件渲染地址 + 金额）
   - 提示：15 分钟内完成转账，转账后请填入 txHash
   - 输入框 + 「我已付款」按钮 → POST `/api/orders/:orderNo/pay` → 后端把 status 置 `paid`（demo 任意 txHash 都通过，生产环境走 tronscan API 校验）
4. 订单状态页：显示 pending / paid / failed 徽章
- **真实对接修改点**：在 `backend/src/utils/payment.ts` 和 `frontend/src/pages/Checkout.tsx` 顶部用 `// TODO: 真实生产对接` 注释详细标注（trongrid 查询交易、异步 webhook、订单超时取消等）

### 6.5 图片展示与响应式
- 所有图片 `loading="lazy"` + `decoding="async"`
- 产品详情页放大镜：hover 放大 2x，釉面纹理清晰
- 断点：sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536
- 移动端：导航折叠为汉堡菜单、分类筛选变底部滑出抽屉

### 6.6 SEO
- 所有页面 `<Helmet>` 注入 title / meta description / og:image / canonical
- 产品/案例详情页动态拼接 meta
- `<img>` 全部有 alt 属性（双语 alt 通过 i18n 拼接）
- Vite 构建时开启 minify + 代码分割
- 首页首屏关键 CSS 内联（Tailwind jit）

---

## 七、UI 视觉规范（必须严格执行）

### 7.1 颜色色板（Tailwind 自定义）
```js
// tailwind.config.js  theme.extend.colors
{
  ceramic: {
    cream: '#FAF7F2',     // 米白（主背景）
    offWhite: '#F3EFE9',  // 次背景
    pearl: '#EDE7DC',     // 分隔区
    ash: '#8A857C',       // 浅灰辅文
    graphite: '#2C2A26',  // 深灰（主文字）
    gold: {
      matte: '#B89778',   // 哑光金（主品牌色）
      soft: '#D4B896',    // 柔和金（hover）
      light: '#E8D5B7',   // 浅金（边线）
      deep: '#8A6E4F'     // 深金（强调）
    },
    border: '#E5DFD3',    // 边框线
  }
}
```

### 7.2 字体
- 英文 LTR：`'Playfair Display'`（标题，衬线优雅）+ `'Inter'`（正文）
- 阿拉伯文 RTL：`'Amiri'` 或 `'Cairo'`（谷歌字体）
- Fallback：系统 serif / sans-serif
- 字重：标题 600/700、正文 400

### 7.3 动画与留白
- 过渡统一 `transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]`
- 卡片 hover：`translateY(-4px)` + 阴影 `shadow-[0_10px_40px_-10px_rgba(184,151,120,0.3)]`
- 金色边线：`border border-ceramic-gold-light/50`，hover 变 `border-ceramic-gold-matte`
- 留白：区块 padding-y `py-20 lg:py-28`，段距 `space-y-12`
- 禁止花哨弹窗、禁止大红大绿紫

### 7.4 导航与页脚
- Navbar：透明变实色滚动（scrollY > 80 加白色背景+阴影）
- Footer：米白深灰字，四列：品牌 / 产品 / 服务 / 联系；最底版权（双语）

---

## 八、Mock 数据内置清单

### 产品（12 条覆盖 6 大品类）
1. 金边骨瓷 4 人套餐具（餐桌瓷）
2. 手工青花大碗（餐桌瓷）
3. 哑光金釉面花瓶 Φ40cm（花瓶）
4. 流釉艺术大花瓶 1.2m（花瓶）
5. 手工捏塑天鹅艺术雕塑（艺术雕塑）
6. 青瓷莲花雕塑摆件（艺术雕塑）
7. 酒店总统套房 68 件套餐瓷（酒店瓷）
8. 五星酒店自助餐具套装（酒店瓷）
9. 柔光米白墙砖 300x600（瓷砖）
10. 哑光金线装饰地面砖（瓷砖）
11. 宝石蓝描金茶壶 OEM 贴牌（OEM 样品）
12. 中东风格手工彩绘大盘（OEM 样品）

### 案例（8 条）
- Burj Al Arab 帆船酒店总统套房餐具升级（酒店 2024）
- Atlantis The Royal 宴会厅定制餐具（酒店 2023）
- Palm Jumeirah 别墅私人陶瓷定制（豪宅 2024）
- Downtown Dubai 豪华公寓艺术品装置（豪宅 2023）
- Dubai Mall 旗舰酒店大堂花瓶装置（商业 2024）
- DIFC 金融中心私人会所陶瓷艺术（商业 2023）
- Riyadh Ritz-Carlton 定制全套餐瓷（酒店 2022）
- Abu Dhabi Emirates Palace 定制瓷砖工程（酒店 2023）

### 客户 LOGO（8 个 SVG 纯字母占位）
- Hilton, Marriott, Ritz-Carlton, Four Seasons, Emaar, Nakheel, Dubai Holding, Meraas

---

## 九、权限与安全

### 后台登录
- 默认账号 `admin / admin123`（首次 seed 插入，DEMO ONLY）
- JWT 有效期 24h
- 前端路由守卫：`ProtectedRoute` 组件，无 token 重定向 `/admin/login`
- 后端 `authJWT` 中间件拦截所有 `/api/*` 管理接口

### XSS / CSRF / SQL 注入防护
- Helmet 设置安全头
- Express 内置 body-parser 限制大小
- Mongoose 查询，避免拼接字符串
- CORS 白名单（开发 5173，生产域名）
- 上传：multer 限制 10MB / 单文件，仅允许 jpg/png/webp，上传后重命名为 uuid

---

## 十、部署（详见 DEPLOYMENT.md）

简述：
1. 服务器：Ubuntu 22.04 + Node 18 + MongoDB 6 + Nginx
2. 前端 `npm run build` → dist 丢到 Nginx `/var/www/luxeceramics`
3. 后端 `npm run build` + PM2 `ecosystem.config.js` 跑 3000 端口
4. Nginx 反代 `/api` 到 localhost:3000，其余走静态
5. 域名 + HTTPS（Certbot）
6. 双语修改：改 `frontend/public/locales/{en,ar}/translation.json`，无需重新构建（读取 json）
7. 支付接口替换：按 6.4 节 TODO 注释对接真实 TRON 节点 / tronscan

---

## 十一、运维说明（详见 OPERATION.md）

简述：
1. 新增陶瓷产品：登录后台 → 产品管理 → 新增；或直接改 `backend/src/seed/seedData.ts` 重跑 seed
2. 修改文案：
   - 固定文案：改 `frontend/public/locales/xx/translation.json`
   - 产品/案例文案：后台改或改 seed
3. 备份：MongoDB 定时 `mongodump`，uploads 目录 rsync
4. 监控：PM2 logs + Nginx access.log

---

## 十二、里程碑 / 交付物

| 序号 | 交付物 | 完成标志 |
|---|---|---|
| M1 | 本 PRD 文档 | 用户确认无异议 |
| M2 | 项目骨架 + 依赖可安装 | `npm install` 无 error，前后端各可 ts-node/dev 启动 |
| M3 | 后端 API 全部跑通（Postman/curl 验证） | inquiry 写入 DB、邮件文件生成、登录获取 JWT、CRUD OK |
| M4 | 前端 8 页全部可跳转 + 双语切换 + RTL | 无控制台 404，按钮交互正确 |
| M5 | 支付模拟链路跑通 + 后台导出 CSV | 下单 → 支付 → 订单状态变为 paid |
| M6 | 一键脚本 + 部署 + 运维文档 + 自测报告 | `bash start.sh` 一条命令启动，浏览器打开 5173 浏览全部页面 |

---

## 十三、确认项

> 请用户确认以下内容，确认后立即开始 M2~M6 编码：
> 1. 技术栈（React18+Vite+TS+Tailwind / Express+MongoDB）是否同意？
> 2. 8 个页面 + 后台 4 个管理页清单是否满足需求？
> 3. UI 配色（米白 + 浅灰 + 哑光金）是否接受？
> 4. 支付采用 USDT-TRC20 模拟链路（txHash 任意填即通过）是否 OK？
> 5. 后台默认账号 admin/admin123 是否 OK？

**请回复「同意，开始开发」或指出具体调整项，我将立即进入编码阶段。**

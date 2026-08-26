/**
 * PHASE 1 外贸业务工作台 后端 Stub API
 * 路径：/api/console/*
 *
 * 设计原则（Phase 1 第一阶段）：
 *  1. 所有 /api/console/* 全部走 authJWT() —— 未登录 401，登录才返回数据
 *  2. 不造任何假数据，不硬编码数字；DB 没数据就返回 items:[] / totals:0 / null
 *  3. 为后续 Phase 2-3 扩展预留完整 schema：
 *      - Dashboard summary 返回可扩展的统计字段 + 图表数据位
 *      - Lead / Customer / Inquiry / Quote / Order / FollowUp / Task / Analytics
 *        都返回标准分页 {items, total, page, pageSize} 结构
 *  4. 响应体风格 = { code:0, message:'ok', data: ... } 与现有 API 一致
 *
 *  ⚠️ Phase 1 先不实现：全网爬取 / LinkedIn / Google / Instagram / 自动群发 / AI
 *     —— 这些在后续 Phase 新增 routes/leadsSources.ts / ai.ts 等模块。
 */
import { Router } from 'express';
import { authJWT, AuthRequest } from '../middleware/authJWT';

const router = Router();

// ============ 全局保护：所有 /api/console/* 必须是已登录管理员 ============
router.use(authJWT());

// ---------- 工具：标准成功响应 ----------
const ok = <T>(res: any, data: T, message = 'ok') =>
  res.json({ code: 0, message, data });

// ---------- 工具：空分页结构 ----------
const emptyPage = <T>(items: T[] = [], page = 1, pageSize = 20) => ({
  items,
  total: items.length,
  page,
  pageSize,
  totalPages: 0,
});

// ========================================================================
//  1. Dashboard 基础汇总（Phase 1 只返回 0 / 空数组，绝不硬编码假数字）
// ========================================================================
router.get('/dashboard/summary', (_req: AuthRequest, res) => {
  ok(res, {
    // 核心指标位
    kpis: {
      totalLeads: 0,
      totalCustomers: 0,
      totalInquiries: 0,
      totalQuotes: 0,
      totalOrders: 0,
      totalOrderAmountUsd: 0,
      pendingTasks: 0,
      upcomingFollowups: 0,
      conversionRate: 0,
    },
    // 空趋势图（后续 Phase 按 7/30/90 天聚合）
    charts: {
      leadsLast30Days:       [] as Array<{date:string; count:number}>,
      ordersLast30Days:      [] as Array<{date:string; count:number; amount:number}>,
      inquiriesBySource:     [] as Array<{source:string; count:number}>,
      topCountries:          [] as Array<{country:string; count:number}>,
    },
    // 待办/最近事项（占位）
    recent: {
      inquiries: [],
      orders:    [],
      tasks:     [],
    },
  });
});

// ========================================================================
//  2. Leads（潜在客户） — Phase 1 空结构
// ========================================================================
router.get('/leads', (_req: AuthRequest, res) =>
  ok(res, emptyPage<any>()),
);
router.get('/leads/:id', (_req: AuthRequest, res) => ok(res, null));
// POST/PATCH/DELETE 后续 Phase 实现（Phase 1 仅保留 404/Mongo 模型空表返回位）

// ========================================================================
//  3. Customers（成交客户） — Phase 1 空结构
// ========================================================================
router.get('/customers', (_req: AuthRequest, res) =>
  ok(res, emptyPage<any>()),
);
router.get('/customers/:id', (_req: AuthRequest, res) => ok(res, null));

// ========================================================================
//  4. Inquiries（询盘，业务工作台视角 — 与公开 /api/inquiries 解耦）
// ========================================================================
router.get('/inquiries', (_req: AuthRequest, res) =>
  ok(res, emptyPage<any>()),
);
router.get('/inquiries/:id', (_req: AuthRequest, res) => ok(res, null));

// ========================================================================
//  5. Quotes（报价单）
// ========================================================================
router.get('/quotes', (_req: AuthRequest, res) =>
  ok(res, emptyPage<any>()),
);
router.get('/quotes/:id', (_req: AuthRequest, res) => ok(res, null));

// ========================================================================
//  6. Orders（业务工作台视角 — 与商城 /api/orders 解耦，后续合并视图）
// ========================================================================
router.get('/orders', (_req: AuthRequest, res) =>
  ok(res, emptyPage<any>()),
);
router.get('/orders/:id', (_req: AuthRequest, res) => ok(res, null));

// ========================================================================
//  7. FollowUps（跟进记录）
// ========================================================================
router.get('/followups', (_req: AuthRequest, res) =>
  ok(res, emptyPage<any>()),
);
router.get('/followups/:id', (_req: AuthRequest, res) => ok(res, null));

// ========================================================================
//  8. Tasks（任务）
// ========================================================================
router.get('/tasks', (_req: AuthRequest, res) =>
  ok(res, emptyPage<any>()),
);
router.get('/tasks/:id', (_req: AuthRequest, res) => ok(res, null));

// ========================================================================
//  9. Analytics（多维分析）
// ========================================================================
router.get('/analytics/overview', (_req: AuthRequest, res) =>
  ok(res, {
    period: '30d',
    funnels: { leads: 0, inquiries: 0, quotes: 0, orders: 0 },
    bySource:   [] as Array<{source:string; leads:number; orders:number; revenue:number}>,
    byCountry:  [] as Array<{country:string; leads:number; orders:number; revenue:number}>,
    byProduct:  [] as Array<{productId:string; sku:string; name:string; orders:number; revenue:number}>,
    bySalesRep: [] as Array<{salesRep:string; leads:number; orders:number; revenue:number}>,
  }),
);

// ========================================================================
//  10. 当前 Console 会话用户（与 req.admin 对齐，前端 Topbar 显示）
// ========================================================================
router.get('/me', (req: AuthRequest, res) =>
  ok(res, {
    id:       req.admin?.id ?? '',
    username: req.admin?.username ?? '',
    role:     req.admin?.role ?? 'admin',
    // 扩展位：头像/时区/语言/工作台偏好 —— 后续 Phase 补齐
    avatar:   null as string | null,
    timezone: 'UTC',
    locale:   'en',
  }),
);

export default router;

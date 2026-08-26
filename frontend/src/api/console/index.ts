/**
 * PHASE 1 外贸业务工作台 — 前端统一 Console API Layer
 *
 * 架构（Frontend → API Layer → Backend → MongoDB）：
 *   前端 9 pages  ──▶  import { Console } from '@/api/console'  ──▶  axios (baseURL=/api) + JWT 拦截器  ──▶  /api/console/*
 *
 * 业务页（dashboard/leads/.../analytics）**禁止** 直接写 axios 请求，
 * 必须统一通过本 Console 命名空间调用 —— 方便 Phase 2+ 加缓存、重试、错误追踪。
 *
 * 所有方法返回类型都对齐 backend/src/routes/console.ts：
 *   list  → ConsolePage<T>  { items, total, page, pageSize, totalPages }
 *   me    → ConsoleMe       { id, username, role, avatar, ... }
 *   dash  → ConsoleDashboardSummary
 *   analytics → ConsoleAnalyticsOverview
 */
import { get } from '..';
import type {
  ConsolePage,
  ConsoleMe,
  ConsoleDashboardSummary,
  ConsoleLead,
  ConsoleCustomer,
  ConsoleInquiry,
  ConsoleQuote,
  ConsoleOrder,
  ConsoleFollowUp,
  ConsoleTask,
  ConsoleAnalyticsOverview,
} from '../../types';

// ---------- 查询参数（Phase 1 只传 page/pageSize，Phase 2 扩展 filters / sort / search）----------
export type ConsoleListParams = Partial<{
  page: number;
  pageSize: number;
  search: string;
  status: string;
  sort: string;
  order: 'asc' | 'desc';
}>;

const DEFAULT_PARAMS: ConsoleListParams = { page: 1, pageSize: 20 };

const page = <T>(url: string, p?: ConsoleListParams) =>
  get<ConsolePage<T>>(url, { ...DEFAULT_PARAMS, ...p });

export const Console = {
  // ---------- 当前登录控制台管理员信息 ----------
  me: () => get<ConsoleMe>('/console/me'),

  // ---------- Dashboard ----------
  dashboardSummary: () => get<ConsoleDashboardSummary>('/console/dashboard/summary'),

  // ---------- Leads（潜在客户） ----------
  listLeads:       (p?: ConsoleListParams) => page<ConsoleLead>('/console/leads', p),
  leadDetail:      (id: string)            => get<ConsoleLead | null>(`/console/leads/${id}`),

  // ---------- Customers（成交客户） ----------
  listCustomers:   (p?: ConsoleListParams) => page<ConsoleCustomer>('/console/customers', p),
  customerDetail:  (id: string)            => get<ConsoleCustomer | null>(`/console/customers/${id}`),

  // ---------- Inquiries（业务工作台视角，解耦公开询盘提交接口） ----------
  listInquiries:   (p?: ConsoleListParams) => page<ConsoleInquiry>('/console/inquiries', p),
  inquiryDetail:   (id: string)            => get<ConsoleInquiry | null>(`/console/inquiries/${id}`),

  // ---------- Quotes（报价单） ----------
  listQuotes:      (p?: ConsoleListParams) => page<ConsoleQuote>('/console/quotes', p),
  quoteDetail:     (id: string)            => get<ConsoleQuote | null>(`/console/quotes/${id}`),

  // ---------- Orders（业务工作台视角，解耦商城下单接口） ----------
  listOrders:      (p?: ConsoleListParams) => page<ConsoleOrder>('/console/orders', p),
  orderDetail:     (id: string)            => get<ConsoleOrder | null>(`/console/orders/${id}`),

  // ---------- FollowUps（跟进记录） ----------
  listFollowUps:   (p?: ConsoleListParams) => page<ConsoleFollowUp>('/console/followups', p),
  followUpDetail:  (id: string)            => get<ConsoleFollowUp | null>(`/console/followups/${id}`),

  // ---------- Tasks（任务） ----------
  listTasks:       (p?: ConsoleListParams) => page<ConsoleTask>('/console/tasks', p),
  taskDetail:      (id: string)            => get<ConsoleTask | null>(`/console/tasks/${id}`),

  // ---------- Analytics ----------
  analyticsOverview: () => get<ConsoleAnalyticsOverview>('/console/analytics/overview'),
};

export default Console;

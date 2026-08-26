/**
 * PHASE 2-A 外贸业务工作台 — 前端统一 Console API Layer（真实 CRUD）
 *
 * 架构：
 *   前端 9 pages  ──▶  import { Console } from '@/api/console'  ──▶  axios (baseURL=/api) + JWT 拦截器  ──▶  /api/console/*
 *
 * 业务页禁止直接写 axios；所有请求统一走 Console 命名空间。
 *
 * 所有方法返回类型对齐 backend/src/routes/console.ts：
 *   list  → ConsolePage<T>  { items, total, page, pageSize, totalPages }
 *   crud  → T
 */
import { get, post, patch, del } from '..';
import type {
  ConsolePage,
  ConsoleMe,
  ConsoleDashboardSummary,
  ConsoleLead,
  ConsoleCustomer,
  ConsoleCustomerDetail,
  ConsoleCompany,
  ConsoleContact,
  ConsoleInquiry,
  ConsoleQuote,
  ConsoleOrder,
  ConsoleFollowUp,
  ConsoleTask,
  ConsoleInteraction,
  ConsoleAnalyticsOverview,
} from '../../types';

// ---------- List 参数（PHASE 2-A：支持 search / filter / sort / pagination）----------
export type ConsoleListParams = Partial<{
  page: number;
  pageSize: number;
  search: string;
  status: string;
  stage: string;
  source: string;
  country: string;
  industry: string;
  grade: string;
  minScore: number;
  maxScore: number;
  customerLevel: string;
  ownerId: string;
  priority: string;
  sort: string;
  order: 'asc' | 'desc';
  view: string;   // FollowUp: today/upcoming/completed/overdue  Task: todo/done/overdue
  // 关联过滤
  customerId: string;
  companyId: string;
  leadId: string;
  contactId: string;
  inquiryId: string;
  quoteId: string;
  paymentStatus: string;
  orderNo: string;
}>;

const DEFAULT_PARAMS: ConsoleListParams = { page: 1, pageSize: 20 };
const listParams = (p?: ConsoleListParams): ConsoleListParams => ({ ...DEFAULT_PARAMS, ...(p || {}) });

// 列表统一封装
const $list = <T>(url: string, p?: ConsoleListParams) => get<ConsolePage<T>>(url, listParams(p));
const $detail = <T>(url: string) => get<T | null>(url);
const $create = <T>(url: string, d: any) => post<T>(url, d);
const $update = <T>(url: string, d: any) => patch<T>(url, d);
const $remove = <T>(url: string) => del<T>(url);

export const Console = {
  // ---------- 当前登录控制台管理员信息 ----------
  me: () => get<ConsoleMe>('/console/me'),

  // ---------- Dashboard ----------
  dashboardSummary: () => get<ConsoleDashboardSummary>('/console/dashboard/summary'),

  // ---------- Leads（潜在客户）：搜索/筛选/分页 + 增删改查 + 改状态/评分 + 转换Customer ----------
  listLeads:        (p?: ConsoleListParams) => $list<ConsoleLead>('/console/leads', p),
  leadDetail:       (id: string)            => $detail<ConsoleLead>(`/console/leads/${id}`),
  createLead:       (d: Partial<ConsoleLead>)  => $create<ConsoleLead>('/console/leads', d),
  updateLead:       (id: string, d: Partial<ConsoleLead>) => $update<ConsoleLead>(`/console/leads/${id}`, d),
  deleteLead:       (id: string)            => $remove<{ deleted: boolean; id: string }>(`/console/leads/${id}`),
  convertLead:      (id: string, d?: { customerLevel?: 'PLATINUM'|'GOLD'|'SILVER'|'BRONZE'|'PROSPECT' }) =>
    post<{ lead: any; customer: ConsoleCustomer; company: ConsoleCompany; contact: ConsoleContact }>(`/console/leads/${id}/convert`, d || {}),

  // ---------- Customers ----------
  listCustomers:    (p?: ConsoleListParams) => $list<ConsoleCustomer>('/console/customers', p),
  customerDetail:   (id: string)            => $detail<ConsoleCustomerDetail>(`/console/customers/${id}`),
  createCustomer:   (d: Partial<ConsoleCustomer> & { company?: string; website?: string; country?: string; industry?: string }) =>
    $create<ConsoleCustomer>('/console/customers', d),
  updateCustomer:   (id: string, d: Partial<ConsoleCustomer>) => $update<ConsoleCustomer>(`/console/customers/${id}`, d),
  deleteCustomer:   (id: string)            => $remove<{ deleted: boolean; id: string }>(`/console/customers/${id}`),
  addCustomerFollowup: (id: string, d: Partial<ConsoleFollowUp>) =>
    $create<ConsoleFollowUp>(`/console/customers/${id}/followup`, d),

  // ---------- Companies ----------
  listCompanies:    (p?: ConsoleListParams) => $list<ConsoleCompany>('/console/companies', p),
  companyDetail:    (id: string)            => $detail<ConsoleCompany>(`/console/companies/${id}`),
  createCompany:    (d: Partial<ConsoleCompany>) => $create<ConsoleCompany>('/console/companies', d),
  updateCompany:    (id: string, d: Partial<ConsoleCompany>) => $update<ConsoleCompany>(`/console/companies/${id}`, d),

  // ---------- Contacts ----------
  listContacts:     (p?: ConsoleListParams) => $list<ConsoleContact>('/console/contacts', p),
  contactDetail:    (id: string)            => $detail<ConsoleContact>(`/console/contacts/${id}`),
  createContact:    (d: Partial<ConsoleContact>) => $create<ConsoleContact>('/console/contacts', d),
  updateContact:    (id: string, d: Partial<ConsoleContact>) => $update<ConsoleContact>(`/console/contacts/${id}`, d),

  // ---------- FollowUps ----------
  listFollowUps:    (p?: ConsoleListParams) => $list<ConsoleFollowUp>('/console/followups', p),
  followUpDetail:   (id: string)            => $detail<ConsoleFollowUp>(`/console/followups/${id}`),
  createFollowUp:   (d: Partial<ConsoleFollowUp>) => $create<ConsoleFollowUp>('/console/followups', d),
  updateFollowUp:   (id: string, d: Partial<ConsoleFollowUp>) => $update<ConsoleFollowUp>(`/console/followups/${id}`, d),
  deleteFollowUp:   (id: string)            => $remove<{ deleted: boolean; id: string }>(`/console/followups/${id}`),

  // ---------- Tasks ----------
  listTasks:        (p?: ConsoleListParams) => $list<ConsoleTask>('/console/tasks', p),
  taskDetail:       (id: string)            => $detail<ConsoleTask>(`/console/tasks/${id}`),
  createTask:       (d: Partial<ConsoleTask>) => $create<ConsoleTask>('/console/tasks', d),
  updateTask:       (id: string, d: Partial<ConsoleTask>) => $update<ConsoleTask>(`/console/tasks/${id}`, d),
  deleteTask:       (id: string)            => $remove<{ deleted: boolean; id: string }>(`/console/tasks/${id}`),

  // ---------- Interactions (Timeline) ----------
  listInteractions: (p?: ConsoleListParams) => $list<ConsoleInteraction>('/console/interactions', p),

  // ---------- Inquiries ----------
  listInquiries:    (p?: ConsoleListParams) => $list<ConsoleInquiry>('/console/inquiries', p),
  inquiryDetail:    (id: string)            => $detail<ConsoleInquiry>(`/console/inquiries/${id}`),
  createInquiry:    (d: Partial<ConsoleInquiry>) => $create<ConsoleInquiry>('/console/inquiries', d),
  updateInquiry:    (id: string, d: Partial<ConsoleInquiry>) => $update<ConsoleInquiry>(`/console/inquiries/${id}`, d),

  // ---------- Quotes ----------
  listQuotes:       (p?: ConsoleListParams) => $list<ConsoleQuote>('/console/quotes', p),
  quoteDetail:      (id: string)            => $detail<ConsoleQuote>(`/console/quotes/${id}`),
  createQuote:      (d: Partial<ConsoleQuote>) => $create<ConsoleQuote>('/console/quotes', d),
  updateQuote:      (id: string, d: Partial<ConsoleQuote>) => $update<ConsoleQuote>(`/console/quotes/${id}`, d),
  convertQuoteToOrder: (id: string) => post<ConsoleOrder>(`/console/quotes/${id}/convert-order`, {}),

  // ---------- Orders ----------
  listOrders:       (p?: ConsoleListParams) => $list<ConsoleOrder>('/console/orders', p),
  orderDetail:      (id: string)            => $detail<ConsoleOrder>(`/console/orders/${id}`),
  updateOrder:      (id: string, d: Partial<ConsoleOrder>) => $update<ConsoleOrder>(`/console/orders/${id}`, d),

  // ---------- Analytics ----------
  analyticsOverview: () => get<ConsoleAnalyticsOverview>('/console/analytics/overview'),
};

export default Console;

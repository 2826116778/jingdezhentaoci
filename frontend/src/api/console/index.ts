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
  // PHASE 2-B: Customer Acquisition
  ConsoleLeadCampaign,
  ConsoleLeadImport,
  ConsoleLeadImportRow,
  ConsoleMessageTemplate,
  ConsoleDevelopmentTask,
  ConsoleMarketConfig,
  ConsoleDevelopmentOverview,
  ConsoleLeadScoreResult,
  ConsoleAcquisitionAnalytics,
  // PHASE 2-C: AI Customer Research & Development
  AIResearchJob,
  AIResearchProfile,
  AIActionLog,
  AIUsageSummary,
  AIDashboardSummary,
  AIProviderInfo,
  AIBudget,
  AIRsultBundle,
  AIScoreResult,
  AIProductMatchResult,
  AIStrategyResult,
  AIMessageDraftResult,
  AIBulkResearchResult,
  AIMessageDraft,
  AIProductMatch,
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
  city: string;
  industry: string;
  companyType: string;
  productInterest: string;
  grade: string;
  minScore: number;
  maxScore: number;
  customerLevel: string;
  ownerId: string;
  priority: string;
  channel: string;
  language: string;
  campaignId: string;
  importId: string;
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

  // ====================================================================
  // PHASE 2-B —— 海外客户开发中心 (Customer Acquisition)
  //   路由前缀: /console/development/*
  //   后端实现: backend/src/routes/development.ts
  //   命名空间: Console.Development.*
  // ====================================================================
  Development: {
    // ----- 1. Overview（开发中心首页概览）-----
    overview: () => get<ConsoleDevelopmentOverview>('/console/development/overview'),

    // ----- 2. Campaigns（开发活动）-----
    listCampaigns:    (p?: ConsoleListParams) => $list<ConsoleLeadCampaign>('/console/development/campaigns', p),
    campaignDetail:   (id: string)            => $detail<ConsoleLeadCampaign>(`/console/development/campaigns/${id}`),
    createCampaign:   (d: Partial<ConsoleLeadCampaign>)  => $create<ConsoleLeadCampaign>('/console/development/campaigns', d),
    updateCampaign:   (id: string, d: Partial<ConsoleLeadCampaign>) => $update<ConsoleLeadCampaign>(`/console/development/campaigns/${id}`, d),
    deleteCampaign:   (id: string)            => $remove<{ deleted: boolean; id: string }>(`/console/development/campaigns/${id}`),

    // ----- 3. Lead Import Wizard（导入：Upload → Map → Validate → Commit）-----
    // 3.1 上传：rawData 已是 JSON 数组（CSV/Excel 已在前端解析完成）
    uploadImport: (d: {
      fileName: string;
      fileType: 'csv' | 'xlsx' | 'json';
      fileSize?: number;
      rawData: Record<string, any>[];
      campaignId?: string;
      duplicateStrategy?: 'SKIP' | 'UPDATE' | 'CREATE_ANYWAY';
    }) => post<{ importId: string; totalRows: number; preview: Record<string, any>[] }>('/console/development/imports/upload', d),

    // 3.2 字段映射：将原始列名映射到 Lead 字段
    mapImport: (id: string, fieldMapping: Record<string, string>) =>
      post<{ importId: string; fieldMapping: Record<string, string>; preview: Record<string, any>[] }>(`/console/development/imports/${id}/map`, { fieldMapping }),

    // 3.3 校验 + 去重检测
    validateImport: (id: string) =>
      post<{ importId: string; totalRows: number; validRows: number; invalidRows: number; duplicateRows: number; rows: ConsoleLeadImportRow[] }>(`/console/development/imports/${id}/validate`, {}),

    // 3.4 提交导入（按 duplicateStrategy 写入 Lead + Interaction）
    commitImport: (id: string) =>
      post<{ total: number; imported: number; updated: number; skipped: number; failed: number; status: string }>(`/console/development/imports/${id}/commit`, {}),

    // 3.5 列表 / 详情
    listImports:  (p?: ConsoleListParams) => $list<ConsoleLeadImport>('/console/development/imports', p),
    importDetail: (id: string)            => $detail<ConsoleLeadImport>(`/console/development/imports/${id}`),

    // ----- 4. Lead Scoring（评分 0-100 + Grade A/B/C/D + Reasons）-----
    scoreLead:  (leadId: string) => post<ConsoleLeadScoreResult>(`/console/development/scoring/score/${leadId}`, {}),
    batchScore: (leadIds: string[]) =>
      post<{ scored: number; results: ConsoleLeadScoreResult[] }>(`/console/development/scoring/batch`, { leadIds }),

    // ----- 5. Lead 批量操作（分配/改状态/改分级/加标签/创建开发任务/删除）-----
    batchLeads: (leadIds: string[], action: string, payload: Record<string, any> = {}) =>
      post<{ affected?: number; taskId?: string }>(`/console/development/leads/batch`, { leadIds, action, payload }),

    // ----- 6. Message Templates（开发话术：First Contact / Follow-up / Inquiry / Quote）-----
    listTemplates:    (p?: ConsoleListParams) => $list<ConsoleMessageTemplate>('/console/development/templates', p),
    templateDetail:   (id: string)            => $detail<ConsoleMessageTemplate>(`/console/development/templates/${id}`),
    createTemplate:   (d: Partial<ConsoleMessageTemplate>)  => $create<ConsoleMessageTemplate>('/console/development/templates', d),
    updateTemplate:   (id: string, d: Partial<ConsoleMessageTemplate>) => $update<ConsoleMessageTemplate>(`/console/development/templates/${id}`, d),
    deleteTemplate:   (id: string)            => $remove<{ deleted: boolean; id: string }>(`/console/development/templates/${id}`),
    previewTemplate:  (id: string, variables: Record<string, any>) =>
      post<{ subject: string; content: string }>(`/console/development/templates/${id}/preview`, { variables }),

    // ----- 7. Development Tasks（开发任务 + 漏斗）-----
    listTasks:    (p?: ConsoleListParams) => $list<ConsoleDevelopmentTask>('/console/development/tasks', p),
    taskDetail:   (id: string)            => $detail<ConsoleDevelopmentTask>(`/console/development/tasks/${id}`),
    createTask:   (d: Partial<ConsoleDevelopmentTask>)  => $create<ConsoleDevelopmentTask>('/console/development/tasks', d),
    updateTask:   (id: string, d: Partial<ConsoleDevelopmentTask>) => $update<ConsoleDevelopmentTask>(`/console/development/tasks/${id}`, d),
    deleteTask:   (id: string)            => $remove<{ deleted: boolean; id: string }>(`/console/development/tasks/${id}`),

    // ----- 8. Market Config（国家优先级 / 城市 / 默认产品推荐 — DB 配置，不硬编码）-----
    listMarkets:    ()                              => get<ConsoleMarketConfig[]>('/console/development/markets'),
    createMarket:   (d: Partial<ConsoleMarketConfig>)  => $create<ConsoleMarketConfig>('/console/development/markets', d),
    updateMarket:   (id: string, d: Partial<ConsoleMarketConfig>) => $update<ConsoleMarketConfig>(`/console/development/markets/${id}`, d),

    // ----- 9. Analytics（按 Campaign/Source/Country 漏斗 + 来源质量评分）-----
    acquisitionAnalytics: () => get<ConsoleAcquisitionAnalytics>('/console/development/analytics'),
  },

  // ====================================================================
  // PHASE 2-C —— AI 海外客户研究 & 开发助手
  //   路由前缀: /console/ai/*
  //   后端实现: backend/src/routes/ai.ts
  //   命名空间: Console.AI.*
  // ====================================================================
  AI: {
    // ----- §12-14 Customer Research -----
    researchLead:   (leadId: string, force?: boolean) =>
      post<AIResearchJob>(`/console/ai/research/${leadId}`, { force: !!force }),
    getResearch:    (leadId: string) =>
      get<AIRsultBundle>(`/console/ai/research/${leadId}`),
    retryResearch:  (leadId: string) =>
      post<AIResearchJob>(`/console/ai/research/${leadId}/retry`, {}),

    // ----- §28 Edit Research Profile (manual edit keeps aiSnapshot) -----
    editProfile:    (leadId: string, d: Record<string, any>) =>
      patch<AIResearchProfile>(`/console/ai/profile/${leadId}`, d),

    // ----- §8 Lead Qualification (Intent + AI Score) -----
    scoreLead:      (leadId: string, force?: boolean) =>
      post<AIScoreResult>(`/console/ai/score/${leadId}`, { force: !!force }),

    // ----- §10-11 Product Match -----
    productMatch:      (leadId: string, force?: boolean) =>
      post<AIProductMatchResult>(`/console/ai/product-match/${leadId}`, { force: !!force }),
    getProductMatches: (leadId: string) =>
      get<AIProductMatch[]>(`/console/ai/product-match/${leadId}`),

    // ----- §21 Development Strategy -----
    generateStrategy: (leadId: string, force?: boolean) =>
      post<AIStrategyResult>(`/console/ai/strategy/${leadId}`, { force: !!force }),
    getStrategy:      (leadId: string) =>
      get<AIStrategyResult['strategy'] | null>(`/console/ai/strategy/${leadId}`),

    // ----- §22-25 Message Draft -----
    generateMessage: (leadId: string, d: { language: 'en'|'ar'|'zh'; channel: 'EMAIL'|'WHATSAPP'|'LINKEDIN'|'OTHER'; purpose: 'FIRST_CONTACT'|'FOLLOW_UP'|'INQUIRY_FOLLOW_UP'|'QUOTE_FOLLOW_UP'|'REACTIVATION' }) =>
      post<AIMessageDraftResult>(`/console/ai/message/${leadId}`, d),
    listMessageDrafts: (leadId: string, p?: ConsoleListParams) =>
      $list<AIMessageDraft>(`/console/ai/message-drafts/${leadId}`, p),
    editMessageDraft:   (draftId: string, d: Record<string, any>) =>
      patch<AIMessageDraft>(`/console/ai/message-drafts/${draftId}`, d),
    approveMessageDraft: (draftId: string) =>
      post<AIMessageDraft>(`/console/ai/message-drafts/${draftId}/approve`, {}),
    rejectMessageDraft:  (draftId: string, reason?: string) =>
      post<AIMessageDraft>(`/console/ai/message-drafts/${draftId}/reject`, { reason: reason || '' }),

    // ----- §42 Jobs -----
    listJobs:   (p?: ConsoleListParams) => $list<AIResearchJob>('/console/ai/jobs', p),
    jobDetail:  (id: string)            => $detail<AIResearchJob>(`/console/ai/jobs/${id}`),
    cancelJob:  (id: string)            => post<AIResearchJob>(`/console/ai/jobs/${id}/cancel`, {}),

    // ----- §32 Bulk Research (needs confirm=true) -----
    bulkResearch: (leadIds: string[], confirm = false) =>
      post<AIBulkResearchResult>('/console/ai/bulk/research', { leadIds, confirm }),

    // ----- §30/§43 Usage & Budget -----
    getUsage:  ()               => get<AIUsageSummary>('/console/ai/usage'),
    getBudget: (leadId?: string) => get<AIBudget>(leadId ? `/console/ai/budget?leadId=${leadId}` : '/console/ai/budget'),

    // ----- §29 Audit Log -----
    listAudit: (p?: ConsoleListParams) => $list<AIActionLog>('/console/ai/audit', p),

    // ----- §41 Dashboard -----
    dashboard: () => get<AIDashboardSummary>('/console/ai/dashboard'),

    // ----- Provider info -----
    getProvider: () => get<AIProviderInfo>('/console/ai/provider'),
  },
};

export default Console;

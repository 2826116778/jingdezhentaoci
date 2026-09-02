/**
 * 全局类型定义
 */
import { ReactNode } from 'react';

export type Lang = 'en' | 'ar';

export interface Bilingual {
  en: string;
  ar: string;
}

export type ProductCategory = 'tableware' | 'vase' | 'art-sculpture' | 'hotel-ware' | 'tiles' | 'oem-sample';
export type ProductMaterial = 'bone-china' | 'porcelain' | 'stoneware' | 'ceramic';
export type CaseCategory = 'hotel' | 'villa' | 'commercial';
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'refunded' | 'cancelled';
export type OrderType = 'retail' | 'dealer';
export type InquiryStatus = 'new' | 'read' | 'replied' | 'closed' | 'archived';
export type InquirySource = 'contact' | 'product' | 'quote' | 'oem';

// -------- 前端 Checkout 草稿（sessionStorage） --------
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
  sku?: string;
  moq?: number;
}
export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  country?: string;
  shippingAddress?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
}
export interface DealerInfo {
  company?: string;
  whatsapp?: string;
  country?: string;
  website?: string;
  adminNotes?: string;
  tags?: string[];
}
export interface CheckoutDraft {
  items: CartItem[];
  contactInfo: ContactInfo;
  customDemand: string;
  orderType?: OrderType;
}

export interface Product {
  _id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  category: ProductCategory;
  material: ProductMaterial;
  glazeColor: string;
  size: string;
  images: string[];
  detailImages: string[];
  isCustom: boolean;
  isStock: boolean;
  isPublished: boolean;
  moq: number;
  priceMin: number;
  priceMax: number;
  oemOptions: string[];
  careEn: string;
  careAr: string;
  shippingNoteEn: string;
  shippingNoteAr: string;
  featured: boolean;
  sort: number;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Case {
  _id: string;
  // 兼容：后端/前端可能用 titleX 或 nameX；两边都保留，渲染时 pickBilingual 容错
  titleEn: string;
  titleAr: string;
  nameEn: string;
  nameAr: string;
  clientNameEn: string;
  clientNameAr: string;
  locationEn: string;
  locationAr: string;
  year: number;
  category: CaseCategory;
  coverImage: string;
  images: string[];
  descEn: string;
  descAr: string;
  scopeEn: string;
  scopeAr: string;
  featured: boolean;
  isPublished: boolean;
  sort: number;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Inquiry {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  whatsapp: string;
  country?: string;
  company?: string;
  quantity?: number;
  budget?: number;
  targetDate?: string;
  subject?: string;
  message: string;
  customDemand: string;
  productId?: string;
  productName?: string;
  attachmentUrls?: string[];
  status: InquiryStatus;
  source: InquirySource;
  createdAt: string;
  updatedAt: string;
}

export interface OrderContact {
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  country?: string;
  company?: string;
  shippingAddress?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
}

export interface OrderItem {
  productId?: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
}

// 后台列表用的订单（比 OrderSummary 多字段）
export interface OrderListItem {
  _id: string;
  orderNo: string;
  orderType?: OrderType;
  items: OrderItem[];
  amount: number;
  paymentStatus: PaymentStatus;
  txHash?: string;
  txHashShort?: string;
  merchantAddress: string;
  contactInfo: ContactInfo;
  dealerInfo?: DealerInfo;
  customDemand?: string;
  orderExpireAt: string;
  createdAt: string;
  paidAt?: string;
  blockConfirmations?: number;
}

export interface OrderSummary extends OrderListItem {
  usdtTolerance: number;
  tronNetwork: 'nile' | 'mainnet';
  usdtContractAddress: string;
  ttlSeconds?: number;
  qrcodeBase64?: string;
}

// 后台 Dashboard 汇总
export interface DashboardSummary {
  ordersTotal: number;
  ordersPaid: number;
  ordersPending: number;
  ordersExpired: number;
  revenuePaid: number;
  productsTotal: number;
  casesTotal: number;
  inquiriesTotal: number;
  inquiriesUnread: number;
}

export interface Admin {
  _id?: string;
  id?: string;
  username: string;
  role: 'superadmin' | 'editor' | 'admin';
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface ToastOptions {
  type?: 'success' | 'error' | 'info';
  text: string;
  duration?: number;
}

// ================================================================
// PHASE 1 外贸业务工作台（Console）基础类型 — 扩展位，Phase 2+ 补齐
// 设计原则：
//  - 任何 "list endpoint" 返回标准分页 ConsolePage<T>
//  - 任何 "get/:id endpoint" 返回 T | null
//  - Dashboard / Analytics 返回嵌套结构 + 空数组，不造假数字
// ================================================================

/** 所有 console list 接口统一分页结构 */
export interface ConsolePage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 工作台当前用户（对齐后端 /api/console/me，返回 req.admin） */
export interface ConsoleMe {
  id: string;
  username: string;
  role: string;
  avatar: string | null;
  timezone: string;
  locale: string;
}

// —— Dashboard ——
export interface ConsoleDashboardKPIs {
  totalLeads: number;
  totalCustomers: number;
  totalInquiries: number;
  totalQuotes: number;
  totalOrders: number;
  totalOrderAmountUsd: number;
  pendingTasks: number;
  upcomingFollowups: number;
  conversionRate: number;
}
export type TimeSeriesPoint = { date: string; count: number };
export type RevenuePoint    = { date: string; count: number; amount: number };
export type BySourcePoint   = { source: string; count: number };
export type ByCountryPoint  = { country: string; count: number };
export interface ConsoleDashboardCharts {
  leadsLast30Days:   TimeSeriesPoint[];
  ordersLast30Days:  RevenuePoint[];
  inquiriesBySource: BySourcePoint[];
  topCountries:      ByCountryPoint[];
}
export interface ConsoleDashboardSummary {
  kpis: ConsoleDashboardKPIs;
  charts: ConsoleDashboardCharts;
  recent: {
    inquiries: unknown[];
    orders:    unknown[];
    tasks:     unknown[];
  };
}

// —— Console 实体类型（PHASE 2-A：与后端 Model 对齐，字段严格真实）——
export interface ConsoleCompany {
  _id: string; id?: string;
  name: string; nameEn?: string; nameAr?: string;
  website: string; country: string; city: string; address: string;
  industry: string; companyType: string;
  employeeCount?: number; annualPurchaseValueUsd?: number;
  profile: string;
  source: string; sourceUrl?: string;
  tags: string[]; notes: string;
  ownerId?: string;
  createdAt: string; updatedAt: string;
  [k: string]: any;
}

export interface ConsoleContact {
  _id: string; id?: string;
  companyId?: string; customerId?: string;
  name: string; jobTitle: string;
  email: string; phone: string; whatsapp: string; linkedin: string;
  isPrimary: boolean;
  notes: string;
  ownerId?: string;
  createdAt: string; updatedAt: string;
  [k: string]: any;
}

export interface ConsoleLead {
  _id: string; id?: string;
  companyName: string;
  website: string; country: string; city: string;
  industry: string; companyType: string;
  contactName: string; jobTitle: string;
  email: string; phone: string; whatsapp: string; linkedin: string;
  source: string; sourceUrl: string;
  productInterest: string[];
  purchaseIntent: 'none' | 'low' | 'medium' | 'high';
  estimatedPurchaseVolume: string;
  score: number; grade: 'A' | 'B' | 'C' | 'D';
  status: 'NEW' | 'RESEARCHING' | 'QUALIFIED' | 'CONTACTED' | 'REPLIED' | 'INTERESTED' | 'INQUIRY' | 'CONVERTED' | 'LOST';
  // PHASE 3-A: AI 客户开发生命周期状态机（独立于 status）
  devStatus?: 'NEW' | 'RESEARCHING' | 'RESEARCHED' | 'QUALIFIED' | 'CONTACT_READY' | 'CONTACTED' | 'REPLIED' | 'FOLLOW_UP' | 'QUALIFIED_OPPORTUNITY' | 'QUOTE_READY' | 'WON' | 'LOST';
  ownerId?: string;
  customerId?: string; companyId?: string;
  tags: string[]; notes: string;
  lastContactAt?: string; nextFollowUpAt?: string;
  createdAt: string; updatedAt: string;
  // ===== PHASE 2-B 海外客户开发中心扩展 =====
  // 多社交平台
  instagram?: string;
  facebook?: string;
  xHandle?: string;       // X / Twitter
  tiktok?: string;
  // 评分原因（0-100 算法生成）
  scoreReasons?: string[];
  // 追溯：来自哪次 Import / 哪个 Campaign
  importId?: string;
  campaignId?: string;
  // 客户研究（MANUAL_RESEARCH / IMPORTED_DATA / AI_RESEARCH）
  researchType?: 'MANUAL_RESEARCH' | 'IMPORTED_DATA' | 'AI_RESEARCH';
  researchNotes?: string;
  // 列表页常用扩展
  [k: string]: any;
}

export interface ConsoleLeadDetail extends ConsoleLead {
  // 详情聚合：FollowUps / Interactions / Timeline
  followups?: ConsoleFollowUp[];
  interactions?: ConsoleInteraction[];
  timeline?: ConsoleInteraction[];
  campaign?: ConsoleLeadCampaign | null;
  import?: ConsoleLeadImport | null;
  customer?: ConsoleCustomer | null;
  company?: ConsoleCompany | null;
  contact?: ConsoleContact | null;
  [k: string]: any;
}

export interface ConsoleCustomer {
  _id: string; id?: string;
  companyId: string;
  customerCode: string;
  customerLevel: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'PROSPECT';
  status: 'ACTIVE' | 'PENDING' | 'AT_RISK' | 'INACTIVE' | 'CHURNED';
  source: string;
  ownerId?: string;
  score: number;
  tags: string[]; notes: string;
  lastContactAt?: string; nextFollowUpAt?: string;
  createdAt: string; updatedAt: string;
  [k: string]: any;
}

export interface ConsoleCustomerDetail extends ConsoleCustomer {
  company?: ConsoleCompany | null;
  contacts?: ConsoleContact[];
  timeline?: ConsoleInteraction[];
  inquiries?: ConsoleInquiry[];
  quotes?: ConsoleQuote[];
  orders?: ConsoleOrder[];
  followups?: ConsoleFollowUp[];
  tasks?: ConsoleTask[];
}

export type FollowUpType = 'EMAIL' | 'WHATSAPP' | 'PHONE' | 'MEETING' | 'SOCIAL' | 'OTHER';
export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';

export interface ConsoleFollowUp {
  _id: string; id?: string;
  customerId?: string; leadId?: string; contactId?: string;
  type: FollowUpType;
  content: string; result: string; nextAction: string;
  scheduledAt: string; completedAt?: string;
  ownerId?: string;
  status: FollowUpStatus;
  createdAt: string; updatedAt: string;
  [k: string]: any;
}

export type TaskType = 'FOLLOW_UP' | 'INQUIRY_REPLY' | 'QUOTE_PREPARE' | 'ORDER_FOLLOW' | 'RESEARCH' | 'MEETING' | 'OTHER';
export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';

export interface ConsoleTask {
  _id: string; id?: string;
  title: string; description: string;
  customerId?: string; leadId?: string;
  type: TaskType; priority: TaskPriority; status: TaskStatus;
  dueAt?: string; completedAt?: string;
  ownerId?: string;
  createdAt: string; updatedAt: string;
  [k: string]: any;
}

export type InteractionType =
  | 'LEAD_CREATED' | 'LEAD_CONTACTED' | 'LEAD_REPLIED' | 'LEAD_CONVERTED'
  | 'EMAIL_SENT' | 'EMAIL_RECEIVED'
  | 'WHATSAPP_SENT' | 'WHATSAPP_RECEIVED'
  | 'CALL' | 'MEETING'
  | 'INQUIRY_CREATED'
  | 'QUOTE_CREATED' | 'QUOTE_SENT' | 'QUOTE_ACCEPTED' | 'QUOTE_REJECTED'
  | 'ORDER_CREATED' | 'ORDER_PAID' | 'ORDER_COMPLETED'
  | 'FOLLOWUP_CREATED' | 'FOLLOWUP_COMPLETED'
  | 'TASK_CREATED' | 'TASK_COMPLETED'
  | 'NOTE' | 'SYSTEM';

export interface ConsoleInteraction {
  _id: string; id?: string;
  customerId?: string; leadId?: string; companyId?: string; contactId?: string;
  type: InteractionType;
  title: string; content: string;
  sourceRef?: { model: string; id: string };
  ownerId?: string;
  occurredAt: string;
  createdAt: string; updatedAt: string;
  [k: string]: any;
}

export type InquiryStage = 'NEW' | 'PROCESSING' | 'QUALIFIED' | 'QUOTED' | 'NEGOTIATING' | 'WON' | 'LOST';
export type InquiryPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ConsoleInquiry {
  _id: string; id?: string;
  name: string; email: string;
  phone?: string; whatsapp: string;
  country?: string; company?: string;
  quantity?: number; budget?: number;
  subject?: string; message: string; customDemand: string;
  productId?: string; productName?: string;
  status: InquiryStatus;
  source: 'contact' | 'product' | 'quote' | 'oem' | 'website';
  // PHASE 2-A 新增
  stage: InquiryStage;
  leadId?: string; customerId?: string; companyId?: string; contactId?: string; ownerId?: string;
  priority: InquiryPriority;
  estimatedValue?: number; expectedCloseDate?: string;
  createdAt: string; updatedAt: string;
  [k: string]: any;
}

export type QuoteStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'NEGOTIATING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface ConsoleQuoteItem {
  productId?: string; sku: string; name: string;
  quantity: number; unitPrice: number; amount: number;
  notes: string;
  [k: string]: any;
}

export interface ConsoleQuote {
  _id: string; id?: string;
  quoteNo: string;
  customerId?: string; inquiryId?: string;
  items: ConsoleQuoteItem[];
  currency: string;
  subtotal: number; shippingFee: number; discount: number; tax: number; total: number;
  incoterm: string; paymentTerms: string;
  validUntil?: string;
  status: QuoteStatus;
  notes: string;
  createdBy?: string;
  createdAt: string; updatedAt: string;
  [k: string]: any;
}

export interface ConsoleOrder {
  _id: string; id?: string;
  orderNo: string;
  orderType: OrderType;
  items: OrderItem[];
  totalAmount: number; usdtAmount: number;
  contactInfo: ContactInfo;
  dealerInfo?: DealerInfo;
  customDemand: string;
  paymentStatus: PaymentStatus;
  txHash?: string;
  paidAt?: string; expiredAt?: string;
  customerId?: string; inquiryId?: string; quoteId?: string; ownerId?: string;
  createdAt: string; updatedAt: string;
  [k: string]: any;
}

// —— Analytics Overview ——
export interface ConsoleAnalyticsOverview {
  period: string;
  funnels: {
    leads: number;
    inquiries: number;
    quotes: number;
    orders: number;
  };
  bySource:   Array<{ source: string; leads: number; orders: number; revenue: number }>;
  byCountry:  Array<{ country: string; leads: number; orders: number; revenue: number }>;
  byProduct:  Array<{ productId: string; sku: string; name: string; orders: number; revenue: number }>;
  bySalesRep: Array<{ salesRep: string; leads: number; orders: number; revenue: number }>;
}

// =========================
// PHASE 2-B: Overseas Customer Development Center
// =========================

export interface ConsoleLeadCampaign {
  _id: string;
  name: string;
  description: string;
  countries: string[];
  cities: string[];
  industries: string[];
  companyTypes: string[];
  productInterests: string[];
  targetLeadCount: number;
  actualLeadCount: number;
  ownerId?: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  startDate?: string;
  endDate?: string;
  imported?: number;
  qualified?: number;
  contacted?: number;
  replied?: number;
  interested?: number;
  inquiry?: number;
  converted?: number;
  lost?: number;
  funnel?: LeadFunnel;
  createdAt: string;
  updatedAt: string;
  [k: string]: any;
}

export interface LeadFunnel {
  imported: number;
  qualified: number;
  contacted: number;
  replied: number;
  interested: number;
  inquiry: number;
  converted: number;
  lost: number;
}

export interface ConsoleLeadImport {
  _id: string;
  fileName: string;
  fileType: 'csv' | 'xlsx' | 'json';
  fileSize: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  fieldMapping?: Record<string, string>;
  duplicateStrategy: 'SKIP' | 'UPDATE' | 'CREATE_ANYWAY';
  campaignId?: string;
  status: 'UPLOADED' | 'PARSED' | 'MAPPED' | 'VALIDATED' | 'IMPORTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  errorMsg?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  [k: string]: any;
}

export interface ConsoleLeadImportRow {
  _id: string;
  importId: string;
  rowIndex: number;
  data: Record<string, any>;
  status: 'VALID' | 'INVALID' | 'DUPLICATE' | 'IMPORTED' | 'SKIPPED' | 'UPDATED';
  errors: string[];
  duplicateLeadId?: string;
  importedLeadId?: string;
  [k: string]: any;
}

export interface ConsoleMessageTemplate {
  _id: string;
  name: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'LINKEDIN' | 'OTHER';
  language: string;
  subject: string;
  content: string;
  variables: string[];
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  [k: string]: any;
}

export interface ConsoleDevelopmentTask {
  _id: string;
  title: string;
  description: string;
  campaignId?: string;
  leadIds: string[];
  ownerId?: string;
  assignedTo?: string[];
  type: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  dueAt?: string;
  completedAt?: string;
  totalLeads?: number;
  funnel?: LeadFunnel;
  createdAt: string;
  updatedAt: string;
  [k: string]: any;
}

export interface ConsoleMarketConfig {
  _id: string;
  countryCode: string;
  countryName: string;
  priority: number;
  isActive: boolean;
  cities: string[];
  defaultProductInterests: string[];
  notes: string;
  [k: string]: any;
}

export interface ConsoleDevelopmentOverview {
  totalCampaigns: number;
  activeCampaigns: number;
  totalImports: number;
  totalLeads: number;
  totalDevTasks: number;
  funnel: LeadFunnel;
  topCountries: Array<{ country: string; count: number }>;
  topSources: Array<{ source: string; count: number }>;
}

export interface ConsoleLeadScoreResult {
  leadId: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  reasons: string[];
}

export interface ConsoleAcquisitionAnalytics {
  funnel: LeadFunnel & { conversionRate: number };
  byCampaign: Array<{ campaignId: string; campaignName: string; leads: number; qualified: number; contacted: number; replied: number; interested?: number; inquiry: number; converted: number; lost?: number; conversionRate: number; replyRate?: number; inquiryRate?: number; orderRate?: number }>;
  bySource: Array<{ source: string; leads: number; contacted: number; replied: number; inquiry: number; converted: number; replyRate: number; inquiryRate: number; orderRate: number }>;
  byCountry: Array<{ country: string; leads: number; qualified: number; contacted: number; replied: number; inquiry: number; converted: number; conversionRate: number }>;
}

// ====================================================================
// PHASE 2-C AI 海外客户研究 & 开发助手
// ====================================================================

/** §2 置信度 — AI 不得伪造信息：未知字段必须 UNKNOWN */
export type AIConfidence = 'CONFIRMED' | 'INFERRED' | 'UNKNOWN';

/** §2 AI 研究字段封装：值 + 置信度 + 原因 */
export interface AIField<T> {
  value: T;
  confidence: AIConfidence;
  reason?: string;
}

/** §15 AI 研究来源 — 禁止制造 URL */
export interface AISourceRef {
  url: string;
  title: string;
  sourceType: string;
  retrievedAt?: string;
}

/** §5 AI 研究结果 Profile */
export interface AIResearchProfile {
  _id: string;
  leadId: string;
  jobId?: string;
  companySummary: AIField<string>;
  businessModel: AIField<string>;
  industry: AIField<string>;
  companyType: AIField<string>;
  marketPosition: AIField<string>;
  targetCustomers: AIField<string[]>;
  productCategories: AIField<string[]>;
  potentialNeeds: AIField<string[]>;
  possibleCeramicDemand: AIField<string>;
  purchaseSignals: AIField<string[]>;
  riskSignals: AIField<string[]>;
  recommendedProducts: AIField<string[]>;
  recommendedApproach: AIField<string>;
  confidence: number;
  sources: AISourceRef[];
  researchStatus: 'AI_RESEARCH' | 'MANUAL_EDIT' | 'STALE';
  editSource: 'AI' | 'MANUALLY_EDITED' | 'IMPORTED';
  aiSnapshot?: any;
  createdAt: string;
  updatedAt: string;
  [k: string]: any;
}

/** §4 AI 研究任务 Job */
export interface AIResearchJob {
  _id: string;
  leadId: string;
  purpose: 'CUSTOMER_RESEARCH' | 'LEAD_QUALIFICATION' | 'PRODUCT_MATCHING' | 'DEVELOPMENT_STRATEGY' | 'MESSAGE_DRAFT';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  provider: string;
  aiModel: string;
  promptVersion: string;
  inputSnapshot: any;
  result?: any;
  confidence?: number;
  sources?: AISourceRef[];
  error?: string;
  errorKind?: string;
  tokenUsage?: { input: number; output: number; total: number };
  estimatedCostUsd?: number;
  startedAt?: string;
  completedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  [k: string]: any;
}

/** §7 采购意向 */
export interface AIPurchaseIntent {
  score: number;
  grade: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  reasons: string[];
  risks: string[];
}

/** §8 AI Lead 评分（复合） */
export interface AILeadScore {
  ruleScore: number;
  aiScore: number;
  purchaseIntent: number;
  dataCompleteness: number;
  finalScore: number;
  reasons: string[];
  risks: string[];
}

/** §11 产品匹配 */
export interface AIProductMatch {
  productId: string;
  matchScore: number;
  reason: string;
  confidence: AIConfidence;
  [k: string]: any;
}

/** §21 开发策略 */
export interface AIDevelopmentStrategy {
  targetPersona: AIField<string>;
  painPoints: AIField<string[]>;
  potentialProducts: AIField<string[]>;
  recommendedValueProposition: AIField<string>;
  recommendedChannel: AIField<string>;
  recommendedTiming: AIField<string>;
  followUpStrategy: AIField<string>;
  confidence: number;
  sources: AISourceRef[];
  [k: string]: any;
}

/** §22 AI 话术草稿 */
export interface AIMessageDraft {
  _id: string;
  leadId: string;
  jobId?: string;
  language: 'en' | 'ar' | 'zh';
  channel: 'EMAIL' | 'WHATSAPP' | 'LINKEDIN' | 'OTHER';
  purpose: 'FIRST_CONTACT' | 'FOLLOW_UP' | 'INQUIRY_FOLLOW_UP' | 'QUOTE_FOLLOW_UP' | 'REACTIVATION';
  subject: string;
  content: string;
  personalization: string[];
  reason: string;
  status: 'DRAFT' | 'EDITED' | 'APPROVED' | 'REJECTED' | 'SENT';
  aiSnapshot?: any;
  createdAt: string;
  updatedAt: string;
  [k: string]: any;
}

/** §29 AI 审计日志 */
export interface AIActionLog {
  _id: string;
  userId?: string;
  leadId?: string;
  jobId?: string;
  action: string;
  provider: string;
  aiModel: string;
  promptVersion?: string;
  status: 'OK' | 'FAILED' | 'CANCELLED';
  tokenUsage?: { input: number; output: number; total: number };
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  [k: string]: any;
}

/** §30 AI 用量统计 */
export interface AIUsageSummary {
  today: { requests: number; tokens: number; cost: number; failed: number };
  thisWeek: { requests: number; tokens: number; cost: number; failed: number };
  thisMonth: { requests: number; tokens: number; cost: number; failed: number };
  total: { requests: number; tokens: number; cost: number; failed: number };
}

/** §41 AI Dashboard 概览 */
export interface AIDashboardSummary {
  jobs: { total: number; completed: number; failed: number; queued: number; running: number };
  aiLeads: number;
  highIntentLeads: number;
  messageDrafts: { total: number; approved: number };
  usage: AIUsageSummary;
  recentJobs: AIResearchJob[];
  provider: { active: string; model: string; isConfigured: boolean };
}

/** §43 AI Provider 元信息 */
export interface AIProviderInfo {
  active: string;
  isConfigured: boolean;
  model: string;
  timeoutMs: number;
  concurrency: number;
  limits: { daily: number; monthly: number; perLead: number };
}

/** §31 AI 预算状态 */
export interface AIBudget {
  daily: number;
  monthly: number;
  perLead: number;
  limits: { daily: number; monthly: number; perLead: number };
  blocked?: boolean;
  message?: string;
}

/** §12 研究查询响应 */
export interface AIRsultBundle {
  profile: AIResearchProfile | null;
  latestJob: AIResearchJob | null;
  latestFailedJob: AIResearchJob | null;
  hasCompleted: boolean;
  canRefresh: boolean;
}

/** §8 评分查询响应 */
export interface AIScoreResult {
  lead: any;
  intent: AIPurchaseIntent;
  score: AILeadScore;
  job: AIResearchJob;
}

/** §10 产品匹配响应 */
export interface AIProductMatchResult {
  matches: AIProductMatch[];
  job: AIResearchJob;
}

/** §21 策略响应 */
export interface AIStrategyResult {
  strategy: AIDevelopmentStrategy | null;
  job: AIResearchJob;
}

/** §25 消息草稿响应 */
export interface AIMessageDraftResult {
  draft: any;
  doc: AIMessageDraft;
  job: AIResearchJob;
}

/** §32 批量研究响应 */
export interface AIBulkResearchResult {
  queued: number;
  jobs: AIResearchJob[];
  confirmRequired?: boolean;
  message?: string;
}

// ====================================================================
// PHASE 3-A — AI Customer Development Center
//   路由前缀: /console/ai/development/*
//   后端实现: backend/src/routes/aiDevelopment.ts
//   命名空间: Console.AI.Development.*
// ====================================================================
export type DevStatus =
  | 'NEW' | 'RESEARCHING' | 'RESEARCHED' | 'QUALIFIED'
  | 'CONTACT_READY' | 'CONTACTED' | 'REPLIED' | 'FOLLOW_UP'
  | 'QUALIFIED_OPPORTUNITY' | 'QUOTE_READY' | 'WON' | 'LOST';

/** 状态机转换历史（不可覆盖，仅追加） */
export interface LeadDevelopmentHistoryItem {
  _id: string;
  leadId: string;
  fromStatus: DevStatus | null;
  toStatus: DevStatus;
  changedBy?: string;
  reason: string;
  source: 'MANUAL' | 'AI_RESEARCH' | 'AI_QUALIFICATION' | 'AI_MESSAGE_APPROVE' | 'SYSTEM';
  metadata?: any;
  createdAt: string;
}

/** Lead Development 详情聚合 */
export interface LeadDevelopmentDetail {
  lead: ConsoleLead;
  profile: AIResearchProfile | null;
  matches: AIProductMatch[];
  strategy: AIDevelopmentStrategy | null;
  drafts: AIMessageDraft[];
  history: LeadDevelopmentHistoryItem[];   // devStatus 时间线
  jobs: AIResearchJob[];                     // AI 任务历史
  audit: AIActionLog[];                       // AI 操作审计
  provider: {
    active: 'mock' | 'openai';
    isConfigured: boolean;
    aiModel: string;
  };
}

/** AI action 后置响应（含 lead + devStatus 变更） */
export interface AIDevActionResponse<T = any> {
  lead?: ConsoleLead;
  draft?: AIMessageDraft;
  doc?: AIMessageDraft;
  matches?: AIProductMatch[];
  strategy?: AIDevelopmentStrategy | null;
  job: AIResearchJob;
  intent?: any;
  score?: any;
  [k: string]: any;
}

/** Status transition 响应 */
export interface AIDevStatusTransition {
  from: DevStatus | null;
  to: DevStatus;
  lead: ConsoleLead;
}

/** Approve message 响应 */
export interface AIDevApproveResponse {
  draft: AIMessageDraft;
  devStatus?: DevStatus;
}

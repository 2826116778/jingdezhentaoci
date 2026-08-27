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

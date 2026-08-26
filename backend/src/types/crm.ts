/**
 * PHASE 2-A 统一枚举 & 常量。
 * ⚠️ 所有业务状态/类型/优先级 统一在这里定义，禁止在 Models / Routes / Frontend 中散落字符串。
 *
 * 与现有系统兼容策略：
 *  - INQUIRY 有两套状态：
 *      · 旧 InquiryStatus (new/read/replied/closed/archived) — 保留在 Inquiry 模型上，不破坏旧 CMS & 公开表单
 *      · 新 InquiryStage  (NEW/PROCESSING/QUALIFIED/QUOTED/NEGOTIATING/WON/LOST) — 业务工作台用
 *    并提供 INQUIRY_STATUS_TO_STAGE 兼容映射：写 Inquiry.legacy status 时自动同步 stage 缺省值
 */

// =========================
// Lead
// =========================
export const LEAD_STATUSES = [
  'NEW',          // 新线索
  'RESEARCHING',  // 调研中
  'QUALIFIED',    // 已确认有效
  'CONTACTED',    // 已联系（我方主动）
  'REPLIED',      // 对方已回复
  'INTERESTED',   // 对方表示有兴趣
  'INQUIRY',      // 已发正式询盘
  'CONVERTED',    // 已转 Customer
  'LOST',         // 丢失/无效
] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

export const LEAD_GRADES = ['A', 'B', 'C', 'D'] as const;
export type LeadGrade = typeof LEAD_GRADES[number];

// Lead 来源（Phase 2 可加爬虫 / auto 来源）
export const LEAD_SOURCES = [
  'website',       // 站点表单 (即 inquiry)
  'manual',        // 手动录入
  'linkedin',      // LinkedIn — Phase 2
  'google',        // Google   — Phase 2
  'instagram',     // Instagram — Phase 2
  'alibaba',
  'exhibition',
  'referral',
  'import',        // CSV 批量导入
  'other',
] as const;
export type LeadSource = typeof LEAD_SOURCES[number];

export const COMPANY_TYPES = [
  'retailer',
  'wholesaler',
  'distributor',
  'hotel',
  'restaurant',
  'interior_designer',
  'project_contractor',
  'ecommerce',
  'brand_owner',
  'importer',
  'other',
] as const;
export type CompanyType = typeof COMPANY_TYPES[number];

export const INDUSTRIES = [
  'hospitality',
  'residential',
  'retail',
  'ecommerce',
  'construction',
  'interior_design',
  'food_beverage',
  'luxury_goods',
  'art_collectibles',
  'government',
  'education',
  'other',
] as const;
export type Industry = typeof INDUSTRIES[number];

// =========================
// Customer
// =========================
export const CUSTOMER_LEVELS = [
  'PLATINUM',
  'GOLD',
  'SILVER',
  'BRONZE',
  'PROSPECT',
] as const;
export type CustomerLevel = typeof CUSTOMER_LEVELS[number];

export const CUSTOMER_STATUSES = [
  'ACTIVE',
  'PENDING',      // 刚转换，未成交
  'AT_RISK',      // 久未联系
  'INACTIVE',
  'CHURNED',
] as const;
export type CustomerStatus = typeof CUSTOMER_STATUSES[number];

// =========================
// FollowUp
// =========================
export const FOLLOWUP_TYPES = [
  'EMAIL',
  'WHATSAPP',
  'PHONE',
  'MEETING',
  'SOCIAL',
  'OTHER',
] as const;
export type FollowUpType = typeof FOLLOWUP_TYPES[number];

export const FOLLOWUP_STATUSES = [
  'PENDING',
  'COMPLETED',
  'CANCELLED',
  'OVERDUE',
] as const;
export type FollowUpStatus = typeof FOLLOWUP_STATUSES[number];

// =========================
// Task
// =========================
export const TASK_TYPES = [
  'FOLLOW_UP',
  'INQUIRY_REPLY',
  'QUOTE_PREPARE',
  'ORDER_FOLLOW',
  'RESEARCH',
  'MEETING',
  'OTHER',
] as const;
export type TaskType = typeof TASK_TYPES[number];

export const TASK_PRIORITIES = [
  'URGENT',
  'HIGH',
  'MEDIUM',
  'LOW',
] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

export const TASK_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

// =========================
// Quote
// =========================
export const QUOTE_STATUSES = [
  'DRAFT',
  'SENT',
  'VIEWED',
  'NEGOTIATING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
] as const;
export type QuoteStatus = typeof QUOTE_STATUSES[number];

// =========================
// Inquiry: NEW STAGE（Console 业务工作台）— 与 legacy status 兼容
// =========================
export const INQUIRY_STAGES = [
  'NEW',          // 刚到
  'PROCESSING',   // 处理中
  'QUALIFIED',    // 已确认有效询盘
  'QUOTED',       // 已报价
  'NEGOTIATING',  // 谈判中
  'WON',          // 成交（→ Order）
  'LOST',         // 未成交
] as const;
export type InquiryStage = typeof INQUIRY_STAGES[number];

// 旧 status → 新 stage 的默认映射（只在 stage 未设置时作为回退）
export const INQUIRY_LEGACY_STATUS_TO_STAGE: Record<string, InquiryStage> = {
  new:      'NEW',
  read:     'PROCESSING',
  replied:  'QUOTED',   // 已回复通常已给初步报价
  closed:   'WON',      // 保守兼容
  archived: 'LOST',
};

// =========================
// Interaction / Timeline（统一 Customer / Lead 时间线事件）
// =========================
export const INTERACTION_TYPES = [
  // —— Lead lifecycle ——
  'LEAD_CREATED',
  'LEAD_CONTACTED',
  'LEAD_REPLIED',
  'LEAD_CONVERTED',
  // —— Email ——
  'EMAIL_SENT',
  'EMAIL_RECEIVED',
  // —— WhatsApp ——
  'WHATSAPP_SENT',
  'WHATSAPP_RECEIVED',
  // —— Call / Meeting
  'CALL',
  'MEETING',
  // —— Business pipeline ——
  'INQUIRY_CREATED',
  'QUOTE_CREATED',
  'QUOTE_SENT',
  'QUOTE_ACCEPTED',
  'QUOTE_REJECTED',
  'ORDER_CREATED',
  'ORDER_PAID',
  'ORDER_COMPLETED',
  // —— FollowUp / Task lifecycle ——
  'FOLLOWUP_CREATED',
  'FOLLOWUP_COMPLETED',
  'TASK_CREATED',
  'TASK_COMPLETED',
  // —— 通用备注
  'NOTE',
  'SYSTEM',
] as const;
export type InteractionType = typeof INTERACTION_TYPES[number];

// =========================
// 通用：Owner 权限角色（Phase 2 细粒度权限扩展，当前用 admin.role 对齐）
// =========================
export const OWNER_ROLES = ['superadmin', 'sales', 'editor'] as const;
export type OwnerRole = typeof OWNER_ROLES[number];

// =========================
// 生成 quoteNo / customerCode 等前缀常量（集中配置，避免散落在路由里）
// =========================
export const CODE_PREFIXES = {
  QUOTE:    'QT',
  CUSTOMER: 'CU',
};

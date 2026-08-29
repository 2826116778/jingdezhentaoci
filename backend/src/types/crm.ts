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
  CAMPAIGN: 'CMP',
  IMPORT:   'IMP',
  DEVTASK:  'DEV',
  SCORING:  'SCR',
} as const;

// =========================
// PHASE 2-B: Lead Discovery / 客户开发中心
// =========================

// Campaign 状态
export const CAMPAIGN_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];

// Import 状态
export const IMPORT_STATUSES = [
  'UPLOADED',    // 文件已上传，待解析
  'PARSED',      // 解析完成，待映射
  'MAPPED',      // 字段映射完成，待校验
  'VALIDATED',   // 校验+去重完成，待确认
  'IMPORTING',   // 正在写入数据库
  'COMPLETED',   // 导入完成
  'FAILED',      // 导入失败
  'CANCELLED',   // 用户取消
] as const;
export type ImportStatus = typeof IMPORT_STATUSES[number];

// Import Row 状态（单行）
export const IMPORT_ROW_STATUSES = [
  'VALID',       // 有效，可导入
  'INVALID',     // 数据格式错误
  'DUPLICATE',   // 与已有 Lead 重复
  'IMPORTED',    // 已成功写入
  'SKIPPED',     // 用户选择跳过
  'UPDATED',     // 更新了已有 Lead
] as const;
export type ImportRowStatus = typeof IMPORT_ROW_STATUSES[number];

// 重复处理策略
export const DUPLICATE_STRATEGIES = [
  'SKIP',          // 跳过
  'UPDATE',        // 更新已有 Lead
  'CREATE_ANYWAY', // 强制新建
] as const;
export type DuplicateStrategy = typeof DUPLICATE_STRATEGIES[number];

// 扩展 Lead 来源（PHASE 2-B 新增更多渠道）
export const LEAD_SOURCES_EXTENDED = [
  ...LEAD_SOURCES,
  'facebook',
  'tiktok',
  'x',
  'made_in_china',
  'global_sources',
  'trade_show',
  'csv_import',
  'excel_import',
  'cold_email',
  'whatsapp',
] as const;

// Message Template channel
export const TEMPLATE_CHANNELS = [
  'EMAIL',
  'WHATSAPP',
  'LINKEDIN',
  'OTHER',
] as const;
export type TemplateChannel = typeof TEMPLATE_CHANNELS[number];

// Message Template status
export const TEMPLATE_STATUSES = [
  'ACTIVE',
  'DRAFT',
  'ARCHIVED',
] as const;
export type TemplateStatus = typeof TEMPLATE_STATUSES[number];

// 陶瓷产品兴趣分类（PHASE 2-B：前端下拉与 Lead 评分匹配用）
export const PRODUCT_INTERESTS = [
  'Tableware',
  'Dinnerware',
  'Tea Set',
  'Coffee Set',
  'Hotelware',
  'Home Decor',
  'Vases',
  'Giftware',
  'Art Ceramics',
  'Custom Ceramics',
  'OEM',
  'ODM',
] as const;
export type ProductInterest = typeof PRODUCT_INTERESTS[number];

// 行业（PHASE 2-B：与 INDUSTRIES 兼容，但面向海外客户更细化的行业标签）
export const TARGET_INDUSTRIES = [
  'Hotel',
  'Restaurant',
  'Hospitality',
  'Interior Design',
  'Architecture',
  'Home Decor',
  'Ceramic Distributor',
  'Ceramic Wholesaler',
  'Importer',
  'Retailer',
  'Gift',
  'Tea',
  'Coffee',
  'Furniture',
  'Luxury',
  'Real Estate',
] as const;

// 客户类型（PHASE 2-B：与 COMPANY_TYPES 兼容，更面向海外买家）
export const TARGET_COMPANY_TYPES = [
  'Importer',
  'Distributor',
  'Wholesaler',
  'Retailer',
  'Hotel',
  'Restaurant',
  'Cafe',
  'Interior Designer',
  'Architect',
  'Trading Company',
  'Brand',
  'E-commerce',
  'Gift Company',
] as const;

// 研究来源类型（区分数据是手动调研还是导入数据）
export const RESEARCH_TYPES = [
  'MANUAL_RESEARCH',
  'IMPORTED_DATA',
  'AI_RESEARCH',
] as const;
export type ResearchType = typeof RESEARCH_TYPES[number];

// Interaction Types 扩展（PHASE 2-B 新增）
export const INTERACTION_TYPES_2B = [
  ...INTERACTION_TYPES,
  'LEAD_IMPORTED',
  'CAMPAIGN_CREATED',
  'CAMPAIGN_UPDATED',
  'LEAD_SCORED',
  'LEAD_ASSIGNED',
  'DEV_TASK_CREATED',
  'DEV_TASK_UPDATED',
] as const;

// =========================
// PHASE 3-A: Lead Development Lifecycle（独立于 Lead.status 的开发状态机）
// 设计原则：不破坏 PHASE 2-A/2-B 已有的 Lead.status 枚举与逻辑；
// 新增独立字段 Lead.devStatus 用于跟踪 AI 客户开发流程。
// =========================
export const DEV_STATUSES = [
  'NEW',                    // 新线索，未开始 AI 开发
  'RESEARCHING',            // AI Research 进行中
  'RESEARCHED',             // AI Research 完成
  'QUALIFIED',              // AI Qualification 完成
  'CONTACT_READY',          // Message Draft 已人工批准，可发起联系
  'CONTACTED',              // 已发起首次联系（人工标记，禁止 AI 自动发送）
  'REPLIED',                // 对方已回复
  'FOLLOW_UP',              // 进入 Follow-up 阶段
  'QUALIFIED_OPPORTUNITY',  // 已确认为有效商机
  'QUOTE_READY',            // 准备发报价
  'WON',                    // 成交
  'LOST',                   // 丢失 / 无效（终态）
] as const;
export type DevStatus = typeof DEV_STATUSES[number];

/**
 * 受控状态转换图。
 * key = 当前状态；value = 允许跳转的下一状态集合。
 * 未列出的转换一律拒绝（INVALID_TRANSITION）。
 * 终态：WON / LOST 不可再转换。
 */
export const DEV_TRANSITIONS: Record<DevStatus, DevStatus[]> = {
  NEW:                    ['RESEARCHING', 'LOST'],
  RESEARCHING:            ['RESEARCHED', 'LOST'],
  RESEARCHED:             ['QUALIFIED', 'RESEARCHING', 'LOST'],
  QUALIFIED:              ['CONTACT_READY', 'LOST'],
  CONTACT_READY:          ['CONTACTED', 'LOST'],
  CONTACTED:              ['REPLIED', 'LOST'],
  REPLIED:                ['FOLLOW_UP', 'LOST'],
  FOLLOW_UP:              ['QUALIFIED_OPPORTUNITY', 'LOST'],
  QUALIFIED_OPPORTUNITY:  ['QUOTE_READY', 'LOST'],
  QUOTE_READY:            ['WON', 'LOST'],
  WON:                    [],
  LOST:                   [],
};

/** 是否允许从 from 转到 to */
export function canTransition(from: DevStatus, to: DevStatus): boolean {
  if (from === to) return false;
  const allowed = DEV_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

/**
 * AI 动作 → 期望的 devStatus 后置状态（用于 AI 完成后自动推进）。
 * 注意：自动推进只发生在"前置状态满足 + AI 成功"时；失败不推进。
 */
export const AI_ACTION_NEXT_STATUS: Record<string, DevStatus> = {
  CUSTOMER_RESEARCH:    'RESEARCHED',
  LEAD_QUALIFICATION:   'QUALIFIED',
  PRODUCT_MATCHING:     'RESEARCHED',     // 不强制推进，保持 RESEARCHED
  DEVELOPMENT_STRATEGY:  'RESEARCHED',     // 同上
  MESSAGE_DRAFT:        'CONTACT_READY',  // 仅在 message 被 approve 后推进（见 approve 路由）
};

/**
 * PHASE 2-C AI 海外客户研究 & 开发助手 —— 统一枚举 / 接口 / 类型常量
 *
 * 设计原则（§2 不能伪造信息）：
 *  1. 所有 AI 研究字段必须区分 CONFIRMED / INFERRED / UNKNOWN
 *     - CONFIRMED: 数据来源明确存在（输入快照中已确认）
 *     - INFERRED:  AI 基于已有数据合理推断（须给出 reason）
 *     - UNKNOWN:   无可靠依据，禁止编造数值 / 联系方式 / 营业额 / 采购量
 *  2. 来源必须真实保存（url+title+sourceType），未联网研究时 sources = []，
 *     前端显示 "No external source available."
 *  3. AI 输出 JSON 须经 Schema 校验；校验失败 status = RESEARCH_FAILED，
 *     禁止把失败结果当成功写入。
 *  4. 本阶段只接入 MockAIProvider 与 OpenAIProvider（基于 axios）；
 *     未配置 OPENAI_API_KEY 时强制走 Mock，禁止因无 Key 导致项目无法启动。
 */
import type { Document, Types } from 'mongoose';

// =========================
// AI Provider
// =========================
export const AI_PROVIDERS = ['mock', 'openai'] as const;
export type AIProviderName = typeof AI_PROVIDERS[number];

// =========================
// AI Job 状态
// =========================
export const AI_JOB_STATUSES = [
  'QUEUED',    // 已入队
  'RUNNING',   // 调用 AI 中
  'COMPLETED', // 成功
  'FAILED',    // 失败（API/超时/校验/预算/异常）
  'CANCELLED', // 用户取消
] as const;
export type AIJobStatus = typeof AI_JOB_STATUSES[number];

// =========================
// AI 任务用途（也用于 PromptTemplate.name 与 AuditLog.action 的子类）
// =========================
export const AI_PURPOSES = [
  'CUSTOMER_RESEARCH',    // §5-6 公司画像
  'LEAD_QUALIFICATION',   // §7 采购意向 + §8 AI 评分
  'PRODUCT_MATCHING',    // §10-11 产品匹配
  'DEVELOPMENT_STRATEGY', // §21 开发策略
  'MESSAGE_DRAFT',       // §22-25 话术草稿
] as const;
export type AIPurpose = typeof AI_PURPOSES[number];

// Prompt 版本前缀（与 AI_PURPOSES 拼接使用，禁止覆盖旧版本）
export const PROMPT_VERSIONS = {
  CUSTOMER_RESEARCH:    ['CUSTOMER_RESEARCH_V1'],
  LEAD_QUALIFICATION:   ['LEAD_QUALIFICATION_V1'],
  PRODUCT_MATCHING:     ['PRODUCT_MATCHING_V1'],
  DEVELOPMENT_STRATEGY: ['DEVELOPMENT_STRATEGY_V1'],
  MESSAGE_DRAFT:        ['MESSAGE_DRAFT_V1'],
} as const;

// =========================
// 置信度（§2 不能伪造）
// =========================
export const CONFIDENCE_LEVELS = ['CONFIRMED', 'INFERRED', 'UNKNOWN'] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

// =========================
// 采购意向等级
// =========================
export const PURCHASE_INTENT_GRADES = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const;
export type PurchaseIntentGrade = typeof PURCHASE_INTENT_GRADES[number];

// =========================
// AI 支持语言（§23）
// =========================
export const AI_LANGUAGES = ['en', 'ar', 'zh'] as const;
export type AILanguage = typeof AI_LANGUAGES[number];

// =========================
// AI 话术通道
// =========================
export const AI_MESSAGE_CHANNELS = ['EMAIL', 'WHATSAPP', 'LINKEDIN', 'OTHER'] as const;
export type AIMessageChannel = typeof AI_MESSAGE_CHANNELS[number];

// =========================
// AI 话术 Purpose（§25）
// =========================
export const MESSAGE_PURPOSES = [
  'FIRST_CONTACT',
  'FOLLOW_UP',
  'INQUIRY_FOLLOW_UP',
  'QUOTE_FOLLOW_UP',
  'REACTIVATION',
] as const;
export type MessagePurpose = typeof MESSAGE_PURPOSES[number];

// =========================
// AI Draft 状态（§27 人工确认）
// =========================
export const AI_DRAFT_STATUSES = [
  'DRAFT',       // AI 刚生成
  'EDITED',      // 人工编辑（MANUALLY_EDITED）
  'APPROVED',    // 人工批准 → 待发送
  'REJECTED',    // 拒绝
  'SENT',        // 人工已手动发送（仅记录）
] as const;
export type AIDraftStatus = typeof AI_DRAFT_STATUSES[number];

// =========================
// AI Audit Action（§29）
// =========================
export const AI_ACTIONS = [
  'RESEARCH',            // 触发研究
  'SCORE',               // AI 评分
  'PRODUCT_MATCH',       // 产品匹配
  'STRATEGY',            // 开发策略
  'MESSAGE_GENERATION',  // 话术草稿生成
  'REGENERATE',          // 重新生成
  'APPROVE',             // 人工批准
  'EDIT',                // 人工编辑
  'REJECT',              // 拒绝
] as const;
export type AIAction = typeof AI_ACTIONS[number];

// =========================
// 字段置信度封装（§2 每个字段标记来源）
// =========================
export interface AIField<T> {
  value: T;
  confidence: ConfidenceLevel;
  reason?: string;       // INFERRED/UNKNOWN 时给出原因
}

// =========================
// 来源引用（§15 Sources）
// =========================
export interface AISourceRef {
  url: string;
  title: string;
  sourceType: 'lead_input' | 'product_catalog' | 'customer_history' | 'external_web';
  retrievedAt?: Date;
}

// =========================
// AI 输入（§16-18 数据最小化 + 隐私）
// =========================
export interface AISanitizedLead {
  _id: string;
  companyName: string;
  website: string;
  country: string;
  city: string;
  industry: string;
  companyType: string;
  productInterest: string[];
  source: string;
  sourceUrl: string;
  notes: string;
  // 联系人 — 仅发送职位（用于决策角色判断），不发送私人 email/phone/whatsapp
  contactName: string;
  jobTitle: string;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWhatsapp: boolean;
  hasLinkedIn: boolean;
  // 业务历史（§17）
  history: {
    inquiryCount: number;
    quoteCount: number;
    orderCount: number;
    interactionCount: number;
    lastInteractionAt?: Date;
  };
}

// =========================
// 产品目录快照（§10 必须来自 MongoDB Product，AI 不能编造）
// =========================
export interface AIProductSnippet {
  _id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  category: string;
  isCustom: boolean;
  isStock: boolean;
}

// =========================
// AI 研究结果（§5-6）
// =========================
export interface AIResearchResult {
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
  recommendedProducts: AIField<string[]>;   // 仅能从输入产品目录里选
  recommendedApproach: AIField<string>;
  confidence: number;     // 0-100 整体置信度
  sources: AISourceRef[];  // 空数组 = 无外部来源
}

// =========================
// 采购意向（§7）
// =========================
export interface AIPurchaseIntent {
  score: number;          // 0-100，无依据时 = 0
  grade: PurchaseIntentGrade;   // UNKNOWN 时 score 应为 0
  reasons: string[];
  risks: string[];        // 风险 / 缺失依据
}

// =========================
// AI 评分（§8 Final = Rule + AI + Data Completeness + Purchase Intent）
// =========================
export interface AILeadScore {
  ruleScore: number;       // PHASE 2-B 已有规则评分
  aiScore: number;         // AI 评分 0-100
  purchaseIntent: number;  // 采购意向分 0-100
  dataCompleteness: number; // 资料完整度 0-100
  finalScore: number;     // 加权综合 0-100
  reasons: string[];       // 加分原因
  risks: string[];          // 风险点
  aiScoreReasons?: string[]; // AI 分项原因
}

// =========================
// 产品匹配（§11 ProductMatch）
// =========================
export interface AIProductMatch {
  productId: string;
  matchScore: number;      // 0-100
  reason: string;
  confidence: ConfidenceLevel;
}

// =========================
// 开发策略（§21）
// =========================
export interface AIDevelopmentStrategy {
  targetPersona: AIField<string>;
  painPoints: AIField<string[]>;
  potentialProducts: AIField<string[]>;     // 仅从产品目录选
  recommendedValueProposition: AIField<string>;
  recommendedChannel: AIField<string>;
  recommendedTiming: AIField<string>;
  followUpStrategy: AIField<string>;
  confidence: number;
  sources: AISourceRef[];
}

// =========================
// 话术草稿（§22-25）
// =========================
export interface AIMessageDraftResult {
  subject: string;
  content: string;
  personalization: string[];   // 个性化变量使用说明
  reason: string;              // 为什么这样写
  language: AILanguage;
  channel: AIMessageChannel;
  purpose: MessagePurpose;
}

// =========================
// AI Provider 接口（§3）
// =========================
export interface AIProvider {
  readonly name: AIProviderName;
  /** 是否已正确配置（Mock 永远 true；OpenAI 看 API Key） */
  isConfigured(): boolean;
  /** 统一 chat completion 入口；JSON 模式由 schema hint 触发 */
  complete(opts: {
    system: string;
    user: string;
    jsonMode?: boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<{ content: string; tokens: { input: number; output: number }; model: string }>;
}

// =========================
// AI 调用失败类型
// =========================
export type AIErrorKind =
  | 'TIMEOUT'
  | 'RATE_LIMITED'       // 429
  | 'SERVER_ERROR'       // 5xx
  | 'NETWORK'
  | 'INVALID_JSON'      // §35 schema 校验失败
  | 'BUDGET_EXCEEDED'   // §31 预算超限
  | 'PERMISSION_DENIED' // §46 权限
  | 'CANCELLED'          // §42 用户取消
  | 'NOT_CONFIGURED'     // §39 无 OPENAI_API_KEY
  | 'UNKNOWN';

export class AIError extends Error {
  constructor(public kind: AIErrorKind, message: string, public httpStatus?: number) {
    super(message);
    this.name = 'AIError';
  }
}

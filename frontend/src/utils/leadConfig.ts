/**
 * PHASE 2-B 海外客户开发中心 —— 统一配置中心
 *
 * 设计原则（遵循 PHASE 2-B 规范）：
 *   1. 静态枚举（Industry / CompanyType / ProductInterest / LeadSource / Channel / Grade）
 *      集中放在这里，所有页面 import 同一份来源，禁止在组件里散落硬编码。
 *   2. 国家列表、城市列表、国家优先级、默认产品推荐 —— 不写死在组件，
 *      通过 leadMarketCache 异步从后端 /console/development/markets 拉取（DB 配置）。
 *   3. 城市按 countryCode 多选（Dubai / Abu Dhabi / Sharjah / Riyadh / Jeddah / ...），
 *      不再只支持单一 Dubai。
 *   4. Lead Source 提前预留 LinkedIn / Instagram / Facebook / TikTok / X / Alibaba / Made-in-China / Global-Sources，
 *      但本阶段不实现未经授权的平台自动爬取。
 */
import { Console } from '../api/console';
import type { ConsoleMarketConfig } from '../types';

// ====== 1. 目标行业（与 backend crm.ts TARGET_INDUSTRIES 对齐）======
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
export type TargetIndustry = typeof TARGET_INDUSTRIES[number];

// ====== 2. 客户类型（与 backend crm.ts TARGET_COMPANY_TYPES 对齐）======
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
export type TargetCompanyType = typeof TARGET_COMPANY_TYPES[number];

// ====== 3. 陶瓷产品兴趣（与 backend crm.ts PRODUCT_INTERESTS 对齐）======
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

// ====== 4. Lead 来源（与 backend crm.ts LEAD_SOURCES_EXTENDED 对齐）======
export const LEAD_SOURCES = [
  'website',
  'csv_import',
  'excel_import',
  'trade_show',
  'referral',
  'manual',
  'google',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'x',
  'alibaba',
  'made_in_china',
  'global_sources',
  'other',
] as const;
export type LeadSource = typeof LEAD_SOURCES[number];

// ====== 5. Message Template Channel（与 backend crm.ts TEMPLATE_CHANNELS 对齐）======
export const TEMPLATE_CHANNELS = ['EMAIL', 'WHATSAPP', 'LINKEDIN', 'OTHER'] as const;
export type TemplateChannel = typeof TEMPLATE_CHANNELS[number];

// ====== 6. Lead Grade（与 backend crm.ts LeadGrade 对齐）======
export const LEAD_GRADES = ['A', 'B', 'C', 'D'] as const;
export type LeadGrade = typeof LEAD_GRADES[number];

// ====== 7. Campaign Status ======
export const CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];

// ====== 8. Import Status ======
export const IMPORT_STATUSES = ['UPLOADED', 'PARSED', 'MAPPED', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type ImportStatus = typeof IMPORT_STATUSES[number];

// ====== 9. Import Row Status ======
export const IMPORT_ROW_STATUSES = ['VALID', 'INVALID', 'DUPLICATE', 'IMPORTED', 'SKIPPED', 'UPDATED'] as const;
export type ImportRowStatus = typeof IMPORT_ROW_STATUSES[number];

// ====== 10. Duplicate Strategy ======
export const DUPLICATE_STRATEGIES = ['SKIP', 'UPDATE', 'CREATE_ANYWAY'] as const;
export type DuplicateStrategy = typeof DUPLICATE_STRATEGIES[number];

// ====== 11. Lead 字段（用于 CSV/Excel 字段映射 + 表单）======
export const LEAD_FIELDS = [
  'companyName',
  'website',
  'country',
  'city',
  'industry',
  'companyType',
  'contactName',
  'jobTitle',
  'email',
  'phone',
  'whatsapp',
  'linkedin',
  'source',
  'sourceUrl',
  'productInterest',
  'notes',
] as const;
export type LeadField = typeof LEAD_FIELDS[number];

// ====== 12. Lead 字段标签（用于字段映射下拉）======
export const LEAD_FIELD_LABELS: Record<LeadField, string> = {
  companyName:   'Company Name',
  website:       'Website',
  country:       'Country',
  city:          'City',
  industry:      'Industry',
  companyType:   'Company Type',
  contactName:   'Contact Name',
  jobTitle:      'Job Title',
  email:         'Email',
  phone:         'Phone',
  whatsapp:      'WhatsApp',
  linkedin:      'LinkedIn',
  source:        'Source',
  sourceUrl:     'Source URL',
  productInterest: 'Product Interest',
  notes:         'Notes',
};

// ====== 13. Template Variables（开发话术模板变量）======
export const TEMPLATE_VARIABLES = [
  '{{firstName}}',
  '{{companyName}}',
  '{{country}}',
  '{{productName}}',
  '{{salesName}}',
] as const;

// ====== 14. 默认国家清单（仅用于初始 fallback + 下拉显示，城市/优先级走 DB）======
export const DEFAULT_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AE', name: 'UAE' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'OM', name: 'Oman' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'TR', name: 'Turkey' },
];

// ====== 15. Grade 评分区间（与 backend LeadScoring.computeScore 对齐）======
export const GRADE_THRESHOLDS: { grade: LeadGrade; min: number; max: number }[] = [
  { grade: 'A', min: 80, max: 100 },
  { grade: 'B', min: 60, max: 79 },
  { grade: 'C', min: 40, max: 59 },
  { grade: 'D', min: 0,  max: 39 },
];

// ====== 16. 市场 Cache（异步从 DB 拉取，禁止硬编码国家优先级/城市）======
let marketCache: ConsoleMarketConfig[] | null = null;
let marketPromise: Promise<ConsoleMarketConfig[]> | null = null;

export async function loadMarkets(force = false): Promise<ConsoleMarketConfig[]> {
  if (marketCache && !force) return marketCache;
  if (!marketPromise || force) {
    marketPromise = Console.Development.listMarkets()
      .then((list) => {
        marketCache = Array.isArray(list) ? list : [];
        return marketCache;
      })
      .catch(() => {
        marketCache = [];
        return [];
      });
  }
  return marketPromise;
}

/** 同步读取（如未 load 过则返回 []） */
export function getMarkets(): ConsoleMarketConfig[] {
  return marketCache || [];
}

/** 按 countryCode 取市场配置 */
export function getMarketByCode(code: string): ConsoleMarketConfig | undefined {
  return (marketCache || []).find((m) => m.countryCode === code);
}

/** 取某国家的城市列表（DB 配置，不存在则空数组） */
export function getCitiesOfCountry(code: string): string[] {
  return getMarketByCode(code)?.cities || [];
}

/** 取某国家的默认推荐产品（DB 配置，用于 Industry=Hotel 自动推荐 Hotelware 等） */
export function getDefaultProducts(code: string): string[] {
  return getMarketByCode(code)?.defaultProductInterests || [];
}

/** 取国家优先级（DB 配置，不存在则 50） */
export function getCountryPriority(code: string): number {
  return getMarketByCode(code)?.priority ?? 50;
}

/** 国家名称（DB 优先，否则从 DEFAULT_COUNTRIES fallback） */
export function getCountryName(code: string): string {
  const m = getMarketByCode(code);
  if (m) return m.countryName;
  const d = DEFAULT_COUNTRIES.find((c) => c.code === code);
  return d ? d.name : code;
}

/** 由 Score 反推 Grade */
export function scoreToGrade(score: number): LeadGrade {
  const s = Math.max(0, Math.min(100, score | 0));
  const found = GRADE_THRESHOLDS.find((g) => s >= g.min && s <= g.max);
  return found ? found.grade : 'D';
}

/**
 * PHASE 2-B 外贸客户开发中心（Overseas Customer Development Center）路由
 * 路径：/api/console/development/*
 *
 * 挂载在 console 主路由下（console 主路由已全局 authJWT()），本文件顶部再次应用 authJWT()
 * 以保证独立可用与可测试。所有写操作均二次校验 owner 权限。
 *
 * 业务覆盖：
 *  1.  Overview 仪表盘
 *  2.  Campaigns CRUD + 实时漏斗
 *  3.  Import 导入流程（upload → map → validate → commit）
 *  4.  Lead 评分（单条 / 批量）
 *  5.  Lead 批量操作
 *  6.  Message Templates CRUD + 变量渲染预览
 *  7.  Development Tasks CRUD + 漏斗
 *  8.  MarketConfig（国家优先级）
 *  9.  Analytics（按 campaign / source / country 漏斗与转化率）
 *
 * 安全模型与 console.ts 一致：
 *  - superadmin 可见全部；
 *  - 其他角色视为 Sales，仅可见/操作 ownerId / createdBy === 自己 或为空的数据。
 */
import { Router } from 'express';
import { Types, FilterQuery } from 'mongoose';
import { authJWT, AuthRequest } from '../middleware/authJWT';
import { CODE_PREFIXES, TARGET_INDUSTRIES, TARGET_COMPANY_TYPES } from '../types/crm';

import Lead, { ILead } from '../models/Lead';
import LeadCampaign, { ILeadCampaign } from '../models/LeadCampaign';
import LeadImport, { ILeadImport } from '../models/LeadImport';
import LeadImportRow, { ILeadImportRow } from '../models/LeadImportRow';
import MessageTemplate, { IMessageTemplate } from '../models/MessageTemplate';
import DevelopmentTask, { IDevelopmentTask } from '../models/DevelopmentTask';
import MarketConfig, { IMarketConfig } from '../models/MarketConfig';
import Interaction, { IInteraction } from '../models/Interaction';

const router = Router();

// ============ 全局保护（与 console 主路由一致，再次应用一次） ============
router.use(authJWT());

// ---------- 工具（与 console.ts 同形态，本文件独立定义） ----------
const ok = <T>(res: any, data: T, message = 'ok') =>
  res.json({ code: 0, message, data });

const fail = (res: any, status: number, code: number, message: string) =>
  res.status(status).json({ code, message, data: null });

const toId = (s: string | undefined): Types.ObjectId | undefined => {
  if (!s) return undefined;
  try { return new Types.ObjectId(s); } catch { return undefined; }
};

function isValidObjectId(s: string | undefined): boolean {
  if (!s) return false;
  return Types.ObjectId.isValid(s) && new Types.ObjectId(s).toString() === s;
}

/** owner 过滤：可指定 ownerField（默认 ownerId；MessageTemplate / LeadImport / MarketConfig 用 createdBy） */
function readScope(req: AuthRequest, ownerField = 'ownerId'): FilterQuery<any> {
  if (req.admin?.role === 'superadmin') return {};
  const id = toId(req.admin?.id);
  const key = ownerField;
  return { $or: [{ [key]: id }, { [key]: null }, { [key]: { $exists: false } }] } as FilterQuery<any>;
}
function isWritable(req: AuthRequest, doc: any, ownerField = 'ownerId'): boolean {
  if (req.admin?.role === 'superadmin') return true;
  const me = req.admin?.id;
  if (!me) return false;
  const oid = String(doc?.[ownerField] ?? '');
  return oid === me || oid === '';
}

function parsePage(q: any) {
  const page = Math.max(1, parseInt(q.page as string, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(q.pageSize as string, 10) || 20));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

async function paginate<T>(model: any, baseFilter: FilterQuery<T>, page: number, pageSize: number, skip: number, sort: any = { createdAt: -1 }) {
  const [items, total] = await Promise.all([
    model.find(baseFilter).sort(sort).skip(skip).limit(pageSize).lean(),
    model.countDocuments(baseFilter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 0,
  };
}

/** 把 scope 与额外条件合并成 $and（scope 为空时直接返回 extra） */
function withScope(scope: FilterQuery<any>, extra?: any): any {
  const keys = Object.keys(scope || {});
  if (!keys.length) return extra ?? {};
  return extra ? { $and: [scope, extra] } : scope;
}

// ---------- 校验 / 归一化（导入流程用） ----------
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function isValidEmail(v: any): boolean {
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
}
function isValidUrl(v: any): boolean {
  if (!v) return false;
  try { const u = new URL(String(v)); return !!u.host; } catch { return false; }
}
function normalizeEmail(v: any): string {
  if (!v) return '';
  return String(v).trim().toLowerCase();
}
function normalizeWebsite(v: any): string {
  if (!v) return '';
  return String(v).trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

/** 去重查询：按 website / email / phone / whatsapp / companyName+country 命中即视为重复 */
function buildDupFilter(m: any): FilterQuery<any> {
  const or: any[] = [];
  const email = normalizeEmail(m.email);
  if (email) or.push({ email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' } });
  if (m.phone && String(m.phone).trim()) {
    const p = String(m.phone).trim();
    or.push({ phone: p }, { whatsapp: p });
  }
  if (m.whatsapp && String(m.whatsapp).trim()) {
    const w = String(m.whatsapp).trim();
    or.push({ whatsapp: w }, { phone: w });
  }
  if (m.companyName) {
    const cn = String(m.companyName).trim();
    if (m.country) or.push({ companyName: { $regex: `^${escapeRegex(cn)}$`, $options: 'i' }, country: String(m.country).trim() });
    else or.push({ companyName: { $regex: `^${escapeRegex(cn)}$`, $options: 'i' }, country: '' });
  }
  const website = normalizeWebsite(m.website);
  if (website) or.push({ website: { $regex: escapeRegex(website), $options: 'i' } });
  return or.length ? { $or: or } : { _id: null as any };
}

/** 把 Map（或对象）形式 fieldMapping 归一为 Map */
function toMap(mapping: any): Map<string, string> {
  if (mapping instanceof Map) return mapping as Map<string, string>;
  if (mapping && typeof mapping === 'object') return new Map(Object.entries(mapping));
  return new Map();
}

// ---------- 通用漏斗 ----------
interface FunnelStats {
  total: number;
  imported: number;
  qualified: number;
  contacted: number;
  replied: number;
  interested: number;
  inquiry: number;
  converted: number;
  lost: number;
}
async function computeLeadFunnel(match: FilterQuery<any>): Promise<FunnelStats> {
  const rows = await Lead.aggregate([
    { $match: match as any },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const m: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const k = r._id == null ? 'UNKNOWN' : String(r._id);
    m[k] = (m[k] || 0) + r.count;
    total += r.count;
  }
  const imported = await Lead.countDocuments({ $and: [match, { importId: { $exists: true, $ne: null } }] } as any).catch(() => 0);
  return {
    total,
    imported,
    qualified: m['QUALIFIED'] || 0,
    contacted: m['CONTACTED'] || 0,
    replied: m['REPLIED'] || 0,
    interested: m['INTERESTED'] || 0,
    inquiry: m['INQUIRY'] || 0,
    converted: m['CONVERTED'] || 0,
    lost: m['LOST'] || 0,
  };
}

// ---------- 评分（纯函数） ----------
function gradeForScore(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * 计算单条 Lead 的得分 0-100。
 *   industry match 0-20 | companyType 0-15 | country priority(MarketConfig) 0-15
 *   product interest 0-15 | website 0-5 | email 0-5 | whatsapp 0-5
 *   contact person 0-5 | company completeness 0-10 | purchase intent 0-5
 */
function computeScore(lead: any, campaign: ILeadCampaign | null, markets: IMarketConfig[]): { score: number; grade: 'A'|'B'|'C'|'D'; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  let s = 0;

  // 1) industry match (0-20)
  const preferredInd = (campaign?.industries && campaign.industries.length ? campaign.industries : TARGET_INDUSTRIES as readonly string[])
    .map((x) => String(x).toLowerCase());
  if (lead.industry && preferredInd.includes(String(lead.industry).toLowerCase())) s = 20;
  else if (lead.industry && lead.industry !== 'other') s = 10;
  else s = 0;
  score += s; reasons.push(`industry match: ${s}/20`);

  // 2) companyType match (0-15)
  const preferredCT = (campaign?.companyTypes && campaign.companyTypes.length ? campaign.companyTypes : TARGET_COMPANY_TYPES as readonly string[])
    .map((x) => String(x).toLowerCase());
  if (lead.companyType && preferredCT.includes(String(lead.companyType).toLowerCase())) s = 15;
  else if (lead.companyType && lead.companyType !== 'other') s = 7;
  else s = 0;
  score += s; reasons.push(`companyType match: ${s}/15`);

  // 3) country priority from MarketConfig (0-15)
  const mk = markets.find((m) =>
    (m.countryCode && m.countryCode.toLowerCase() === String(lead.country).toLowerCase()) ||
    (m.countryName && m.countryName.toLowerCase() === String(lead.country).toLowerCase()));
  if (mk) s = Math.round((Number(mk.priority) / 100) * 15);
  else if (lead.country) s = 5;
  else s = 0;
  score += s; reasons.push(`country priority: ${s}/15`);

  // 4) product interest match (0-15)
  if (campaign?.productInterests && campaign.productInterests.length &&
      (lead.productInterest || []).some((p: string) => campaign.productInterests.includes(p))) s = 15;
  else if ((lead.productInterest || []).length) s = 8;
  else s = 0;
  score += s; reasons.push(`product interest: ${s}/15`);

  // 5-8) 字段可用性
  s = lead.website ? 5 : 0; score += s; reasons.push(`website: ${s}/5`);
  s = lead.email ? 5 : 0; score += s; reasons.push(`email: ${s}/5`);
  s = lead.whatsapp ? 5 : 0; score += s; reasons.push(`whatsapp: ${s}/5`);
  s = lead.contactName ? 5 : 0; score += s; reasons.push(`contact person: ${s}/5`);

  // 9) company completeness (0-10)
  const fields = [lead.companyName, lead.website, lead.country, lead.city, lead.industry, lead.companyType];
  const filled = fields.filter((f) => f && String(f).trim() !== '' && String(f) !== 'other').length;
  s = Math.round((filled / 6) * 10); score += s; reasons.push(`company completeness: ${s}/10`);

  // 10) purchase intent (0-5)
  s = lead.purchaseIntent === 'high' ? 5 : lead.purchaseIntent === 'medium' ? 3 : lead.purchaseIntent === 'low' ? 1 : 0;
  score += s; reasons.push(`purchase intent: ${s}/5`);

  score = Math.max(0, Math.min(100, score));
  return { score, grade: gradeForScore(score), reasons };
}

// ---------- 导入：从行数据创建 Lead ----------
async function createLeadFromRow(data: any, imp: ILeadImport, owner: Types.ObjectId): Promise<ILead> {
  const doc: any = { ...(data || {}) };
  if (!doc.companyName) doc.companyName = 'Unknown';
  doc.source = 'import';
  doc.researchType = 'IMPORTED_DATA';
  doc.importId = imp._id;
  if (imp.campaignId) doc.campaignId = imp.campaignId;
  doc.ownerId = doc.ownerId || owner;
  doc.status = 'NEW';
  doc.score = 0;
  doc.grade = 'C';
  if (!Array.isArray(doc.productInterest)) {
    if (doc.productInterest && typeof doc.productInterest === 'string') {
      doc.productInterest = String(doc.productInterest).split(',').map((x: string) => x.trim()).filter(Boolean);
    } else {
      doc.productInterest = [];
    }
  }
  return Lead.create(doc);
}

/** 合并导入行数据到已有 Lead（UPDATE 策略） */
function mergeLead(existing: ILead, data: any): void {
  const d = data || {};
  const fields = [
    'companyName','website','country','city','industry','companyType',
    'contactName','jobTitle','email','phone','whatsapp','linkedin',
    'instagram','facebook','xHandle','tiktok','sourceUrl','estimatedPurchaseVolume','purchaseIntent',
  ];
  for (const k of fields) {
    if (d[k] !== undefined && d[k] !== '' && String(d[k]).trim() !== '') {
      (existing as any)[k] = d[k];
    }
  }
  if (Array.isArray(d.productInterest) && d.productInterest.length) {
    existing.productInterest = Array.from(new Set([...(existing.productInterest || []), ...d.productInterest])) as any;
  }
  if (Array.isArray(d.tags) && d.tags.length) {
    existing.tags = Array.from(new Set([...(existing.tags || []), ...d.tags])) as any;
  }
  if (d.notes) existing.notes = (existing.notes ? existing.notes + '\n' : '') + String(d.notes);
}

/** 模板变量渲染：把 {{ var }} 替换为 variables[var] */
function renderTemplate(tpl: { subject?: string; content?: string }, variables: Record<string, any>) {
  const replace = (text: string) =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) =>
      (variables[k] !== undefined && variables[k] !== null) ? String(variables[k]) : `{{${k}}}`);
  return { subject: replace(tpl.subject || ''), content: replace(tpl.content || '') };
}

// ========================================================================
//  1. Overview 仪表盘
// ========================================================================
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const sOwner = readScope(req);
    const sCreator = readScope(req, 'createdBy');
    const [totalCampaigns, totalImports, totalLeads, totalDevTasks, funnel, topCountries, topSources] = await Promise.all([
      LeadCampaign.countDocuments(withScope(sOwner, { status: 'ACTIVE' })),
      LeadImport.countDocuments(withScope(sCreator)),
      Lead.countDocuments(withScope(sOwner)),
      DevelopmentTask.countDocuments(withScope(sOwner)),
      computeLeadFunnel(sOwner),
      Lead.aggregate([
        { $match: withScope(sOwner, { country: { $exists: true, $ne: '' } }) as any },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $project: { _id: 0, country: { $ifNull: ['$_id', 'unknown'] }, count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Lead.aggregate([
        { $match: withScope(sOwner) as any },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $project: { _id: 0, source: { $ifNull: ['$_id', 'unknown'] }, count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);
    ok(res, {
      totalCampaigns,
      totalImports,
      totalLeads,
      totalDevTasks,
      funnel,
      topCountries: topCountries ?? [],
      topSources: topSources ?? [],
    });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'overview failed');
  }
});

// ========================================================================
//  2. Campaigns CRUD + 实时漏斗
// ========================================================================
router.get('/campaigns', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<ILeadCampaign> = readScope(req);
  const q = req.query;
  if (q.status && typeof q.status === 'string') base.status = q.status as any;
  if (q.ownerId) base.ownerId = toId(q.ownerId as string);
  if (q.country && typeof q.country === 'string') base.countries = q.country;
  if (q.search && typeof q.search === 'string') base.name = { $regex: q.search, $options: 'i' };
  ok(res, await paginate<ILeadCampaign>(LeadCampaign, base, page, pageSize, skip));
});

router.get('/campaigns/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid campaign id');
  try {
    const c = await LeadCampaign.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
    if (!c) return fail(res, 404, 404, 'Campaign not found');
    const funnel = await computeLeadFunnel({ campaignId: c._id });
    ok(res, { ...c, funnel });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Fetch campaign failed');
  }
});

router.post('/campaigns', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.name) return fail(res, 400, 400, 'name is required');
  try {
    const owner = toId(req.admin!.id)!;
    // 业务编码前缀（CODE_PREFIXES.CAMPAIGN）保留供前端展示/导出引用，模型当前未持久化 code 字段
    const doc = await LeadCampaign.create({
      ...b,
      ownerId: b.ownerId ? (toId(b.ownerId) ?? owner) : owner,
      countries: Array.isArray(b.countries) ? b.countries : [],
      cities: Array.isArray(b.cities) ? b.cities : [],
      industries: Array.isArray(b.industries) ? b.industries : [],
      companyTypes: Array.isArray(b.companyTypes) ? b.companyTypes : [],
      productInterests: Array.isArray(b.productInterests) ? b.productInterests : [],
      startDate: b.startDate ? new Date(b.startDate) : undefined,
      endDate: b.endDate ? new Date(b.endDate) : undefined,
      status: b.status || 'DRAFT',
    } as any);
    ok(res, doc.toObject());
  } catch (e: any) {
    fail(res, 400, 400, e?.message || 'Create campaign failed');
  }
});

router.patch('/campaigns/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid campaign id');
  const doc = await LeadCampaign.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Campaign not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  const b = { ...(req.body || {}) };
  if (b.ownerId) b.ownerId = toId(b.ownerId) ?? doc.ownerId;
  if (b.startDate) b.startDate = new Date(b.startDate) as any;
  if (b.endDate) b.endDate = new Date(b.endDate) as any;
  try { Object.assign(doc, b); await doc.save(); ok(res, doc.toObject()); }
  catch (e: any) { fail(res, 400, 400, e?.message || 'Update campaign failed'); }
});

router.delete('/campaigns/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid campaign id');
  const doc = await LeadCampaign.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Campaign not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  await doc.deleteOne();
  ok(res, { deleted: true, id: req.params.id });
});

// ========================================================================
//  3. Import 导入流程
// ========================================================================

// 3.1 upload —— 接收 JSON 行数组，创建 LeadImport(UPLOADED)
router.post('/imports/upload', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.fileName) return fail(res, 400, 400, 'fileName is required');
  const rawData = Array.isArray(b.rawData) ? b.rawData : [];
  try {
    const owner = toId(req.admin!.id)!;
    const imp = await LeadImport.create({
      fileName: b.fileName,
      fileType: b.fileType || 'json',
      fileSize: b.fileSize || 0,
      rawData,
      totalRows: rawData.length,
      fieldMapping: {} as any,
      duplicateStrategy: b.duplicateStrategy || 'SKIP',
      campaignId: toId(b.campaignId),
      status: 'UPLOADED',
      createdBy: owner,
    } as any);
    ok(res, {
      importId: imp._id,
      totalRows: rawData.length,
      preview: rawData.slice(0, 20),
    });
  } catch (e: any) {
    fail(res, 400, 400, e?.message || 'Upload import failed');
  }
});

// 3.2 map —— 保存字段映射，状态置 MAPPED
router.post('/imports/:id/map', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid import id');
  try {
    const imp = await LeadImport.findById(req.params.id);
    if (!imp) return fail(res, 404, 404, 'Import not found');
    if (!isWritable(req, imp, 'createdBy')) return fail(res, 403, 403, 'Permission denied');
    const fm = req.body?.fieldMapping;
    if (!fm || typeof fm !== 'object' || Array.isArray(fm)) {
      return fail(res, 400, 400, 'fieldMapping (object) is required');
    }
    imp.fieldMapping = new Map(Object.entries(fm)) as any;
    imp.status = 'MAPPED';
    await imp.save();
    const mapping = toMap(imp.fieldMapping);
    const preview = (imp.rawData || []).slice(0, 20).map((raw: any) => {
      const mapped: Record<string, any> = {};
      mapping.forEach((tgt, src) => { if (raw && raw[src] !== undefined) mapped[tgt] = raw[src]; });
      return mapped;
    });
    ok(res, {
      importId: imp._id,
      fieldMapping: Object.fromEntries(mapping.entries()),
      preview,
    });
  } catch (e: any) {
    fail(res, 400, 400, e?.message || 'Map import failed');
  }
});

// 3.3 validate —— 校验 + 去重，生成 LeadImportRow(VALID/INVALID/DUPLICATE)
router.post('/imports/:id/validate', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid import id');
  try {
    const imp = await LeadImport.findById(req.params.id);
    if (!imp) return fail(res, 404, 404, 'Import not found');
    if (!isWritable(req, imp, 'createdBy')) return fail(res, 403, 403, 'Permission denied');

    const mapping = toMap(imp.fieldMapping);
    if (!mapping.size) return fail(res, 400, 400, 'fieldMapping not set; call /map first');

    const rows = imp.rawData || [];
    await LeadImportRow.deleteMany({ importId: imp._id });

    const rowDocs: any[] = [];
    let valid = 0, invalid = 0, dup = 0;
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i] || {};
      const mapped: Record<string, any> = {};
      mapping.forEach((tgt, src) => { if (raw[src] !== undefined) mapped[tgt] = raw[src]; });

      const errors: string[] = [];
      if (!mapped.companyName || !String(mapped.companyName).trim()) errors.push('companyName required');
      if (mapped.email && !isValidEmail(mapped.email)) errors.push('invalid email format');
      if (mapped.website && !isValidUrl(mapped.website)) errors.push('invalid url format');
      if (mapped.phone != null && typeof mapped.phone !== 'string' && typeof mapped.phone !== 'number') {
        errors.push('invalid phone');
      }

      let status: ILeadImportRow['status'] = 'VALID';
      let duplicateLeadId: Types.ObjectId | undefined;
      if (errors.length) {
        status = 'INVALID';
      } else {
        const existing = await Lead.findOne(buildDupFilter(mapped)).lean();
        if (existing) { status = 'DUPLICATE'; duplicateLeadId = existing._id; }
      }

      if (status === 'VALID') valid++;
      else if (status === 'INVALID') invalid++;
      else dup++;

      rowDocs.push({
        importId: imp._id,
        rowIndex: i,
        data: mapped,
        status,
        errors,
        duplicateLeadId,
      });
    }

    if (rowDocs.length) await LeadImportRow.insertMany(rowDocs as any);
    imp.validRows = valid;
    imp.invalidRows = invalid;
    imp.duplicateRows = dup;
    imp.status = 'VALIDATED';
    await imp.save();

    ok(res, { validRows: valid, invalidRows: invalid, duplicateRows: dup, rows: rowDocs.slice(0, 100) });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Validate import failed');
  }
});

// 3.4 commit —— 写入 Lead，应用 duplicateStrategy，写 LEAD_IMPORTED 互动
router.post('/imports/:id/commit', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid import id');
  try {
    const imp = await LeadImport.findById(req.params.id);
    if (!imp) return fail(res, 404, 404, 'Import not found');
    if (!isWritable(req, imp, 'createdBy')) return fail(res, 403, 403, 'Permission denied');

    const strategy = (imp.duplicateStrategy || 'SKIP') as 'SKIP' | 'UPDATE' | 'CREATE_ANYWAY';
    const rows = await LeadImportRow.find({ importId: imp._id }).sort({ rowIndex: 1 });
    const owner = (imp.createdBy || toId(req.admin!.id)) as Types.ObjectId;

    const interactions: any[] = [];
    let importedCount = 0, updated = 0, skipped = 0, failed = 0;

    imp.status = 'IMPORTING';
    await imp.save();

    for (const row of rows) {
      try {
        if (row.status === 'VALID') {
          const lead = await createLeadFromRow(row.data, imp, owner);
          row.importedLeadId = lead._id; row.status = 'IMPORTED';
          importedCount++;
          interactions.push({
            leadId: lead._id, type: 'LEAD_IMPORTED',
            title: 'Lead imported',
            content: `Imported from ${imp.fileName} (row ${row.rowIndex + 1})`,
            ownerId: owner, occurredAt: new Date(),
          });
        } else if (row.status === 'DUPLICATE') {
          if (strategy === 'UPDATE' && row.duplicateLeadId) {
            const existing = await Lead.findById(row.duplicateLeadId);
            if (existing) {
              mergeLead(existing, row.data);
              await existing.save();
              row.importedLeadId = existing._id; row.status = 'UPDATED';
              updated++; importedCount++;
              interactions.push({
                leadId: existing._id, type: 'LEAD_IMPORTED',
                title: 'Lead updated via import',
                content: `Updated from ${imp.fileName} (row ${row.rowIndex + 1})`,
                ownerId: owner, occurredAt: new Date(),
              });
            } else { row.status = 'SKIPPED'; skipped++; }
          } else if (strategy === 'CREATE_ANYWAY') {
            const lead = await createLeadFromRow(row.data, imp, owner);
            row.importedLeadId = lead._id; row.status = 'IMPORTED';
            importedCount++;
            interactions.push({
              leadId: lead._id, type: 'LEAD_IMPORTED',
              title: 'Lead imported (duplicate, force create)',
              content: `Force-imported from ${imp.fileName} (row ${row.rowIndex + 1})`,
              ownerId: owner, occurredAt: new Date(),
            });
          } else {
            row.status = 'SKIPPED'; skipped++;
          }
        } else {
          // INVALID / 已处理 → 跳过
          skipped++;
        }
        await row.save();
      } catch {
        failed++;
      }
    }

    if (interactions.length) await Interaction.insertMany(interactions as Partial<IInteraction>[]);

    imp.importedRows = importedCount;
    imp.status = 'COMPLETED';
    await imp.save();

    // 同步 Campaign actualLeadCount
    if (imp.campaignId) {
      const cnt = await Lead.countDocuments({ campaignId: imp.campaignId });
      await LeadCampaign.updateOne({ _id: imp.campaignId }, { actualLeadCount: cnt });
    }

    ok(res, {
      total: rows.length,
      imported: importedCount,
      updated,
      skipped,
      failed,
      status: 'COMPLETED',
    });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Commit import failed');
  }
});

// 3.5 list / detail
router.get('/imports', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<ILeadImport> = readScope(req, 'createdBy');
  const q = req.query;
  if (q.status && typeof q.status === 'string') base.status = q.status as any;
  if (q.campaignId) base.campaignId = toId(q.campaignId as string);
  ok(res, await paginate<ILeadImport>(LeadImport, base, page, pageSize, skip));
});

router.get('/imports/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid import id');
  try {
    const imp = await LeadImport.findOne({ $and: [readScope(req, 'createdBy'), { _id: toId(req.params.id)! }] }).lean();
    if (!imp) return fail(res, 404, 404, 'Import not found');
    const { page, pageSize, skip } = parsePage(req.query);
    const [rows, totalRows] = await Promise.all([
      LeadImportRow.find({ importId: imp._id }).sort({ rowIndex: 1 }).skip(skip).limit(pageSize).lean(),
      LeadImportRow.countDocuments({ importId: imp._id }),
    ]);
    ok(res, { import: imp, rows, totalRows, page, pageSize, totalPages: Math.ceil(totalRows / pageSize) || 0 });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Fetch import failed');
  }
});

// ========================================================================
//  4. Lead Scoring
// ========================================================================
router.post('/scoring/score/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid lead id');
  try {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) return fail(res, 404, 404, 'Lead not found');
    if (!isWritable(req, lead)) return fail(res, 403, 403, 'Permission denied');

    const markets = await MarketConfig.find({ isActive: true }).lean();
    let campaign: ILeadCampaign | null = null;
    if (lead.campaignId) campaign = await LeadCampaign.findById(lead.campaignId).lean();

    const { score, grade, reasons } = computeScore(lead.toObject(), campaign, markets);
    lead.score = score;
    lead.grade = grade as any;
    lead.scoreReasons = reasons;
    await lead.save();

    await Interaction.create({
      leadId: lead._id,
      type: 'LEAD_SCORED',
      title: `Lead scored ${grade} (${score})`,
      content: reasons.join('; '),
      ownerId: toId(req.admin!.id),
      occurredAt: new Date(),
    } as Partial<IInteraction>);

    ok(res, { score, grade, reasons });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Score lead failed');
  }
});

router.post('/scoring/batch', async (req: AuthRequest, res) => {
  const b = req.body || {};
  const idsRaw: string[] = Array.isArray(b.leadIds) ? b.leadIds : [];
  if (!idsRaw.length) return fail(res, 400, 400, 'leadIds is required');
  try {
    const ids = idsRaw.filter(isValidObjectId);
    if (!ids.length) return fail(res, 400, 400, 'no valid leadIds');

    const markets = await MarketConfig.find({ isActive: true }).lean();
    const campaignIds = await Lead.distinct('campaignId', { _id: { $in: ids.map(toId).filter(Boolean) as Types.ObjectId[] } });
    const campaigns: ILeadCampaign[] = campaignIds.length ? await LeadCampaign.find({ _id: { $in: campaignIds } }).lean() : [];
    const cmap = new Map(campaigns.map((c) => [String(c._id), c]));

    const results: any[] = [];
    let scored = 0;
    const interactions: any[] = [];
    const owner = toId(req.admin!.id);

    for (const idStr of ids) {
      const lead = await Lead.findById(idStr);
      if (!lead) { results.push({ leadId: idStr, error: 'not found' }); continue; }
      if (!isWritable(req, lead)) { results.push({ leadId: idStr, error: 'permission denied' }); continue; }
      const campaign = lead.campaignId ? (cmap.get(String(lead.campaignId)) ?? null) : null;
      const { score, grade, reasons } = computeScore(lead.toObject(), campaign, markets);
      lead.score = score; lead.grade = grade as any; lead.scoreReasons = reasons;
      await lead.save();
      scored++;
      results.push({ leadId: idStr, score, grade, reasons });
      interactions.push({
        leadId: lead._id, type: 'LEAD_SCORED',
        title: `Lead scored ${grade} (${score})`,
        content: reasons.join('; '),
        ownerId: owner, occurredAt: new Date(),
      });
    }

    if (interactions.length) await Interaction.insertMany(interactions as Partial<IInteraction>[]);
    ok(res, { scored, results });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Batch score failed');
  }
});

// ========================================================================
//  5. Lead 批量操作
// ========================================================================
router.post('/leads/batch', async (req: AuthRequest, res) => {
  const b = req.body || {};
  const idsRaw: string[] = Array.isArray(b.leadIds) ? b.leadIds : [];
  if (!idsRaw.length) return fail(res, 400, 400, 'leadIds is required');
  const ids = idsRaw.filter(isValidObjectId).map((s) => toId(s)!);
  if (!ids.length) return fail(res, 400, 400, 'no valid leadIds');

  const action = b.action;
  const payload = b.payload || {};
  const scope = readScope(req);
  const filter: FilterQuery<ILead> = { $and: [scope, { _id: { $in: ids } }] } as any;

  try {
    let affected = 0;

    if (action === 'assignOwner') {
      const oid = toId(payload.ownerId);
      if (!oid) return fail(res, 400, 400, 'payload.ownerId is required');
      const r = await Lead.updateMany(filter, { $set: { ownerId: oid } });
      affected = r.modifiedCount;
    } else if (action === 'changeStatus') {
      if (!payload.status) return fail(res, 400, 400, 'payload.status is required');
      const r = await Lead.updateMany(filter, { $set: { status: payload.status } });
      affected = r.modifiedCount;
    } else if (action === 'changeGrade') {
      if (!payload.grade) return fail(res, 400, 400, 'payload.grade is required');
      const r = await Lead.updateMany(filter, { $set: { grade: payload.grade } });
      affected = r.modifiedCount;
    } else if (action === 'addTags') {
      const tags = Array.isArray(payload.tags) ? payload.tags : [];
      if (!tags.length) return fail(res, 400, 400, 'payload.tags is required');
      const r = await Lead.updateMany(filter, { $addToSet: { tags: { $each: tags } } });
      affected = r.modifiedCount;
    } else if (action === 'createDevTask') {
      const owner = toId(req.admin!.id)!;
      const assignedTo = Array.isArray(payload.assignedTo)
        ? payload.assignedTo.filter(isValidObjectId).map((s: string) => toId(s)!)
        : [];
      const task = await DevelopmentTask.create({
        title: payload.title || `Batch dev task (${ids.length} leads)`,
        description: payload.description || '',
        campaignId: toId(payload.campaignId),
        leadIds: ids,
        ownerId: payload.ownerId ? (toId(payload.ownerId) ?? owner) : owner,
        assignedTo,
        type: payload.type || 'RESEARCH',
        priority: payload.priority || 'MEDIUM',
        status: 'TODO',
        dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
        totalLeads: ids.length,
      } as any);
      return ok(res, { affected: ids.length, taskId: task._id });
    } else if (action === 'delete') {
      if (payload.confirm !== true) return fail(res, 400, 400, 'delete requires payload.confirm=true');
      const r = await Lead.deleteMany(filter);
      affected = r.deletedCount || 0;
    } else {
      return fail(res, 400, 400, `unknown action: ${action}`);
    }

    ok(res, { affected });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Batch operation failed');
  }
});

// ========================================================================
//  6. Message Templates CRUD + 预览
// ========================================================================
router.get('/templates', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<IMessageTemplate> = readScope(req, 'createdBy');
  const q = req.query;
  if (q.channel && typeof q.channel === 'string') base.channel = q.channel as any;
  if (q.status && typeof q.status === 'string') base.status = q.status as any;
  if (q.language && typeof q.language === 'string') base.language = q.language;
  if (q.search && typeof q.search === 'string') base.name = { $regex: q.search, $options: 'i' };
  ok(res, await paginate<IMessageTemplate>(MessageTemplate, base, page, pageSize, skip));
});

router.get('/templates/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid template id');
  const doc = await MessageTemplate.findOne({ $and: [readScope(req, 'createdBy'), { _id: toId(req.params.id)! }] }).lean();
  if (!doc) return fail(res, 404, 404, 'Template not found');
  ok(res, doc);
});

router.post('/templates', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.name || !b.content) return fail(res, 400, 400, 'name and content are required');
  try {
    const owner = toId(req.admin!.id)!;
    const doc = await MessageTemplate.create({
      ...b,
      variables: Array.isArray(b.variables) ? b.variables : [],
      createdBy: b.createdBy ? (toId(b.createdBy) ?? owner) : owner,
    } as any);
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Create template failed'); }
});

router.patch('/templates/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid template id');
  const doc = await MessageTemplate.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Template not found');
  if (!isWritable(req, doc, 'createdBy')) return fail(res, 403, 403, 'Permission denied');
  try { Object.assign(doc, req.body || {}); await doc.save(); ok(res, doc.toObject()); }
  catch (e: any) { fail(res, 400, 400, e?.message || 'Update template failed'); }
});

router.delete('/templates/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid template id');
  const doc = await MessageTemplate.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Template not found');
  if (!isWritable(req, doc, 'createdBy')) return fail(res, 403, 403, 'Permission denied');
  await doc.deleteOne();
  ok(res, { deleted: true, id: req.params.id });
});

router.post('/templates/:id/preview', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid template id');
  const t = await MessageTemplate.findOne({ $and: [readScope(req, 'createdBy'), { _id: toId(req.params.id)! }] }).lean();
  if (!t) return fail(res, 404, 404, 'Template not found');
  const variables = (req.body?.variables && typeof req.body.variables === 'object' && !Array.isArray(req.body.variables))
    ? req.body.variables as Record<string, any>
    : {};
  ok(res, renderTemplate({ subject: t.subject, content: t.content }, variables));
});

// ========================================================================
//  7. Development Tasks CRUD + 漏斗
// ========================================================================
router.get('/tasks', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<IDevelopmentTask> = readScope(req);
  const q = req.query;
  if (q.campaignId) base.campaignId = toId(q.campaignId as string);
  if (q.ownerId) base.ownerId = toId(q.ownerId as string);
  if (q.status && typeof q.status === 'string') base.status = q.status as any;
  if (q.priority && typeof q.priority === 'string') base.priority = q.priority as any;
  ok(res, await paginate<IDevelopmentTask>(DevelopmentTask, base, page, pageSize, skip));
});

router.get('/tasks/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid task id');
  try {
    const t = await DevelopmentTask.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
    if (!t) return fail(res, 404, 404, 'Task not found');
    const emptyFunnel: FunnelStats = { total: 0, imported: 0, qualified: 0, contacted: 0, replied: 0, interested: 0, inquiry: 0, converted: 0, lost: 0 };
    const funnel = (t.leadIds && t.leadIds.length)
      ? await computeLeadFunnel({ _id: { $in: t.leadIds } })
      : emptyFunnel;
    ok(res, { ...t, funnel });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Fetch task failed');
  }
});

router.post('/tasks', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.title) return fail(res, 400, 400, 'title is required');
  try {
    const owner = toId(req.admin!.id)!;
    const leadIds = Array.isArray(b.leadIds)
      ? b.leadIds.filter(isValidObjectId).map((s: string) => toId(s)!)
      : [];
    const assignedTo = Array.isArray(b.assignedTo)
      ? b.assignedTo.filter(isValidObjectId).map((s: string) => toId(s)!)
      : [];
    const doc = await DevelopmentTask.create({
      title: b.title,
      description: b.description || '',
      campaignId: toId(b.campaignId),
      leadIds,
      ownerId: b.ownerId ? (toId(b.ownerId) ?? owner) : owner,
      assignedTo,
      type: b.type || 'RESEARCH',
      priority: b.priority || 'MEDIUM',
      status: b.status || 'TODO',
      dueAt: b.dueAt ? new Date(b.dueAt) : undefined,
      completedAt: b.completedAt ? new Date(b.completedAt) : undefined,
      totalLeads: leadIds.length,
    } as any);
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Create task failed'); }
});

router.patch('/tasks/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid task id');
  const doc = await DevelopmentTask.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Task not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  const b = { ...(req.body || {}) };
  if (b.campaignId) b.campaignId = toId(b.campaignId);
  if (b.ownerId) b.ownerId = toId(b.ownerId) ?? doc.ownerId;
  if (Array.isArray(b.leadIds)) b.leadIds = b.leadIds.filter(isValidObjectId).map((s: string) => toId(s)!) as any;
  if (Array.isArray(b.assignedTo)) b.assignedTo = b.assignedTo.filter(isValidObjectId).map((s: string) => toId(s)!) as any;
  if (b.dueAt) b.dueAt = new Date(b.dueAt) as any;
  if (b.completedAt) b.completedAt = new Date(b.completedAt) as any;
  const prevStatus = doc.status;
  try {
    Object.assign(doc, b);
    if (prevStatus !== 'COMPLETED' && doc.status === 'COMPLETED' && !doc.completedAt) doc.completedAt = new Date();
    if (Array.isArray(b.leadIds)) doc.totalLeads = doc.leadIds.length;
    await doc.save();
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Update task failed'); }
});

router.delete('/tasks/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid task id');
  const doc = await DevelopmentTask.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Task not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  await doc.deleteOne();
  ok(res, { deleted: true, id: req.params.id });
});

// ========================================================================
//  8. MarketConfig
// ========================================================================
router.get('/markets', async (req: AuthRequest, res) => {
  const list = await MarketConfig.find({ isActive: true }).sort({ priority: -1 }).lean();
  ok(res, list);
});

router.post('/markets', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.countryCode || !b.countryName) return fail(res, 400, 400, 'countryCode and countryName are required');
  try {
    const owner = toId(req.admin!.id);
    const doc = await MarketConfig.create({
      countryCode: b.countryCode,
      countryName: b.countryName,
      priority: typeof b.priority === 'number' ? b.priority : 50,
      isActive: b.isActive !== undefined ? b.isActive : true,
      cities: Array.isArray(b.cities) ? b.cities : [],
      defaultProductInterests: Array.isArray(b.defaultProductInterests) ? b.defaultProductInterests : [],
      notes: b.notes || '',
      createdBy: owner,
    } as any);
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Create market failed'); }
});

router.patch('/markets/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid market id');
  const doc = await MarketConfig.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Market not found');
  if (!isWritable(req, doc, 'createdBy')) return fail(res, 403, 403, 'Permission denied');
  try { Object.assign(doc, req.body || {}); await doc.save(); ok(res, doc.toObject()); }
  catch (e: any) { fail(res, 400, 400, e?.message || 'Update market failed'); }
});

// ========================================================================
//  9. Analytics —— 按 campaign / source / country 漏斗 + 来源质量
// ========================================================================
router.get('/analytics', async (req: AuthRequest, res) => {
  try {
    const s = readScope(req);
    const ws = (extra?: any): any => withScope(s, extra);

    const [funnel, byCampaign, bySource, byCountry] = await Promise.all([
      computeLeadFunnel(ws() as any),
      Lead.aggregate([
        { $match: ws({ campaignId: { $exists: true, $ne: null } }) as any },
        { $group: {
          _id: '$campaignId',
          leads: { $sum: 1 },
          qualified:  { $sum: { $cond: [{ $eq: ['$status', 'QUALIFIED'] }, 1, 0] } },
          contacted:  { $sum: { $cond: [{ $eq: ['$status', 'CONTACTED'] }, 1, 0] } },
          replied:    { $sum: { $cond: [{ $eq: ['$status', 'REPLIED'] }, 1, 0] } },
          interested: { $sum: { $cond: [{ $eq: ['$status', 'INTERESTED'] }, 1, 0] } },
          inquiry:    { $sum: { $cond: [{ $eq: ['$status', 'INQUIRY'] }, 1, 0] } },
          converted:  { $sum: { $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0] } },
          lost:       { $sum: { $cond: [{ $eq: ['$status', 'LOST'] }, 1, 0] } },
        } },
        { $lookup: { from: 'leadcampaigns', localField: '_id', foreignField: '_id', as: 'campaign' } },
        { $project: {
          _id: 0,
          campaignId: '$_id',
          campaignName: { $ifNull: [{ $arrayElemAt: ['$campaign.name', 0] }, ''] },
          leads: 1, qualified: 1, contacted: 1, replied: 1, interested: 1, inquiry: 1, converted: 1, lost: 1,
          conversionRate: {
            $cond: [{ $eq: ['$leads', 0] }, 0, { $multiply: [{ $divide: ['$converted', '$leads'] }, 100] }],
          },
        } },
        { $sort: { leads: -1 } },
      ]),
      Lead.aggregate([
        { $match: ws() as any },
        { $group: {
          _id: '$source',
          leads: { $sum: 1 },
          contacted: { $sum: { $cond: [{ $eq: ['$status', 'CONTACTED'] }, 1, 0] } },
          replied:   { $sum: { $cond: [{ $eq: ['$status', 'REPLIED'] }, 1, 0] } },
          inquiry:   { $sum: { $cond: [{ $eq: ['$status', 'INQUIRY'] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0] } },
        } },
        { $project: {
          _id: 0,
          source: { $ifNull: ['$_id', 'unknown'] },
          leads: 1, contacted: 1, replied: 1, inquiry: 1, converted: 1,
          replyRate:  { $cond: [{ $eq: ['$leads', 0] }, 0, { $multiply: [{ $divide: ['$replied', '$leads'] }, 100] }] },
          inquiryRate: { $cond: [{ $eq: ['$leads', 0] }, 0, { $multiply: [{ $divide: ['$inquiry', '$leads'] }, 100] }] },
          orderRate:  { $cond: [{ $eq: ['$leads', 0] }, 0, { $multiply: [{ $divide: ['$converted', '$leads'] }, 100] }] },
        } },
        { $sort: { leads: -1 } },
      ]),
      Lead.aggregate([
        { $match: ws({ country: { $exists: true, $ne: '' } }) as any },
        { $group: {
          _id: '$country',
          leads: { $sum: 1 },
          qualified: { $sum: { $cond: [{ $eq: ['$status', 'QUALIFIED'] }, 1, 0] } },
          contacted: { $sum: { $cond: [{ $eq: ['$status', 'CONTACTED'] }, 1, 0] } },
          replied:   { $sum: { $cond: [{ $eq: ['$status', 'REPLIED'] }, 1, 0] } },
          inquiry:   { $sum: { $cond: [{ $eq: ['$status', 'INQUIRY'] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0] } },
        } },
        { $project: {
          _id: 0,
          country: '$_id',
          leads: 1, qualified: 1, contacted: 1, replied: 1, inquiry: 1, converted: 1,
          conversionRate: { $cond: [{ $eq: ['$leads', 0] }, 0, { $multiply: [{ $divide: ['$converted', '$leads'] }, 100] }] },
        } },
        { $sort: { leads: -1 } },
        { $limit: 20 },
      ]),
    ]);

    const conversionRate = funnel.imported
      ? Math.round((funnel.converted / funnel.imported) * 1000) / 10
      : (funnel.total ? Math.round((funnel.converted / funnel.total) * 1000) / 10 : 0);
    ok(res, {
      funnel: { ...funnel, conversionRate },
      byCampaign: byCampaign ?? [],
      bySource: bySource ?? [],
      byCountry: byCountry ?? [],
    });
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Analytics failed');
  }
});

export default router;

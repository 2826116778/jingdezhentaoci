/**
 * PHASE 3-A AI Customer Development Center — 路由
 * 路径：/api/console/ai/development/*
 *
 * 设计原则：
 *   1. 复用 PHASE 2-C 的 AIProvider / orchestrator / budget / queue / injectionGuard /
 *      schema validation / audit / usage tracking —— 不复制 AIProvider，不重写 AI 调用。
 *   2. 客户开发状态机受控：Lead.devStatus 转换必须经 canTransition；非法转换 → 400。
 *   3. 每次状态变化写 LeadDevelopmentHistory + AIActionLog —— 不覆盖历史。
 *   4. 所有外发内容（message draft）必须人工 Approve → CONTACT_READY；
 *      禁止 AI 自动发送；POST /:leadId/approve 是唯一推进到 CONTACT_READY 的入口。
 *
 * 接口清单：
 *   GET  /                                  列表（搜索/筛选/排序/分页）
 *   GET  /:leadId                           详情：profile + score + matches + strategy + drafts + history + lead
 *   POST /:leadId/research                  复用 runResearch（受控推进 devStatus）
 *   POST /:leadId/qualify                   复用 runQualification
 *   POST /:leadId/product-match             复用 runProductMatch
 *   POST /:leadId/strategy                  复用 runStrategy
 *   POST /:leadId/message                   复用 runMessageDraft
 *   POST /:leadId/approve                   批准 message draft → CONTACT_READY（不自动发送）
 *   POST /:leadId/status                    受控状态转换（人工推进 CONTACTED/REPLIED/...）
 */
import { Router, Response } from 'express';
import { Types, FilterQuery } from 'mongoose';
import { authJWT, AuthRequest } from '../middleware/authJWT';
import { env } from '../config/env';
import Lead, { ILead } from '../models/Lead';
import AIResearchProfile from '../models/AIResearchProfile';
import ProductMatch from '../models/ProductMatch';
import DevelopmentStrategy from '../models/DevelopmentStrategy';
import AIMessageDraft from '../models/AIMessageDraft';
import AIActionLog from '../models/AIActionLog';
import LeadDevelopmentHistory from '../models/LeadDevelopmentHistory';

import {
  runResearch, runQualification, runProductMatch, runStrategy, runMessageDraft,
} from '../ai/orchestrator';
import { getActiveProvider, getActiveProviderName } from '../ai/provider';
import {
  DEV_STATUSES, DevStatus, canTransition, AI_ACTION_NEXT_STATUS,
} from '../types/crm';
import { AIError } from '../types/ai';

const router = Router();

// ============ 全局保护（继承自 console.ts，但显式再挂一次更安全） ============
router.use(authJWT());

// ---------- 工具 ----------
const ok = <T>(res: Response, data: T, message = 'ok') => res.json({ code: 0, message, data });
const fail = (res: Response, status: number, code: number, message: string) =>
  res.status(status).json({ code, message, data: null });

function toId(s: string | undefined): Types.ObjectId | undefined {
  if (!s) return undefined;
  try { return new Types.ObjectId(s); } catch { return undefined; }
}
/**
 * 安全地把 Mongoose document 或 lean plain object 转成纯 JSON。
 * runResearch 的缓存路径返回 lean() 对象（无 .toObject()），fresh 路径返回 Mongoose document；
 * 其它 orchestrator 函数返回 Mongoose document。这里统一处理两种情况。
 */
function toPlain<T>(doc: T): T {
  if (doc && typeof (doc as any).toObject === 'function') return (doc as any).toObject() as T;
  return doc;
}
function isValidObjectId(s: string | undefined): boolean {
  if (!s) return false;
  return Types.ObjectId.isValid(s) && new Types.ObjectId(s).toString() === s;
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
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 0 };
}

/** Lead 读权限：superadmin 全部；其他仅 ownerId === 自己 或 ownerId 为空 */
function readScope(req: AuthRequest): FilterQuery<ILead> {
  if (req.admin?.role === 'superadmin') return {};
  const id = toId(req.admin?.id);
  return { $or: [{ ownerId: id }, { ownerId: null }, { ownerId: { $exists: false } }] };
}
function isWritable(req: AuthRequest, doc: { ownerId?: Types.ObjectId | string | null }): boolean {
  if (req.admin?.role === 'superadmin') return true;
  const me = req.admin?.id;
  if (!me) return false;
  const oid = String(doc.ownerId ?? '');
  return oid === me || oid === '';
}
async function canAccessLead(req: AuthRequest, leadId: string): Promise<boolean> {
  if (req.admin?.role === 'superadmin') return true;
  const lead = await Lead.findById(leadId).select('ownerId').lean();
  if (!lead) return false;
  const me = req.admin?.id;
  const oid = String(lead.ownerId ?? '');
  return oid === me || oid === '';
}

/**
 * 受控状态转换：核心逻辑
 *   - 校验 from → to 是否允许
 *   - 写 Lead.devStatus = toStatus
 *   - 写 LeadDevelopmentHistory（绝不覆盖历史）
 *   - 写 AIActionLog（status='OK'）
 */
async function transitionDevStatus(opts: {
  leadId: string;
  toStatus: DevStatus;
  changedBy?: string;
  reason?: string;
  source?: 'MANUAL' | 'AI_RESEARCH' | 'AI_QUALIFICATION' | 'AI_MESSAGE_APPROVE' | 'SYSTEM';
  metadata?: any;
}): Promise<{ from: DevStatus | null; to: DevStatus; lead: ILead | null }> {
  const lead = await Lead.findById(opts.leadId);
  if (!lead) throw new AIError('UNKNOWN', 'Lead not found');
  const from: DevStatus | null = (lead.devStatus as DevStatus | null) ?? null;

  // 校验
  if (from === opts.toStatus) {
    // 同状态无变化：不写历史，幂等返回
    return { from, to: opts.toStatus, lead: lead.toObject() as ILead };
  }
  if (!canTransition(from ?? 'NEW', opts.toStatus)) {
    throw new AIError('PERMISSION_DENIED',
      `Invalid devStatus transition: ${from ?? 'NEW'} → ${opts.toStatus}`);
  }

  // 写入历史（先写历史，确保即使后续 save 失败也有痕迹）
  await LeadDevelopmentHistory.create({
    leadId: lead._id,
    fromStatus: from,
    toStatus: opts.toStatus,
    changedBy: opts.changedBy ? new Types.ObjectId(opts.changedBy) : undefined,
    reason: opts.reason || '',
    source: opts.source || 'MANUAL',
    metadata: opts.metadata || {},
  });

  lead.devStatus = opts.toStatus;
  await lead.save();

  // 写 AIActionLog（兼容现有枚举：用 EDIT 表示状态变更）
  await AIActionLog.create({
    userId: opts.changedBy ? new Types.ObjectId(opts.changedBy) : undefined,
    leadId: lead._id as any,
    action: 'EDIT' as any,
    provider: getActiveProviderName(),
    aiModel: env.OPENAI_MODEL,
    status: 'OK',
    metadata: { type: 'dev_status_transition', from, to: opts.toStatus, reason: opts.reason || '', source: opts.source || 'MANUAL' },
  });

  return { from, to: opts.toStatus, lead: lead.toObject() as ILead };
}

// ========================================================================
// GET / — 列表（搜索/筛选/排序/分页）
// ========================================================================
router.get('/', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<ILead> = readScope(req);
  const q = req.query;

  // 搜索
  if (q.search && typeof q.search === 'string' && q.search.trim()) {
    const s = q.search.trim();
    base.$or = [
      { companyName: { $regex: s, $options: 'i' } },
      { contactName: { $regex: s, $options: 'i' } },
      { email:      { $regex: s, $options: 'i' } },
      { whatsapp:   { $regex: s, $options: 'i' } },
      { country:    { $regex: s, $options: 'i' } },
    ];
  }

  // 筛选
  if (q.devStatus && typeof q.devStatus === 'string' && (DEV_STATUSES as readonly string[]).includes(q.devStatus)) {
    base.devStatus = q.devStatus;
  }
  if (q.status && typeof q.status === 'string') base.status = q.status;
  if (q.grade && typeof q.grade === 'string') base.grade = q.grade;
  if (q.country && typeof q.country === 'string') base.country = q.country;
  if (q.industry && typeof q.industry === 'string') base.industry = q.industry;
  if (q.source && typeof q.source === 'string') base.source = q.source;
  if (q.ownerId && typeof q.ownerId === 'string' && isValidObjectId(q.ownerId as string)) {
    base.ownerId = toId(q.ownerId as string);
  }
  if (q.minScore !== undefined) base.score = { ...(base.score ?? {}), $gte: Number(q.minScore) };
  if (q.maxScore !== undefined) base.score = { ...(base.score ?? {}), $lte: Number(q.maxScore) };

  // 排序
  const sort: any = {};
  if (q.sort && typeof q.sort === 'string') {
    sort[q.sort] = (q.order === 'asc') ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }

  ok(res, await paginate<ILead>(Lead, base, page, pageSize, skip, sort));
});

// ========================================================================
// GET /:leadId — 详情：聚合所有 AI 结果 + 状态 + 时间线
// ========================================================================
router.get('/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');

  const lead = await Lead.findById(lid).lean();
  if (!lead) return fail(res, 404, 404, 'Lead not found');

  // 并发拉取所有 AI 产物 + 历史
  const [profile, matches, strategy, drafts, history, jobs, audit] = await Promise.all([
    AIResearchProfile.findOne({ leadId: lid as any }).lean(),
    ProductMatch.find({ leadId: lid as any }).sort({ matchScore: -1 }).limit(20).lean(),
    DevelopmentStrategy.findOne({ leadId: lid as any }).lean(),
    AIMessageDraft.find({ leadId: lid as any }).sort({ createdAt: -1 }).limit(20).lean(),
    LeadDevelopmentHistory.find({ leadId: lid as any }).sort({ createdAt: -1 }).limit(50).lean(),
    // 最近 AI 任务
    (await import('../models/AIResearchJob')).default.find({ leadId: lid as any })
      .sort({ createdAt: -1 }).limit(20).lean(),
    AIActionLog.find({ leadId: lid as any }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  ok(res, {
    lead,
    profile,
    matches,
    strategy,
    drafts,
    history,        // devStatus 时间线
    jobs,           // AI 任务历史
    audit,          // AI 操作审计
    provider: {
      active: getActiveProviderName(),
      isConfigured: getActiveProvider().isConfigured(),
      aiModel: env.OPENAI_MODEL,
    },
  });
});

// ========================================================================
// POST /:leadId/research — 复用 runResearch + 状态机推进
// ========================================================================
router.post('/:leadId/research', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');

  // 前置状态校验：NEW/RESEARCHED 允许触发 research
  const lead = await Lead.findById(lid).select('devStatus ownerId').lean();
  if (!lead) return fail(res, 404, 404, 'Lead not found');
  const cur = (lead.devStatus as DevStatus) ?? 'NEW';
  if (cur !== 'NEW' && cur !== 'RESEARCHED' && cur !== 'QUALIFIED') {
    return fail(res, 400, 400, `Cannot run research in devStatus=${cur}; must be NEW/RESEARCHED/QUALIFIED`);
  }

  // 推进到 RESEARCHING（在 AI 调用前）— 受控转换
  try {
    if (cur === 'NEW') {
      await transitionDevStatus({
        leadId: lid, toStatus: 'RESEARCHING', changedBy: req.admin?.id,
        reason: 'Trigger AI research', source: 'AI_RESEARCH',
      });
    }
  } catch (e: any) {
    return fail(res, 400, 400, e?.message || 'Cannot transition to RESEARCHING');
  }

  try {
    const job = await runResearch(lid, { force: !!req.body?.force, createdBy: req.admin?.id });
    // AI 成功后推进 RESEARCHED（仅当当前为 RESEARCHING）
    const refreshed = await Lead.findById(lid).select('devStatus').lean();
    if (refreshed && refreshed.devStatus === 'RESEARCHING') {
      await transitionDevStatus({
        leadId: lid, toStatus: 'RESEARCHED', changedBy: req.admin?.id,
        reason: `AI research completed (job ${job._id})`, source: 'AI_RESEARCH',
        metadata: { jobId: String(job._id), status: job.status },
      });
    }
    ok(res, toPlain(job));
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Research failed');
  }
});

// ========================================================================
// POST /:leadId/qualify — 复用 runQualification
// ========================================================================
router.post('/:leadId/qualify', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');

  const lead = await Lead.findById(lid).select('devStatus').lean();
  if (!lead) return fail(res, 404, 404, 'Lead not found');
  const cur = (lead.devStatus as DevStatus) ?? 'NEW';
  if (cur !== 'RESEARCHED' && cur !== 'QUALIFIED') {
    return fail(res, 400, 400, `Cannot run qualification in devStatus=${cur}; must be RESEARCHED/QUALIFIED`);
  }

  try {
    const result = await runQualification(lid, { force: !!req.body?.force, createdBy: req.admin?.id });
    // AI 成功 → QUALIFIED（仅当当前为 RESEARCHED）
    const refreshed = await Lead.findById(lid).select('devStatus').lean();
    if (refreshed && refreshed.devStatus === 'RESEARCHED') {
      await transitionDevStatus({
        leadId: lid, toStatus: 'QUALIFIED', changedBy: req.admin?.id,
        reason: `AI qualification completed (job ${result.job._id})`,
        source: 'AI_QUALIFICATION',
        metadata: { jobId: String(result.job._id), finalScore: result.score.finalScore },
      });
    }
    ok(res, {
      lead: result.lead, intent: result.intent, score: result.score, job: toPlain(result.job),
    });
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Qualification failed');
  }
});

// ========================================================================
// POST /:leadId/product-match — 复用 runProductMatch（不强制推进状态）
// ========================================================================
router.post('/:leadId/product-match', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');

  try {
    const result = await runProductMatch(lid, { force: !!req.body?.force, createdBy: req.admin?.id });
    ok(res, { matches: result.matches, job: toPlain(result.job) });
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Product match failed');
  }
});

// ========================================================================
// POST /:leadId/strategy — 复用 runStrategy（不强制推进状态）
// ========================================================================
router.post('/:leadId/strategy', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');

  try {
    const result = await runStrategy(lid, { force: !!req.body?.force, createdBy: req.admin?.id });
    ok(res, { strategy: result.strategy, job: toPlain(result.job) });
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Strategy failed');
  }
});

// ========================================================================
// POST /:leadId/message — 复用 runMessageDraft（不直接到 CONTACT_READY）
// ========================================================================
router.post('/:leadId/message', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  const b = req.body || {};
  const language = ['en', 'ar', 'zh'].includes(b.language) ? b.language : 'en';
  const channel  = ['EMAIL', 'WHATSAPP', 'LINKEDIN', 'OTHER'].includes(b.channel) ? b.channel : 'EMAIL';
  const purpose  = ['FIRST_CONTACT','FOLLOW_UP','INQUIRY_FOLLOW_UP','QUOTE_FOLLOW_UP','REACTIVATION'].includes(b.purpose) ? b.purpose : 'FIRST_CONTACT';

  try {
    const result = await runMessageDraft(lid, { language, channel, purpose } as any, { createdBy: req.admin?.id });
    // 注意：AI 生成 draft 后 devStatus 不变；必须经 /:leadId/approve 才推进 CONTACT_READY
    ok(res, { draft: result.draft, doc: toPlain(result.doc), job: toPlain(result.job) });
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Message draft failed');
  }
});

// ========================================================================
// POST /:leadId/approve — 批准 message draft → CONTACT_READY（人工审核后唯一入口）
//   禁止 AI 自动发送；这里仅修改 draft.status + 推进 devStatus，不调用任何外发通道。
// ========================================================================
router.post('/:leadId/approve', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');

  const draftId = req.body?.draftId;
  if (!draftId || !isValidObjectId(draftId)) {
    return fail(res, 400, 400, 'draftId is required');
  }
  const draft = await AIMessageDraft.findById(draftId).lean();
  if (!draft) return fail(res, 404, 404, 'Draft not found');
  if (String(draft.leadId) !== lid) return fail(res, 400, 400, 'Draft does not belong to this Lead');

  // 只允许 DRAFT/EDITED → APPROVED；REJECTED/SENT 不可再 approve
  if (draft.status === 'APPROVED') return fail(res, 400, 400, 'Draft already approved');
  if (draft.status === 'SENT') return fail(res, 400, 400, 'Draft already sent');
  if (draft.status === 'REJECTED') return fail(res, 400, 400, 'Draft was rejected');

  // 写 draft.status = APPROVED
  const updated = await AIMessageDraft.findByIdAndUpdate(
    draftId, { $set: { status: 'APPROVED' } }, { new: true },
  ).lean();

  await AIActionLog.create({
    userId: toId(req.admin?.id) as any,
    leadId: lid as any,
    action: 'APPROVE' as any,
    provider: getActiveProviderName(),
    aiModel: env.OPENAI_MODEL,
    status: 'OK',
    metadata: { draftId: String(draftId), type: 'message_approval' },
  });

  // 推进 devStatus：QUALIFIED → CONTACT_READY（仅在 QUALIFIED 时）
  // 也允许 CONTACT_READY 自身重新 approve 其他 draft（幂等保持 CONTACT_READY）
  const lead = await Lead.findById(lid).select('devStatus').lean();
  if (lead) {
    const cur = (lead.devStatus as DevStatus) ?? 'NEW';
    if (cur === 'QUALIFIED') {
      try {
        await transitionDevStatus({
          leadId: lid, toStatus: 'CONTACT_READY', changedBy: req.admin?.id,
          reason: `Message draft ${draftId} approved by human`, source: 'AI_MESSAGE_APPROVE',
          metadata: { draftId: String(draftId) },
        });
      } catch (e: any) {
        // 转换失败不阻断 approve 本身（draft 已 APPROVED），仅记日志
        await AIActionLog.create({
          userId: toId(req.admin?.id) as any,
          leadId: lid as any,
          action: 'EDIT' as any,
          provider: getActiveProviderName(),
          aiModel: env.OPENAI_MODEL,
          status: 'FAILED',
          metadata: { type: 'dev_status_transition_failed', reason: e?.message || String(e) },
        });
      }
    }
  }

  ok(res, { draft: updated, devStatus: (await Lead.findById(lid).select('devStatus').lean())?.devStatus });
});

// ========================================================================
// POST /:leadId/status — 受控状态转换（人工推进 CONTACTED/REPLIED/FOLLOW_UP/...）
//   禁止 AI 自动调用；只接受人工请求。
// ========================================================================
router.post('/:leadId/status', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');

  const toStatus = req.body?.toStatus;
  if (!toStatus || !(DEV_STATUSES as readonly string[]).includes(toStatus)) {
    return fail(res, 400, 400, `Invalid toStatus; must be one of ${DEV_STATUSES.join('/')}`);
  }

  const lead = await Lead.findById(lid).select('devStatus').lean();
  if (!lead) return fail(res, 404, 404, 'Lead not found');
  const from = (lead.devStatus as DevStatus) ?? 'NEW';

  // 受控转换
  if (!canTransition(from, toStatus as DevStatus)) {
    return fail(res, 400, 400, `Invalid devStatus transition: ${from} → ${toStatus}`);
  }

  try {
    const result = await transitionDevStatus({
      leadId: lid, toStatus: toStatus as DevStatus, changedBy: req.admin?.id,
      reason: req.body?.reason || `Manual transition ${from} → ${toStatus}`,
      source: 'MANUAL',
      metadata: { requestedBy: req.admin?.username },
    });
    ok(res, result);
  } catch (e: any) {
    return fail(res, 500, 500, e?.message || 'Status transition failed');
  }
});

export default router;

/**
 * PHASE 2-C AI 海外客户研究 & 开发助手 — 路由
 * 路径：/api/console/ai/*
 *
 * 安全（§46）：全部 authJWT；superadmin 可见全部；editor/sales 仅可操作自己 owner 的 Lead 上的 AI 任务。
 * 响应：统一 { code, message, data }。
 *
 * 接口清单（§45）：
 *   POST /api/console/ai/research/:leadId                  §12 触发研究
 *   GET  /api/console/ai/research/:leadId                  §14 查询 Lead 的研究 profile + 最近 job
 *   POST /api/console/ai/research/:leadId/retry            §13 重试失败
 *   POST /api/console/ai/score/:leadId                     §8 AI 评分
 *   POST /api/console/ai/product-match/:leadId             §10-11 产品匹配
 *   POST /api/console/ai/strategy/:leadId                  §21 开发策略
 *   POST /api/console/ai/message/:leadId                   §22-25 话术草稿
 *   GET  /api/console/ai/jobs                              §42 任务列表
 *   GET  /api/console/ai/jobs/:id                          §42 任务详情
 *   POST /api/console/ai/jobs/:id/cancel                   §42 取消排队中任务
 *   POST /api/console/ai/bulk/research                     §32 批量研究（需 confirm=true）
 *   GET  /api/console/ai/usage                             §43 用量统计
 *   GET  /api/console/ai/audit                             §29 操作审计
 *   GET  /api/console/ai/provider                          当前活动 provider（用于 UI）
 *   GET  /api/console/ai/dashboard                         §41 AI Dashboard 概览
 *   PATCH /api/console/ai/profile/:leadId                  §28 人工编辑 Profile
 *   PATCH /api/console/ai/message-drafts/:draftId          §27 编辑话术草稿
 *   POST  /api/console/ai/message-drafts/:draftId/approve  §27 批准
 *   POST  /api/console/ai/message-drafts/:draftId/reject   §27 拒绝
 */
import { Router, Response } from 'express';
import { Types, FilterQuery } from 'mongoose';
import { authJWT, AuthRequest } from '../middleware/authJWT';
import { env } from '../config/env';
import Lead, { ILead } from '../models/Lead';
import AIResearchJob, { IAIResearchJob } from '../models/AIResearchJob';
import AIResearchProfile from '../models/AIResearchProfile';
import ProductMatch from '../models/ProductMatch';
import DevelopmentStrategy from '../models/DevelopmentStrategy';
import AIMessageDraft from '../models/AIMessageDraft';
import AIActionLog from '../models/AIActionLog';

import { runResearch, runQualification, runProductMatch, runStrategy, runMessageDraft, runBulkResearch } from '../ai/orchestrator';
import { getActiveProvider, getActiveProviderName, overrideAIProvider } from '../ai/provider';
import { getUsageSummary, checkBudget } from '../ai/budget';
import { containsInjection } from '../ai/injectionGuard';
import { AIError, AI_PURPOSES } from '../types/ai';

const router = Router();

// ============ 全局保护 ============
router.use(authJWT());

// ---------- 工具 ----------
const ok = <T>(res: Response, data: T, message = 'ok') => res.json({ code: 0, message, data });
const fail = (res: Response, status: number, code: number, message: string) =>
  res.status(status).json({ code, message, data: null });

function toId(s: string | undefined): Types.ObjectId | undefined {
  if (!s) return undefined;
  try { return new Types.ObjectId(s); } catch { return undefined; }
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

/** Lead 读权限：superadmin 全部；其他仅 owner === 自己 */
async function canAccessLead(req: AuthRequest, leadId: string): Promise<boolean> {
  if (req.admin?.role === 'superadmin') return true;
  const lead = await Lead.findById(leadId).select('ownerId').lean();
  if (!lead) return false;
  const me = req.admin?.id;
  const oid = String(lead.ownerId ?? '');
  return oid === me || oid === '';
}

/** AI Job 读权限：superadmin 全部；其他仅 createdBy === 自己或 Lead owner === 自己 */
async function canAccessJob(req: AuthRequest, jobId: string): Promise<boolean> {
  if (req.admin?.role === 'superadmin') return true;
  const job = await AIResearchJob.findById(jobId).populate('leadId', 'ownerId').lean() as any;
  if (!job) return false;
  const me = req.admin?.id;
  const owner = String((job.leadId as any)?.ownerId ?? '');
  const creator = String(job.createdBy ?? '');
  return owner === me || creator === me || (owner === '' && creator === '');
}

// ========================================================================
// §12-14 Research
// ========================================================================
router.post('/research/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');

  // §33 §36 prompt injection 早期检测：不阻断，但记录
  if (req.body?.note) {
    const injected = containsInjection(String(req.body.note));
    if (injected.length) {
      await AIActionLog.create({
        userId: toId(req.admin?.id) as any,
        leadId: lid as any,
        action: 'RESEARCH' as any,
        provider: getActiveProviderName(),
        aiModel: env.OPENAI_MODEL,
        status: 'FAILED',
        metadata: { reason: 'prompt_injection_attempt', patterns: injected },
      });
    }
  }

  try {
    const job = await runResearch(lid, { force: !!req.body?.force, createdBy: req.admin?.id });
    ok(res, job.toObject());
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Research failed');
  }
});

router.get('/research/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');

  const [profile, latestJob, latestFailedJob] = await Promise.all([
    AIResearchProfile.findOne({ leadId: lid as any }).lean(),
    AIResearchJob.findOne({ leadId: lid as any, status: 'COMPLETED', purpose: 'CUSTOMER_RESEARCH' })
      .sort({ createdAt: -1 }).lean(),
    AIResearchJob.findOne({ leadId: lid as any, status: 'FAILED', purpose: 'CUSTOMER_RESEARCH' })
      .sort({ createdAt: -1 }).lean(),
  ]);
  ok(res, {
    profile,
    latestJob,
    latestFailedJob,
    hasCompleted: !!profile && profile.editSource === 'AI' && profile.researchStatus === 'AI_RESEARCH',
    canRefresh: true,
  });
});

router.post('/research/:leadId/retry', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  try {
    const job = await runResearch(lid, { force: true, createdBy: req.admin?.id });
    ok(res, job.toObject());
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Retry failed');
  }
});

// ========================================================================
// §8 Score
// ========================================================================
router.post('/score/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  try {
    const result = await runQualification(lid, { force: !!req.body?.force, createdBy: req.admin?.id });
    ok(res, {
      lead: result.lead,
      intent: result.intent,
      score: result.score,
      job: result.job.toObject(),
    });
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Score failed');
  }
});

// ========================================================================
// §10-11 Product Match
// ========================================================================
router.post('/product-match/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  try {
    const result = await runProductMatch(lid, { force: !!req.body?.force, createdBy: req.admin?.id });
    ok(res, { matches: result.matches, job: result.job.toObject() });
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Product match failed');
  }
});

router.get('/product-match/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  const matches = await ProductMatch.find({ leadId: lid as any }).sort({ matchScore: -1 }).limit(20).lean();
  ok(res, matches);
});

// ========================================================================
// §21 Strategy
// ========================================================================
router.post('/strategy/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  try {
    const result = await runStrategy(lid, { force: !!req.body?.force, createdBy: req.admin?.id });
    ok(res, { strategy: result.strategy, job: result.job.toObject() });
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Strategy failed');
  }
});

router.get('/strategy/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  const strategy = await DevelopmentStrategy.findOne({ leadId: lid as any }).lean();
  ok(res, strategy);
});

// ========================================================================
// §22-25 Message Draft
// ========================================================================
router.post('/message/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  const b = req.body || {};
  const language = ['en', 'ar', 'zh'].includes(b.language) ? b.language : 'en';
  const channel  = ['EMAIL', 'WHATSAPP', 'LINKEDIN', 'OTHER'].includes(b.channel) ? b.channel : 'EMAIL';
  const purpose  = ['FIRST_CONTACT','FOLLOW_UP','INQUIRY_FOLLOW_UP','QUOTE_FOLLOW_UP','REACTIVATION'].includes(b.purpose) ? b.purpose : 'FIRST_CONTACT';
  try {
    const result = await runMessageDraft(lid, { language, channel, purpose } as any, { createdBy: req.admin?.id });
    ok(res, { draft: result.draft, doc: result.doc.toObject(), job: result.job.toObject() });
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') return fail(res, 429, 429, e.message);
    return fail(res, 500, 500, e?.message || 'Message draft failed');
  }
});

router.get('/message-drafts/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  const { page, pageSize, skip } = parsePage(req.query);
  const filter: any = { leadId: lid as any };
  if (req.query.status) filter.status = req.query.status;
  ok(res, await paginate(AIMessageDraft, filter, page, pageSize, skip));
});

router.patch('/message-drafts/:draftId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.draftId)) return fail(res, 400, 400, 'Invalid draftId');
  const draft = await AIMessageDraft.findById(req.params.draftId).populate('leadId', 'ownerId').lean() as any;
  if (!draft) return fail(res, 404, 404, 'Draft not found');
  // 权限：Lead owner 或 superadmin
  if (req.admin?.role !== 'superadmin' && String(draft.leadId?.ownerId ?? '') !== req.admin?.id) {
    return fail(res, 403, 403, 'Permission denied');
  }
  const b = { ...(req.body || {}) };
  const editable = ['subject', 'content', 'personalization', 'language', 'channel', 'purpose'];
  const update: any = {};
  for (const k of editable) if (b[k] !== undefined) update[k] = b[k];
  // §28 人工编辑 → 标记 EDITED，aiSnapshot 保留
  update.status = 'EDITED';
  const doc = await AIMessageDraft.findByIdAndUpdate(req.params.draftId, { $set: update }, { new: true }).lean();
  await AIActionLog.create({
    userId: toId(req.admin?.id) as any,
    leadId: draft.leadId?._id as any,
    action: 'EDIT',
    provider: getActiveProviderName(),
    aiModel: env.OPENAI_MODEL,
    status: 'OK',
    metadata: { draftId: req.params.draftId, fields: Object.keys(update) },
  });
  ok(res, doc);
});

router.post('/message-drafts/:draftId/approve', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.draftId)) return fail(res, 400, 400, 'Invalid draftId');
  const draft = await AIMessageDraft.findById(req.params.draftId).populate('leadId', 'ownerId').lean() as any;
  if (!draft) return fail(res, 404, 404, 'Draft not found');
  if (req.admin?.role !== 'superadmin' && String(draft.leadId?.ownerId ?? '') !== req.admin?.id) {
    return fail(res, 403, 403, 'Permission denied');
  }
  const doc = await AIMessageDraft.findByIdAndUpdate(req.params.draftId, { $set: { status: 'APPROVED' } }, { new: true }).lean();
  await AIActionLog.create({
    userId: toId(req.admin?.id) as any, leadId: draft.leadId?._id as any,
    action: 'APPROVE', provider: getActiveProviderName(), aiModel: env.OPENAI_MODEL, status: 'OK',
    metadata: { draftId: req.params.draftId },
  });
  ok(res, doc);
});

router.post('/message-drafts/:draftId/reject', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.draftId)) return fail(res, 400, 400, 'Invalid draftId');
  const draft = await AIMessageDraft.findById(req.params.draftId).populate('leadId', 'ownerId').lean() as any;
  if (!draft) return fail(res, 404, 404, 'Draft not found');
  if (req.admin?.role !== 'superadmin' && String(draft.leadId?.ownerId ?? '') !== req.admin?.id) {
    return fail(res, 403, 403, 'Permission denied');
  }
  const doc = await AIMessageDraft.findByIdAndUpdate(req.params.draftId, { $set: { status: 'REJECTED' } }, { new: true }).lean();
  await AIActionLog.create({
    userId: toId(req.admin?.id) as any, leadId: draft.leadId?._id as any,
    action: 'REJECT', provider: getActiveProviderName(), aiModel: env.OPENAI_MODEL, status: 'OK',
    metadata: { draftId: req.params.draftId, reason: req.body?.reason || '' },
  });
  ok(res, doc);
});

// ========================================================================
// §28 人工编辑 Research Profile
// ========================================================================
router.patch('/profile/:leadId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.leadId)) return fail(res, 400, 400, 'Invalid leadId');
  const lid = req.params.leadId;
  if (!(await canAccessLead(req, lid))) return fail(res, 403, 403, 'Permission denied');
  const b = { ...(req.body || {}) };
  const editable = ['companySummary', 'businessModel', 'industry', 'companyType', 'marketPosition',
    'targetCustomers', 'productCategories', 'potentialNeeds', 'possibleCeramicDemand',
    'purchaseSignals', 'riskSignals', 'recommendedProducts', 'recommendedApproach'];
  const update: any = {};
  for (const k of editable) if (b[k] !== undefined) update[k] = b[k];
  // §28 editSource=MANUALLY_EDITED，aiSnapshot 保留原始
  update.editSource = 'MANUALLY_EDITED';
  update.researchStatus = 'MANUAL_EDIT';
  const doc = await AIResearchProfile.findOneAndUpdate(
    { leadId: lid as any },
    { $set: update },
    { new: true, upsert: false },
  ).lean();
  if (!doc) return fail(res, 404, 404, 'Profile not found (run research first)');
  await AIActionLog.create({
    userId: toId(req.admin?.id) as any, leadId: lid as any,
    action: 'EDIT', provider: getActiveProviderName(), aiModel: env.OPENAI_MODEL, status: 'OK',
    metadata: { fields: Object.keys(update) },
  });
  ok(res, doc);
});

// ========================================================================
// §42 Jobs
// ========================================================================
router.get('/jobs', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const filter: any = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.purpose && AI_PURPOSES.includes(req.query.purpose as any)) filter.purpose = req.query.purpose;
  if (req.query.provider) filter.provider = req.query.provider;
  if (req.query.leadId && isValidObjectId(req.query.leadId as string)) filter.leadId = toId(req.query.leadId as string);
  if (req.admin?.role !== 'superadmin') {
    // 非 superadmin：按 Lead owner 或 createdBy 过滤
    const me = toId(req.admin?.id);
    const ownLeads = await Lead.find({ ownerId: me }).select('_id').lean();
    filter.$or = [
      { leadId: { $in: ownLeads.map((l) => l._id) } },
      { createdBy: me },
    ];
  }
  ok(res, await paginate(AIResearchJob, filter, page, pageSize, skip));
});

router.get('/jobs/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid job id');
  if (!(await canAccessJob(req, req.params.id))) return fail(res, 403, 403, 'Permission denied');
  const job = await AIResearchJob.findById(req.params.id).lean();
  if (!job) return fail(res, 404, 404, 'Job not found');
  ok(res, job);
});

router.post('/jobs/:id/cancel', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid job id');
  if (!(await canAccessJob(req, req.params.id))) return fail(res, 403, 403, 'Permission denied');
  const job = await AIResearchJob.findById(req.params.id);
  if (!job) return fail(res, 404, 404, 'Job not found');
  if (job.status !== 'QUEUED') return fail(res, 400, 400, 'Only QUEUED jobs can be cancelled');
  job.status = 'CANCELLED' as any;
  job.completedAt = new Date();
  await job.save();
  await AIActionLog.create({
    userId: toId(req.admin?.id) as any, jobId: job._id, leadId: job.leadId,
    action: 'RESEARCH', provider: job.provider, aiModel: job.aiModel || '',
    status: 'CANCELLED', metadata: { reason: 'user_cancelled' },
  });
  ok(res, job.toObject());
});

// ========================================================================
// §32 Bulk Research
// ========================================================================
router.post('/bulk/research', async (req: AuthRequest, res) => {
  const b = req.body || {};
  const leadIds: string[] = Array.isArray(b.leadIds) ? b.leadIds : [];
  if (!leadIds.length) return fail(res, 400, 400, 'leadIds required');
  // §32 二次确认
  if (!b.confirm) {
    return ok(res, {
      confirmRequired: true,
      message: `You are about to research ${leadIds.length} leads. Estimated AI usage: ${leadIds.length} requests. Set confirm=true to continue.`,
    });
  }
  // 校验每条 lead 权限
  const accessible: string[] = [];
  for (const id of leadIds) {
    if (isValidObjectId(id) && (await canAccessLead(req, id))) accessible.push(id);
  }
  if (!accessible.length) return fail(res, 403, 403, 'No accessible leads');
  try {
    const result = await runBulkResearch(accessible, { createdBy: req.admin?.id });
    ok(res, result);
  } catch (e: any) {
    return fail(res, 500, 500, e?.message || 'Bulk research failed');
  }
});

// ========================================================================
// §43 Usage
// ========================================================================
router.get('/usage', async (_req: AuthRequest, res) => {
  const summary = await getUsageSummary();
  ok(res, summary);
});

router.get('/budget', async (req: AuthRequest, res) => {
  const lid = isValidObjectId(req.query.leadId as string) ? req.query.leadId as string : undefined;
  try {
    const budget = await checkBudget(lid);
    ok(res, {
      ...budget,
      limits: {
        daily: env.AI_DAILY_REQUEST_LIMIT,
        monthly: env.AI_MONTHLY_REQUEST_LIMIT,
        perLead: env.AI_PER_LEAD_DAILY_LIMIT,
      },
    });
  } catch (e: any) {
    if (e instanceof AIError && e.kind === 'BUDGET_EXCEEDED') {
      return ok(res, { blocked: true, message: e.message });
    }
    return fail(res, 500, 500, e?.message || 'budget failed');
  }
});

// ========================================================================
// §29 Audit Log
// ========================================================================
router.get('/audit', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const filter: any = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.leadId && isValidObjectId(req.query.leadId as string)) filter.leadId = toId(req.query.leadId as string);
  if (req.admin?.role !== 'superadmin') {
    filter.userId = toId(req.admin?.id);
  }
  ok(res, await paginate(AIActionLog, filter, page, pageSize, skip));
});

// ========================================================================
// §41 Dashboard
// ========================================================================
router.get('/dashboard', async (req: AuthRequest, res) => {
  const baseFilter: any = req.admin?.role === 'superadmin' ? {} : {
    $or: [
      { createdBy: toId(req.admin?.id) },
      // 由 Lead owner 反查（aggregate 简化处理）
    ],
  };

  const [totalJobs, completed, failed, queued, running] = await Promise.all([
    AIResearchJob.countDocuments(baseFilter),
    AIResearchJob.countDocuments({ ...baseFilter, status: 'COMPLETED' }),
    AIResearchJob.countDocuments({ ...baseFilter, status: 'FAILED' }),
    AIResearchJob.countDocuments({ ...baseFilter, status: 'QUEUED' }),
    AIResearchJob.countDocuments({ ...baseFilter, status: 'RUNNING' }),
  ]);

  // AI Leads: 有过 AI 研究记录的 Lead 数
  const aiLeadsCount = await AIResearchProfile.countDocuments({});

  // High Intent Leads: intent score >= 70（取最近 qualification job 的 result.intent.score）
  const highIntentAgg = await AIResearchJob.aggregate([
    { $match: { purpose: 'LEAD_QUALIFICATION', status: 'COMPLETED' } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$leadId', score: { $first: '$result.intent.score' } } },
    { $match: { score: { $gte: 70 } } },
    { $count: 'count' },
  ]);
  const highIntent = (highIntentAgg[0]?.count) || 0;

  // Message Drafts 统计
  const [draftsTotal, draftsApproved] = await Promise.all([
    AIMessageDraft.countDocuments({}),
    AIMessageDraft.countDocuments({ status: 'APPROVED' }),
  ]);

  // Usage
  const usage = await getUsageSummary();

  // 最近 jobs（按 createdAt 倒序，限 10）
  const recentJobs = await AIResearchJob.find(baseFilter).sort({ createdAt: -1 }).limit(10).lean();

  ok(res, {
    jobs: { total: totalJobs, completed, failed, queued, running },
    aiLeads: aiLeadsCount,
    highIntentLeads: highIntent,
    messageDrafts: { total: draftsTotal, approved: draftsApproved },
    usage,
    recentJobs,
    provider: {
      active: getActiveProviderName(),
      aiModel: env.OPENAI_MODEL,
      isConfigured: getActiveProvider().isConfigured(),
    },
  });
});

// ========================================================================
// 当前 Provider 元信息
// ========================================================================
router.get('/provider', async (_req: AuthRequest, res) => {
  const p = getActiveProvider();
  ok(res, {
    active: p.name,
    isConfigured: p.isConfigured(),
    aiModel: env.OPENAI_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
    concurrency: env.AI_CONCURRENCY,
    limits: {
      daily: env.AI_DAILY_REQUEST_LIMIT,
      monthly: env.AI_MONTHLY_REQUEST_LIMIT,
      perLead: env.AI_PER_LEAD_DAILY_LIMIT,
    },
  });
});

// ========================================================================
// 测试 helper：注入 fake provider（仅 superadmin；仅开发环境）
// ========================================================================
router.post('/_test/override-provider', async (req: AuthRequest, res) => {
  if (req.admin?.role !== 'superadmin') return fail(res, 403, 403, 'Superadmin required');
  if (env.NODE_ENV === 'production') return fail(res, 403, 403, 'Not allowed in production');
  // body.provider: 'mock' | 'openai' | null
  const p = req.body?.provider;
  if (p === null) {
    overrideAIProvider(null);
    return ok(res, { cleared: true });
  }
  // 只允许 mock / openai；其他自定义对象需要直接调用 overrideAIProvider（测试代码内部）
  if (p === 'mock' || p === 'openai') {
    // 简化：清除后 env 自动选择
    overrideAIProvider(null);
    return ok(res, { reset: true, willUse: getActiveProviderName() });
  }
  return fail(res, 400, 400, 'Unsupported provider for HTTP override');
});

export default router;

/**
 * PHASE 2-C AI Orchestrator — 业务流程编排（单文件，便于测试）
 *
 * 把：sanitizeLeadForAI → checkBudget → PromptTemplate → Provider.complete →
 *    Schema 校验 → 写 AIResearchJob / AIResearchProfile / ProductMatch /
 *    DevelopmentStrategy / AIMessageDraft / AIUsage / AIActionLog
 *    + 缓存（§49）+ 失败安全（§34/§54）
 *
 * 6 个核心动作：
 *   - runResearch(leadId)       §12-15
 *   - runQualification(leadId)  §7-9
 *   - runProductMatch(leadId)   §10-11
 *   - runStrategy(leadId)       §21
 *   - runMessageDraft(leadId, opts) §22-25
 *   - runBulkResearch(leadIds[]) §32-33
 */
import { Types } from 'mongoose';
import { env } from '../config/env';
import Lead, { ILead } from '../models/Lead';
import Product, { IProduct } from '../models/Product';
import AIResearchJob, { IAIResearchJob } from '../models/AIResearchJob';
import AIResearchProfile, { IAIResearchProfile } from '../models/AIResearchProfile';
import ProductMatch, { IProductMatch } from '../models/ProductMatch';
import DevelopmentStrategy, { IDevelopmentStrategy } from '../models/DevelopmentStrategy';
import AIMessageDraft, { IAIMessageDraft } from '../models/AIMessageDraft';
import AIActionLog from '../models/AIActionLog';

import { getActiveProvider, getMockProvider } from './provider';
import { mockResearch, mockPurchaseIntent, mockLeadScore, mockProductMatch, mockStrategy, mockMessageDraft } from './mockEngine';
import { getPrompt } from './prompts';
import { parseResearch, parseQualification, parseProductMatches, parseStrategy, parseMessageDraft } from './schemas';
import { sanitizeLeadForAI } from './sanitizer';
import { wrapUntrusted, containsInjection } from './injectionGuard';
import { checkBudget, recordUsage } from './budget';
import { AIQueue } from './queue';
import {
  AIError, AISanitizedLead, AIProductSnippet,
  AIPurchaseIntent, AILeadScore, AIProductMatch as IAIPM,
  AIResearchResult, AIDevelopmentStrategy as IAIDev,
  AIMessageDraftResult, AIPurpose,
} from '../types/ai';

const _sharedQueue = new AIQueue();

// ---------- 取产品目录（限定大小，避免 prompt 超长） ----------
async function loadProductCatalog(limit = 60): Promise<IProduct[]> {
  return Product.find({ isPublished: true }).limit(limit).lean();
}
function productSnippets(products: IProduct[]): AIProductSnippet[] {
  return products.map((p) => ({
    _id: String(p._id),
    sku: p.sku,
    nameEn: p.nameEn,
    nameAr: p.nameAr || '',
    category: p.category,
    isCustom: !!p.isCustom,
    isStock: !!p.isStock,
  }));
}

// ---------- 取当前 Lead 的 rule score（PHASE 2-B 已有）----------
function ruleScoreFromLead(lead: ILead): number {
  return typeof lead.score === 'number' ? Math.max(0, Math.min(100, lead.score | 0)) : 0;
}

// ========================================================================
// 1. Customer Research
// ========================================================================
export async function runResearch(leadId: string | Types.ObjectId, opts: { force?: boolean; createdBy?: string } = {}): Promise<IAIResearchJob> {
  const lid = String(leadId);

  // §49 缓存：若已有 COMPLETED Profile 且未要求刷新 → 直接返回最近一条 Job
  if (!opts.force) {
    const existing = await AIResearchProfile.findOne({ leadId: lid as any }).lean();
    if (existing && existing.editSource === 'AI' && existing.researchStatus === 'AI_RESEARCH') {
      const lastJob = await AIResearchJob.findOne({ leadId: lid as any, status: 'COMPLETED', purpose: 'CUSTOMER_RESEARCH' })
        .sort({ createdAt: -1 }).lean();
      if (lastJob) return lastJob as any;
    }
  }

  await checkBudget(lid);

  // 创建 Job 入队（QUEUED → RUNNING）
  const job = await AIResearchJob.create({
    leadId: lid as any,
    purpose: 'CUSTOMER_RESEARCH',
    status: 'QUEUED',
    provider: getActiveProvider().name,
    createdBy: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
  });

  return _sharedQueue.enqueue(async () => executeResearch(job, lid, opts.createdBy));
}

async function executeResearch(job: IAIResearchJob, leadId: string, createdBy?: string): Promise<IAIResearchJob> {
  job.status = 'RUNNING';
  job.startedAt = new Date();
  await job.save();

  let status: 'COMPLETED' | 'FAILED' = 'COMPLETED';
  let error = '';
  let errorKind = '';
  let tokens = { input: 0, output: 0 };
  let model = env.AI_MOCK_MODEL_ID;

  try {
    const { lead, sources } = await sanitizeLeadForAI(leadId);
    if (!lead) throw new AIError('UNKNOWN', 'Lead not found');

    const products = await loadProductCatalog();
    const snippets = productSnippets(products);

    const provider = getActiveProvider();
    job.provider = provider.name;
    job.inputSnapshot = { lead, productCount: snippets.length };
    await job.save();

    let result: AIResearchResult;
    if (provider.name === 'mock') {
      // §38 走专用 mock 引擎，确保结构正确 + 不伪造
      result = mockResearch(lead, snippets);
      tokens = { input: Math.ceil(JSON.stringify(lead).length / 4), output: 200 };
      model = env.AI_MOCK_MODEL_ID;
    } else {
      // §19-20 OpenAI 路径
      const spec = getPrompt('CUSTOMER_RESEARCH');
      const user = spec.userPromptTemplate(lead, snippets);
      const guard = wrapUntrusted(user);
      const resp = await provider.complete({
        system: spec.systemPrompt,
        user: guard.sanitized,
        jsonMode: true,
        timeoutMs: env.AI_TIMEOUT_MS,
      });
      tokens = resp.tokens;
      model = resp.model;
      result = parseResearch(resp.content, snippets.map((s) => s.nameEn));
      // 把 lead_input sources 合并进去
      result.sources = (sources || []).concat(result.sources || []);
    }

    job.result = result;
    job.confidence = result.confidence;
    job.sources = result.sources || [];
    job.aiModel = model;
    job.tokenUsage = { input: tokens.input, output: tokens.output, total: tokens.input + tokens.output };
    job.estimatedCostUsd = provider.name === 'openai'
      ? +((tokens.input / 1000) * env.AI_OPENAI_INPUT_PRICE_PER_1K + (tokens.output / 1000) * env.AI_OPENAI_OUTPUT_PRICE_PER_1K).toFixed(6)
      : 0;
    job.promptVersion = 'CUSTOMER_RESEARCH_V1';
    job.completedAt = new Date();
    job.status = 'COMPLETED';

    // §5 同步写 AIResearchProfile（一对一 Lead）
    await AIResearchProfile.findOneAndUpdate(
      { leadId: leadId as any },
      {
        jobId: job._id,
        companySummary: result.companySummary,
        businessModel: result.businessModel,
        industry: result.industry,
        companyType: result.companyType,
        marketPosition: result.marketPosition,
        targetCustomers: result.targetCustomers,
        productCategories: result.productCategories,
        potentialNeeds: result.potentialNeeds,
        possibleCeramicDemand: result.possibleCeramicDemand,
        purchaseSignals: result.purchaseSignals,
        riskSignals: result.riskSignals,
        recommendedProducts: result.recommendedProducts,
        recommendedApproach: result.recommendedApproach,
        confidence: result.confidence,
        sources: result.sources,
        researchStatus: 'AI_RESEARCH',
        editSource: 'AI',
        aiSnapshot: result,
        createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
      },
      { upsert: true, new: true },
    );

    // 写 Lead.researchType = AI_RESEARCH
    await Lead.updateOne({ _id: leadId }, { $set: { researchType: 'AI_RESEARCH' } });

    await recordUsage({
      provider: provider.name, model, purpose: 'CUSTOMER_RESEARCH',
      inputTokens: tokens.input, outputTokens: tokens.output,
      status: 'OK', leadId, jobId: String(job._id), createdBy,
    });
    await AIActionLog.create({
      userId: createdBy ? new Types.ObjectId(createdBy) : undefined,
      leadId: leadId as any, jobId: job._id,
      action: 'RESEARCH' as any, provider: provider.name, aiModel: model, promptVersion: 'CUSTOMER_RESEARCH_V1',
      status: 'OK', tokenUsage: job.tokenUsage,
    });
  } catch (e: any) {
    status = 'FAILED';
    error = e?.message || String(e);
    errorKind = e?.kind || 'UNKNOWN';
    job.status = 'FAILED';
    job.error = error;
    job.errorKind = errorKind;
    job.completedAt = new Date();
    await recordUsage({
      provider: job.provider, model, purpose: 'CUSTOMER_RESEARCH',
      inputTokens: 0, outputTokens: 0,
      status: 'FAILED', errorKind, leadId, jobId: String(job._id), createdBy,
    });
    await AIActionLog.create({
      userId: createdBy ? new Types.ObjectId(createdBy) : undefined,
      leadId: leadId as any, jobId: job._id,
      action: 'RESEARCH' as any, provider: job.provider, aiModel: model,
      status: 'FAILED', metadata: { error, errorKind },
    });
  } finally {
    try { await job.save(); } catch { /* noop */ }
  }

  return job;
}

// ========================================================================
// 2. Lead Qualification (Intent + AI Score)
// ========================================================================
export async function runQualification(leadId: string, opts: { createdBy?: string; force?: boolean } = {}): Promise<{ lead: ILead; intent: AIPurchaseIntent; score: AILeadScore; job: IAIResearchJob }> {
  const lid = String(leadId);
  await checkBudget(lid);

  const lead = await Lead.findById(lid).lean();
  if (!lead) throw new AIError('UNKNOWN', 'Lead not found');
  const ruleScore = ruleScoreFromLead(lead);

  const job = await AIResearchJob.create({
    leadId: lid as any,
    purpose: 'LEAD_QUALIFICATION',
    status: 'QUEUED',
    provider: getActiveProvider().name,
    createdBy: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
  });

  return _sharedQueue.enqueue(async () => {
    job.status = 'RUNNING';
    job.startedAt = new Date();
    await job.save();

    let tokens = { input: 0, output: 0 };
    let model = env.AI_MOCK_MODEL_ID;
    let intent: AIPurchaseIntent;
    let score: AILeadScore;
    let error = '';
    let errorKind = '';

    try {
      const { lead: sanitized } = await sanitizeLeadForAI(lid);
      if (!sanitized) throw new AIError('UNKNOWN', 'Lead not found');
      const products = await loadProductCatalog(20);
      const snippets = productSnippets(products);
      const provider = getActiveProvider();
      job.provider = provider.name;
      job.inputSnapshot = { lead: sanitized };
      await job.save();

      if (provider.name === 'mock') {
        intent = mockPurchaseIntent(sanitized);
        score = mockLeadScore(sanitized, ruleScore, intent);
        tokens = { input: 100, output: 60 };
        model = env.AI_MOCK_MODEL_ID;
      } else {
        const spec = getPrompt('LEAD_QUALIFICATION');
        const resp = await provider.complete({
          system: spec.systemPrompt,
          user: spec.userPromptTemplate(sanitized, snippets),
          jsonMode: true,
          timeoutMs: env.AI_TIMEOUT_MS,
        });
        tokens = resp.tokens;
        model = resp.model;
        const parsed = parseQualification(resp.content, ruleScore);
        intent = parsed.intent;
        score = parsed.aiScore;
      }

      job.result = { intent, score };
      job.confidence = score.finalScore;
      job.tokenUsage = { input: tokens.input, output: tokens.output, total: tokens.input + tokens.output };
      job.promptVersion = 'LEAD_QUALIFICATION_V1';
      job.aiModel = model;
      job.completedAt = new Date();
      job.status = 'COMPLETED';
      job.error = '';
      job.errorKind = '';

      // 写回 Lead.score / grade（保持 PHASE 2-B 字段不破坏，写入 finalScore）
      const newGrade = score.finalScore >= 80 ? 'A' : score.finalScore >= 60 ? 'B' : score.finalScore >= 40 ? 'C' : 'D';
      await Lead.updateOne({ _id: lid }, {
        $set: {
          score: score.finalScore,
          grade: newGrade,
          scoreReasons: score.reasons,
          purchaseIntent: intent.grade === 'HIGH' ? 'high'
                         : intent.grade === 'MEDIUM' ? 'medium'
                         : intent.grade === 'LOW' ? 'low' : 'none',
        },
      });

      await recordUsage({
        provider: provider.name, model, purpose: 'LEAD_QUALIFICATION',
        inputTokens: tokens.input, outputTokens: tokens.output,
        status: 'OK', leadId: lid, jobId: String(job._id), createdBy: opts.createdBy,
      });
      await AIActionLog.create({
        userId: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        leadId: lid as any, jobId: job._id,
        action: 'SCORE' as any, provider: provider.name, aiModel: model, promptVersion: 'LEAD_QUALIFICATION_V1',
        status: 'OK', tokenUsage: job.tokenUsage,
      });
    } catch (e: any) {
      error = e?.message || String(e);
      errorKind = e?.kind || 'UNKNOWN';
      job.status = 'FAILED';
      job.error = error;
      job.errorKind = errorKind;
      job.completedAt = new Date();
      intent = { score: 0, grade: 'UNKNOWN', reasons: [], risks: ['AI qualification failed: ' + error] };
      score = { ruleScore, aiScore: 0, purchaseIntent: 0, dataCompleteness: 0, finalScore: ruleScore, reasons: [`Rule score ${ruleScore}`], risks: ['AI score unavailable'] };
      await recordUsage({
        provider: job.provider, model, purpose: 'LEAD_QUALIFICATION',
        inputTokens: 0, outputTokens: 0,
        status: 'FAILED', errorKind, leadId: lid, jobId: String(job._id), createdBy: opts.createdBy,
      });
      await AIActionLog.create({
        userId: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        leadId: lid as any, jobId: job._id,
        action: 'SCORE' as any, provider: job.provider, aiModel: model,
        status: 'FAILED', metadata: { error, errorKind },
      });
    } finally {
      try { await job.save(); } catch { /* noop */ }
    }

    const refreshedLead = (await Lead.findById(lid).lean()) as ILead;
    return { lead: refreshedLead, intent, score, job };
  });
}

// ========================================================================
// 3. Product Match
// ========================================================================
export async function runProductMatch(leadId: string, opts: { createdBy?: string; force?: boolean } = {}): Promise<{ matches: IAIPM[]; job: IAIResearchJob }> {
  const lid = String(leadId);
  await checkBudget(lid);

  const job = await AIResearchJob.create({
    leadId: lid as any,
    purpose: 'PRODUCT_MATCHING',
    status: 'QUEUED',
    provider: getActiveProvider().name,
    createdBy: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
  });

  return _sharedQueue.enqueue(async () => {
    job.status = 'RUNNING';
    job.startedAt = new Date();
    await job.save();

    let tokens = { input: 0, output: 0 };
    let model = env.AI_MOCK_MODEL_ID;
    let matches: IAIPM[] = [];
    let error = '';
    let errorKind = '';

    try {
      const { lead } = await sanitizeLeadForAI(lid);
      if (!lead) throw new AIError('UNKNOWN', 'Lead not found');
      const products = await loadProductCatalog();
      const snippets = productSnippets(products);
      const provider = getActiveProvider();
      job.provider = provider.name;
      job.inputSnapshot = { lead, productCount: snippets.length };
      await job.save();

      if (provider.name === 'mock') {
        matches = mockProductMatch(lead, snippets);
        tokens = { input: 80, output: 60 };
        model = env.AI_MOCK_MODEL_ID;
      } else {
        const spec = getPrompt('PRODUCT_MATCHING');
        const resp = await provider.complete({
          system: spec.systemPrompt,
          user: spec.userPromptTemplate(lead, snippets),
          jsonMode: true,
          timeoutMs: env.AI_TIMEOUT_MS,
        });
        tokens = resp.tokens;
        model = resp.model;
        matches = parseProductMatches(resp.content, snippets.map((s) => s._id));
      }

      job.result = { matches };
      job.tokenUsage = { input: tokens.input, output: tokens.output, total: tokens.input + tokens.output };
      job.promptVersion = 'PRODUCT_MATCHING_V1';
      job.aiModel = model;
      job.completedAt = new Date();
      job.status = 'COMPLETED';

      // §11 写 ProductMatch（同 Lead+Product 覆盖）
      if (matches.length) {
        // 先清掉旧的同 Lead 记录，再写新的（防止累积）
        await ProductMatch.deleteMany({ leadId: lid as any });
        await ProductMatch.insertMany(matches.map((m) => ({
          leadId: lid as any,
          productId: new Types.ObjectId(m.productId),
          matchScore: m.matchScore,
          reason: m.reason,
          confidence: m.confidence,
          jobId: job._id,
          editSource: 'AI',
          createdBy: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        })));
      }

      await recordUsage({
        provider: provider.name, model, purpose: 'PRODUCT_MATCHING',
        inputTokens: tokens.input, outputTokens: tokens.output,
        status: 'OK', leadId: lid, jobId: String(job._id), createdBy: opts.createdBy,
      });
      await AIActionLog.create({
        userId: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        leadId: lid as any, jobId: job._id,
        action: 'PRODUCT_MATCH', provider: provider.name, aiModel: model, promptVersion: 'PRODUCT_MATCHING_V1',
        status: 'OK', tokenUsage: job.tokenUsage,
      });
    } catch (e: any) {
      error = e?.message || String(e);
      errorKind = e?.kind || 'UNKNOWN';
      job.status = 'FAILED';
      job.error = error;
      job.errorKind = errorKind;
      job.completedAt = new Date();
      await recordUsage({
        provider: job.provider, model, purpose: 'PRODUCT_MATCHING',
        inputTokens: 0, outputTokens: 0,
        status: 'FAILED', errorKind, leadId: lid, jobId: String(job._id), createdBy: opts.createdBy,
      });
      await AIActionLog.create({
        userId: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        leadId: lid as any, jobId: job._id,
        action: 'PRODUCT_MATCH', provider: job.provider, aiModel: model,
        status: 'FAILED', metadata: { error, errorKind },
      });
    } finally {
      try { await job.save(); } catch { /* noop */ }
    }
    return { matches, job };
  });
}

// ========================================================================
// 4. Development Strategy
// ========================================================================
export async function runStrategy(leadId: string, opts: { createdBy?: string; force?: boolean } = {}): Promise<{ strategy: IAIDev | null; job: IAIResearchJob }> {
  const lid = String(leadId);
  await checkBudget(lid);

  const job = await AIResearchJob.create({
    leadId: lid as any,
    purpose: 'DEVELOPMENT_STRATEGY',
    status: 'QUEUED',
    provider: getActiveProvider().name,
    createdBy: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
  });

  return _sharedQueue.enqueue(async () => {
    job.status = 'RUNNING';
    job.startedAt = new Date();
    await job.save();

    let tokens = { input: 0, output: 0 };
    let model = env.AI_MOCK_MODEL_ID;
    let strategy: IAIDev | null = null;
    let error = '';
    let errorKind = '';

    try {
      const { lead } = await sanitizeLeadForAI(lid);
      if (!lead) throw new AIError('UNKNOWN', 'Lead not found');
      const products = await loadProductCatalog();
      const snippets = productSnippets(products);
      const provider = getActiveProvider();
      job.provider = provider.name;
      job.inputSnapshot = { lead };
      await job.save();

      if (provider.name === 'mock') {
        strategy = mockStrategy(lead, snippets);
        tokens = { input: 120, output: 200 };
        model = env.AI_MOCK_MODEL_ID;
      } else {
        const spec = getPrompt('DEVELOPMENT_STRATEGY');
        const resp = await provider.complete({
          system: spec.systemPrompt,
          user: spec.userPromptTemplate(lead, snippets),
          jsonMode: true,
          timeoutMs: env.AI_TIMEOUT_MS,
        });
        tokens = resp.tokens;
        model = resp.model;
        strategy = parseStrategy(resp.content, snippets.map((s) => s.nameEn));
      }

      job.result = strategy;
      job.confidence = strategy.confidence;
      job.tokenUsage = { input: tokens.input, output: tokens.output, total: tokens.input + tokens.output };
      job.promptVersion = 'DEVELOPMENT_STRATEGY_V1';
      job.aiModel = model;
      job.completedAt = new Date();
      job.status = 'COMPLETED';

      // §21 写 DevelopmentStrategy（一对一 Lead，覆盖；aiSnapshot 保留原始）
      const existing = await DevelopmentStrategy.findOne({ leadId: lid as any }).lean();
      await DevelopmentStrategy.findOneAndUpdate(
        { leadId: lid as any },
        {
          jobId: job._id,
          targetPersona: strategy.targetPersona,
          painPoints: strategy.painPoints,
          potentialProducts: strategy.potentialProducts,
          recommendedValueProposition: strategy.recommendedValueProposition,
          recommendedChannel: strategy.recommendedChannel,
          recommendedTiming: strategy.recommendedTiming,
          followUpStrategy: strategy.followUpStrategy,
          confidence: strategy.confidence,
          sources: strategy.sources,
          editSource: 'AI',
          aiSnapshot: existing?.aiSnapshot || strategy,
          createdBy: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        },
        { upsert: true, new: true },
      );

      await recordUsage({
        provider: provider.name, model, purpose: 'DEVELOPMENT_STRATEGY',
        inputTokens: tokens.input, outputTokens: tokens.output,
        status: 'OK', leadId: lid, jobId: String(job._id), createdBy: opts.createdBy,
      });
      await AIActionLog.create({
        userId: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        leadId: lid as any, jobId: job._id,
        action: 'STRATEGY', provider: provider.name, aiModel: model, promptVersion: 'DEVELOPMENT_STRATEGY_V1',
        status: 'OK', tokenUsage: job.tokenUsage,
      });
    } catch (e: any) {
      error = e?.message || String(e);
      errorKind = e?.kind || 'UNKNOWN';
      job.status = 'FAILED';
      job.error = error;
      job.errorKind = errorKind;
      job.completedAt = new Date();
      await recordUsage({
        provider: job.provider, model, purpose: 'DEVELOPMENT_STRATEGY',
        inputTokens: 0, outputTokens: 0,
        status: 'FAILED', errorKind, leadId: lid, jobId: String(job._id), createdBy: opts.createdBy,
      });
      await AIActionLog.create({
        userId: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        leadId: lid as any, jobId: job._id,
        action: 'STRATEGY', provider: job.provider, aiModel: model,
        status: 'FAILED', metadata: { error, errorKind },
      });
    } finally {
      try { await job.save(); } catch { /* noop */ }
    }
    return { strategy, job };
  });
}

// ========================================================================
// 5. Message Draft
// ========================================================================
export async function runMessageDraft(
  leadId: string,
  payload: { language: 'en' | 'ar' | 'zh'; channel: 'EMAIL' | 'WHATSAPP' | 'LINKEDIN' | 'OTHER'; purpose: 'FIRST_CONTACT' | 'FOLLOW_UP' | 'INQUIRY_FOLLOW_UP' | 'QUOTE_FOLLOW_UP' | 'REACTIVATION' },
  opts: { createdBy?: string } = {},
): Promise<{ draft: AIMessageDraftResult | null; doc: IAIMessageDraft; job: IAIResearchJob }> {
  const lid = String(leadId);
  await checkBudget(lid);

  const job = await AIResearchJob.create({
    leadId: lid as any,
    purpose: 'MESSAGE_DRAFT',
    status: 'QUEUED',
    provider: getActiveProvider().name,
    createdBy: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
  });

  return _sharedQueue.enqueue(async () => {
    job.status = 'RUNNING';
    job.startedAt = new Date();
    await job.save();

    let tokens = { input: 0, output: 0 };
    let model = env.AI_MOCK_MODEL_ID;
    let draft: AIMessageDraftResult | null = null;
    let error = '';
    let errorKind = '';

    try {
      const { lead } = await sanitizeLeadForAI(lid);
      if (!lead) throw new AIError('UNKNOWN', 'Lead not found');
      const products = await loadProductCatalog(20);
      const snippets = productSnippets(products);
      const provider = getActiveProvider();
      job.provider = provider.name;
      job.inputSnapshot = { lead, language: payload.language, channel: payload.channel, purpose: payload.purpose };
      await job.save();

      if (provider.name === 'mock') {
        draft = mockMessageDraft(lead, snippets, payload);
        tokens = { input: 100, output: 200 };
        model = env.AI_MOCK_MODEL_ID;
      } else {
        const spec = getPrompt('MESSAGE_DRAFT');
        const resp = await provider.complete({
          system: spec.systemPrompt,
          user: spec.userPromptTemplate(lead, snippets),
          jsonMode: true,
          timeoutMs: env.AI_TIMEOUT_MS,
        });
        tokens = resp.tokens;
        model = resp.model;
        draft = parseMessageDraft(resp.content);
        draft.language = payload.language;
        draft.channel  = payload.channel;
        draft.purpose  = payload.purpose;
      }

      job.result = draft;
      job.tokenUsage = { input: tokens.input, output: tokens.output, total: tokens.input + tokens.output };
      job.promptVersion = 'MESSAGE_DRAFT_V1';
      job.aiModel = model;
      job.completedAt = new Date();
      job.status = 'COMPLETED';

      // §22 写 AIMessageDraft（保留 aiSnapshot 原始 AI 内容）
      const doc = await AIMessageDraft.create({
        leadId: lid as any,
        jobId: job._id,
        language: draft.language,
        channel: draft.channel,
        purpose: draft.purpose,
        subject: draft.subject,
        content: draft.content,
        personalization: draft.personalization,
        reason: draft.reason,
        status: 'DRAFT',
        aiSnapshot: draft,
        createdBy: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
      });

      await recordUsage({
        provider: provider.name, model, purpose: 'MESSAGE_DRAFT',
        inputTokens: tokens.input, outputTokens: tokens.output,
        status: 'OK', leadId: lid, jobId: String(job._id), createdBy: opts.createdBy,
      });
      await AIActionLog.create({
        userId: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        leadId: lid as any, jobId: job._id,
        action: 'MESSAGE_GENERATION', provider: provider.name, aiModel: model, promptVersion: 'MESSAGE_DRAFT_V1',
        status: 'OK', tokenUsage: job.tokenUsage,
      });
      return { draft, doc, job };
    } catch (e: any) {
      error = e?.message || String(e);
      errorKind = e?.kind || 'UNKNOWN';
      job.status = 'FAILED';
      job.error = error;
      job.errorKind = errorKind;
      job.completedAt = new Date();
      await recordUsage({
        provider: job.provider, model, purpose: 'MESSAGE_DRAFT',
        inputTokens: 0, outputTokens: 0,
        status: 'FAILED', errorKind, leadId: lid, jobId: String(job._id), createdBy: opts.createdBy,
      });
      await AIActionLog.create({
        userId: opts.createdBy ? new Types.ObjectId(opts.createdBy) : undefined,
        leadId: lid as any, jobId: job._id,
        action: 'MESSAGE_GENERATION', provider: job.provider, aiModel: model,
        status: 'FAILED', metadata: { error, errorKind },
      });
      throw e;
    } finally {
      try { await job.save(); } catch { /* noop */ }
    }
  });
}

// ========================================================================
// 6. Bulk Research（§32-33）
// ========================================================================
export async function runBulkResearch(leadIds: string[], opts: { createdBy?: string } = {}): Promise<{ queued: number; jobs: IAIResearchJob[] }> {
  // §32 估算：用 AI_PER_LEAD_DAILY_LIMIT 防打爆（同一 Lead 不可重复研究）
  const uniq = Array.from(new Set(leadIds));
  const jobs: IAIResearchJob[] = [];
  for (const id of uniq) {
    try {
      const job = await runResearch(id, { createdBy: opts.createdBy });
      jobs.push(job);
    } catch (e: any) {
      // 单个失败不阻断批量；返回已入队的
    }
  }
  return { queued: jobs.length, jobs };
}

// ---------- 暴露内部 mock 给测试用（注入 fake provider） ----------
export { _sharedQueue, getMockProvider, containsInjection };

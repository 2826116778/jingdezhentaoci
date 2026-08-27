/**
 * PHASE 2-C §31 预算保护
 *
 * 三道闸：
 *   1. AIUsage 当日请求数 < AI_DAILY_REQUEST_LIMIT
 *   2. AIUsage 当月请求数 < AI_MONTHLY_REQUEST_LIMIT
 *   3. AIResearchJob 某 Lead 当日 COMPLETED+FAILED+RUNNING+QUEUED 数 < AI_PER_LEAD_DAILY_LIMIT
 *
 * 超限 → 抛 AIError(BUDGET_EXCEEDED)，不调用 AI。
 * 调用方据此返回 429 给前端。
 *
 * 注意：DB 查询，所以并发场景下可能有轻微竞争；测试场景对单 Lead 加计数限制可防打爆。
 */
import AIUsage, { IAIUsage } from '../models/AIUsage';
import AIResearchJob, { IAIResearchJob } from '../models/AIResearchJob';
import { env } from '../config/env';
import { AIError } from '../types/ai';

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function checkBudget(leadId?: string): Promise<{ daily: number; monthly: number; perLead: number }> {
  const dayStart = startOfDay();
  const monthStart = startOfMonth();

  const [daily, monthly] = await Promise.all([
    AIUsage.countDocuments({ createdAt: { $gte: dayStart } }),
    AIUsage.countDocuments({ createdAt: { $gte: monthStart } }),
  ]);

  let perLead = 0;
  if (leadId) {
    perLead = await AIResearchJob.countDocuments({
      leadId: leadId as any,
      createdAt: { $gte: dayStart },
    });
  }

  if (daily >= env.AI_DAILY_REQUEST_LIMIT) {
    throw new AIError('BUDGET_EXCEEDED',
      `Daily AI request limit reached (${daily}/${env.AI_DAILY_REQUEST_LIMIT})`, 429);
  }
  if (monthly >= env.AI_MONTHLY_REQUEST_LIMIT) {
    throw new AIError('BUDGET_EXCEEDED',
      `Monthly AI request limit reached (${monthly}/${env.AI_MONTHLY_REQUEST_LIMIT})`, 429);
  }
  if (leadId && perLead >= env.AI_PER_LEAD_DAILY_LIMIT) {
    throw new AIError('BUDGET_EXCEEDED',
      `Per-lead daily limit reached (${perLead}/${env.AI_PER_LEAD_DAILY_LIMIT})`, 429);
  }
  return { daily, monthly, perLead };
}

/**
 * 记录一次 AI 调用用量 + 成本估算
 *  - 失败的调用也记录（status='FAILED'），用于 §30 失败次数统计
 */
export async function recordUsage(opts: {
  provider: string;
  model: string;
  purpose: string;
  inputTokens: number;
  outputTokens: number;
  status: 'OK' | 'FAILED';
  errorKind?: string;
  leadId?: string;
  jobId?: string;
  createdBy?: string;
}): Promise<IAIUsage> {
  const inputTokens = Math.max(0, opts.inputTokens | 0);
  const outputTokens = Math.max(0, opts.outputTokens | 0);
  const totalTokens = inputTokens + outputTokens;
  let estimatedCost = 0;
  if (opts.provider === 'openai') {
    estimatedCost = (inputTokens / 1000) * env.AI_OPENAI_INPUT_PRICE_PER_1K
                  + (outputTokens / 1000) * env.AI_OPENAI_OUTPUT_PRICE_PER_1K;
  }
  return AIUsage.create({
    provider: opts.provider,
    aiModel: opts.model,
    purpose: opts.purpose,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    status: opts.status,
    errorKind: opts.errorKind || '',
    leadId: opts.leadId,
    jobId: opts.jobId,
    createdBy: opts.createdBy,
  });
}

export async function getUsageSummary(): Promise<{
  today: { requests: number; tokens: number; cost: number; failed: number };
  thisWeek: { requests: number; tokens: number; cost: number; failed: number };
  thisMonth: { requests: number; tokens: number; cost: number; failed: number };
  total: { requests: number; tokens: number; cost: number; failed: number };
}> {
  const now = new Date();
  const dayStart = startOfDay(now);
  // week start (周一)
  const weekStart = new Date(now);
  const dow = (weekStart.getDay() + 6) % 7; // Mon=0
  weekStart.setDate(weekStart.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = startOfMonth(now);

  const ranges: [string, Date][] = [
    ['today', dayStart],
    ['thisWeek', weekStart],
    ['thisMonth', monthStart],
    ['total', new Date(0)],
  ];
  const out: any = {};
  for (const [k, start] of ranges) {
    const docs = await AIUsage.find({ createdAt: { $gte: start } }).lean();
    out[k] = {
      requests: docs.length,
      tokens: docs.reduce((s, d) => s + (d.totalTokens || 0), 0),
      cost: +docs.reduce((s, d) => s + (d.estimatedCost || 0), 0).toFixed(6),
      failed: docs.filter((d) => d.status === 'FAILED').length,
    };
  }
  return out as any;
}

export { AIResearchJob };
export type { IAIResearchJob };

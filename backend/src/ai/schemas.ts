/**
 * PHASE 2-C §35 JSON Schema Validation
 *
 * 不引入 zod（避免新增依赖）；使用最小化的结构校验器：
 *   - 检查必需字段存在
 *   - 校验 confidence ∈ {CONFIRMED, INFERRED, UNKNOWN}
 *   - 校验数值范围
 *   - 校验数组类型
 *   - 校验 recommendedProducts 必须出现在 catalog（防 AI 编造产品名）
 *
 * 校验失败 → 抛 AIError(INVALID_JSON)，调用方落 FAILED 状态。
 */
import {
  AIResearchResult, AIPurchaseIntent, AILeadScore, AIProductMatch,
  AIDevelopmentStrategy, AIMessageDraftResult,
  AIField, CONFIDENCE_LEVELS, AIError,
} from '../types/ai';

const VALID_CONF = new Set(CONFIDENCE_LEVELS);

function isObj(v: any): v is Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v);
}
function isStr(v: any): v is string { return typeof v === 'string'; }
function isNum(v: any): v is number { return typeof v === 'number' && isFinite(v); }
function isStrArr(v: any): v is string[] { return Array.isArray(v) && v.every((x) => typeof x === 'string'); }
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function field<T>(raw: any, def: T, isValue: (v: any) => boolean): AIField<T> {
  if (!isObj(raw)) return { value: def, confidence: 'UNKNOWN', reason: 'invalid or missing field' };
  const value: any = raw.value;
  const confidence: any = raw.confidence;
  const reason = isStr(raw.reason) ? raw.reason : '';
  if (!isValue(value)) return { value: def, confidence: 'UNKNOWN', reason: reason || 'invalid value' };
  const conf = VALID_CONF.has(confidence) ? confidence : 'UNKNOWN';
  return { value, confidence: conf, reason };
}

// ========================================================================
// 1. AI Research Result
// ========================================================================
export function parseResearch(content: string, catalog: string[]): AIResearchResult {
  const parsed = safeJSON(content);
  if (!isObj(parsed)) throw new AIError('INVALID_JSON', 'AI research output is not an object');
  const str = (v: any) => isStr(v);
  const strArr = (v: any) => isStrArr(v);

  const recommendedProductsField = field<string[]>(parsed.recommendedProducts, [], strArr);
  // §10/§35 防 AI 编造产品名：只允许 catalog 内的产品
  if (recommendedProductsField.value.length) {
    const valid = recommendedProductsField.value.filter((n) => catalog.includes(n));
    if (valid.length !== recommendedProductsField.value.length) {
      recommendedProductsField.value = valid;
      recommendedProductsField.confidence = 'UNKNOWN';
      recommendedProductsField.reason = (recommendedProductsField.reason || '') + ' [stripped fabricated product names]';
    }
  }

  return {
    companySummary:    field<string>(parsed.companySummary, '', str),
    businessModel:     field<string>(parsed.businessModel, '', str),
    industry:          field<string>(parsed.industry, '', str),
    companyType:       field<string>(parsed.companyType, '', str),
    marketPosition:    field<string>(parsed.marketPosition, '', str),
    targetCustomers:   field<string[]>(parsed.targetCustomers, [], strArr),
    productCategories: field<string[]>(parsed.productCategories, [], strArr),
    potentialNeeds:    field<string[]>(parsed.potentialNeeds, [], strArr),
    possibleCeramicDemand: field<string>(parsed.possibleCeramicDemand, '', str),
    purchaseSignals:  field<string[]>(parsed.purchaseSignals, [], strArr),
    riskSignals:       field<string[]>(parsed.riskSignals, [], strArr),
    recommendedProducts: recommendedProductsField,
    recommendedApproach: field<string>(parsed.recommendedApproach, '', str),
    confidence: clamp(isNum(parsed.confidence) ? parsed.confidence : 0, 0, 100),
    sources: Array.isArray(parsed.sources) ? parsed.sources.filter((s: any) => isObj(s) && isStr(s.url) && isStr(s.title)) : [],
  };
}

// ========================================================================
// 2. Lead Qualification (intent + aiScore)
// ========================================================================
export function parseQualification(content: string, ruleScore: number): { intent: AIPurchaseIntent; aiScore: AILeadScore } {
  const parsed = safeJSON(content);
  if (!isObj(parsed)) throw new AIError('INVALID_JSON', 'AI qualification output is not an object');
  const iRaw = parsed.intent || {};
  const aRaw = parsed.aiScore || {};

  const iScore = clamp(isNum(iRaw.score) ? iRaw.score : 0, 0, 100);
  const iGrade: any = (['HIGH','MEDIUM','LOW','UNKNOWN'].includes(iRaw.grade) ? iRaw.grade : 'UNKNOWN');
  const reasons = isStrArr(iRaw.reasons) ? iRaw.reasons : [];
  const risks = isStrArr(iRaw.risks) ? iRaw.risks : [];

  const aiScore = clamp(isNum(aRaw.aiScore) ? aRaw.aiScore : 0, 0, 100);
  const aiReasons = isStrArr(aRaw.reasons) ? aRaw.reasons : [];
  const completeness = clamp(isNum(aRaw.dataCompleteness) ? aRaw.dataCompleteness : 0, 0, 100);

  const finalScore = clamp(Math.round(ruleScore * 0.4 + aiScore * 0.3 + iScore * 0.2 + completeness * 0.1), 0, 100);

  return {
    intent: { score: iScore, grade: iGrade, reasons, risks },
    aiScore: {
      ruleScore,
      aiScore,
      purchaseIntent: iScore,
      dataCompleteness: completeness,
      finalScore,
      reasons: [`Rule score ${ruleScore}/100`, `AI score ${aiScore}/100`, `Purchase intent ${iScore}/100 [${iGrade}]`, `Data completeness ${completeness}%`],
      risks,
      aiScoreReasons: aiReasons,
    },
  };
}

// ========================================================================
// 3. Product Match
// ========================================================================
export function parseProductMatches(content: string, catalogIds: string[]): AIProductMatch[] {
  const parsed = safeJSON(content);
  if (!Array.isArray(parsed)) throw new AIError('INVALID_JSON', 'AI product match output is not an array');
  const out: AIProductMatch[] = [];
  for (const item of parsed) {
    if (!isObj(item)) continue;
    const pid = String(item.productId || '');
    if (!catalogIds.includes(pid)) continue;   // §10 防 AI 编造 productId
    const conf: any = VALID_CONF.has(item.confidence) ? item.confidence : 'INFERRED';
    out.push({
      productId: pid,
      matchScore: clamp(isNum(item.matchScore) ? item.matchScore : 0, 0, 100),
      reason: isStr(item.reason) ? item.reason : '',
      confidence: conf,
    });
  }
  return out;
}

// ========================================================================
// 4. Development Strategy
// ========================================================================
export function parseStrategy(content: string, catalog: string[]): AIDevelopmentStrategy {
  const parsed = safeJSON(content);
  if (!isObj(parsed)) throw new AIError('INVALID_JSON', 'AI strategy output is not an object');
  const str = (v: any) => isStr(v);
  const strArr = (v: any) => isStrArr(v);

  const potentialProducts = field<string[]>(parsed.potentialProducts, [], strArr);
  if (potentialProducts.value.length) {
    const valid = potentialProducts.value.filter((n) => catalog.includes(n));
    if (valid.length !== potentialProducts.value.length) {
      potentialProducts.value = valid;
      potentialProducts.confidence = 'UNKNOWN';
      potentialProducts.reason = (potentialProducts.reason || '') + ' [stripped fabricated product names]';
    }
  }

  return {
    targetPersona: field<string>(parsed.targetPersona, '', str),
    painPoints: field<string[]>(parsed.painPoints, [], strArr),
    potentialProducts,
    recommendedValueProposition: field<string>(parsed.recommendedValueProposition, '', str),
    recommendedChannel: field<string>(parsed.recommendedChannel, '', str),
    recommendedTiming: field<string>(parsed.recommendedTiming, '', str),
    followUpStrategy: field<string>(parsed.followUpStrategy, '', str),
    confidence: clamp(isNum(parsed.confidence) ? parsed.confidence : 0, 0, 100),
    sources: Array.isArray(parsed.sources) ? parsed.sources.filter((s: any) => isObj(s) && isStr(s.url) && isStr(s.title)) : [],
  };
}

// ========================================================================
// 5. Message Draft
// ========================================================================
export function parseMessageDraft(content: string): AIMessageDraftResult {
  const parsed = safeJSON(content);
  if (!isObj(parsed)) throw new AIError('INVALID_JSON', 'AI message draft output is not an object');
  return {
    subject: isStr(parsed.subject) ? parsed.subject : '',
    content: isStr(parsed.content) ? parsed.content : '',
    personalization: isStrArr(parsed.personalization) ? parsed.personalization : [],
    reason: isStr(parsed.reason) ? parsed.reason : '',
    language: 'en',
    channel: 'EMAIL',
    purpose: 'FIRST_CONTACT',
  };
}

// ========================================================================
// helpers
// ========================================================================
function safeJSON(content: string): any {
  if (!content) throw new AIError('INVALID_JSON', 'AI returned empty content');
  const trimmed = content.trim();
  // OpenAI JSON mode guarantees valid JSON; Mock uses JSON.stringify.
  // 防御：从 markdown ```json fence 里抠出来
  let text = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch (e: any) {
    throw new AIError('INVALID_JSON', `AI returned invalid JSON: ${e?.message || ''}`);
  }
}

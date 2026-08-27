/**
 * PHASE 2-C §38 MockAIProvider 专用业务引擎
 *
 * Mock 必须产出"结构化 + 非伪造"的结果：
 *   - 只根据输入 Lead 快照 + Product 目录 + 历史数据推导
 *   - 输入里没有的事实 → confidence='UNKNOWN' + reason
 *   - 输入里能合理推断的 → confidence='INFERRED' + reason
 *   - 输入里明确存在的 → confidence='CONFIRMED'
 *   - sources 永远为 []（不联网，前端显示 No external source available.）
 *
 * 这样 Mock 路径既能跑通业务流程，又能在前端验证"未知字段必须显示 UNKNOWN"。
 *
 * OpenAIProvider 走 ai/prompts.ts + provider.complete() + schemas 校验的通用路径；
 * Mock 则直接复用本文件函数 → 性能高、确定性强、易测试。
 */
import { env } from '../config/env';
import {
  AIResearchResult, AIPurchaseIntent, AILeadScore, AIProductMatch,
  AIDevelopmentStrategy, AIMessageDraftResult,
  AISanitizedLead, AIProductSnippet, AIField,
  CONFIDENCE_LEVELS,
} from '../types/ai';

// ---------- 工具：构造 AIField ----------
function confirmed<T>(value: T, reason?: string): AIField<T> {
  return { value, confidence: 'CONFIRMED', reason };
}
function inferred<T>(value: T, reason: string): AIField<T> {
  return { value, confidence: 'INFERRED', reason };
}
function unknown<T>(reason: string, placeholder: T): AIField<T> {
  return { value: placeholder, confidence: 'UNKNOWN', reason };
}

// ---------- 工具：产品匹配（基于 Lead industry / companyType） ----------
function inferRecommendedCategories(lead: AISanitizedLead): string[] {
  const ind = (lead.industry || '').toLowerCase();
  const ct = (lead.companyType || '').toLowerCase();
  const cats: string[] = [];
  if (ind.includes('hotel') || ct.includes('hotel') || ind.includes('hospitality')) {
    cats.push('hotel-ware', 'tableware', 'vase');
  }
  if (ind.includes('restaurant') || ct.includes('restaurant') || ind.includes('cafe')) {
    cats.push('tableware', 'vase');
  }
  if (ind.includes('tea')) cats.push('tableware');
  if (ind.includes('coffee')) cats.push('tableware', 'vase');
  if (ind.includes('decor') || ind.includes('interior')) cats.push('vase', 'art-sculpture');
  if (ind.includes('gift')) cats.push('vase', 'art-sculpture');
  if (lead.productInterest && lead.productInterest.length) {
    // 优先尊重客户已声明的兴趣
    const map: Record<string, string> = {
      'Tableware': 'tableware', 'Dinnerware': 'tableware', 'Tea Set': 'tableware',
      'Coffee Set': 'tableware', 'Hotelware': 'hotel-ware', 'Home Decor': 'vase',
      'Vases': 'vase', 'Giftware': 'vase', 'Art Ceramics': 'art-sculpture',
      'Custom Ceramics': 'oem-sample', 'OEM': 'oem-sample', 'ODM': 'oem-sample',
    };
    for (const p of lead.productInterest) {
      const c = map[p];
      if (c && !cats.includes(c)) cats.push(c);
    }
  }
  return Array.from(new Set(cats));
}

// ========================================================================
// 1. 研究结果（§5-6）
// ========================================================================
export function mockResearch(lead: AISanitizedLead, products: AIProductSnippet[]): AIResearchResult {
  const recCats = inferRecommendedCategories(lead);
  const matchedProducts = products
    .filter((p) => recCats.includes(p.category))
    .slice(0, 5)
    .map((p) => p.nameEn);

  const companySummary = lead.companyName
    ? confirmed(`Lead record exists for "${lead.companyName}" (source: ${lead.source || 'manual'}).`)
    : unknown('Lead record does not contain a confirmed company name.', '');

  const businessModel = (lead.companyType && lead.companyType !== 'other')
    ? inferred(`${lead.companyType} business model inferred from Lead metadata`,
        'companyType field is provided in Lead data')
    : unknown('companyType not specified in Lead data', '');

  const industry = (lead.industry && lead.industry !== 'other')
    ? confirmed(lead.industry, 'industry field present in Lead')
    : unknown('industry not specified in Lead', '');

  const companyType = (lead.companyType && lead.companyType !== 'other')
    ? confirmed(lead.companyType, 'companyType field present in Lead')
    : unknown('companyType not specified in Lead', '');

  const marketPosition = unknown('Cannot confirm market position without external research', '');

  const targetCustomers = (lead.companyType && lead.companyType !== 'other')
    ? inferred([`Inferred from companyType=${lead.companyType}`],
        'business segment inferred from existing Lead metadata')
    : unknown('companyType unknown — cannot infer target customer segment', []);

  const productCategories = recCats.length
    ? inferred(recCats, 'Inferred from industry / companyType / declared productInterest')
    : unknown('No industry or productInterest — cannot infer ceramic categories', []);

  const potentialNeeds: string[] = [];
  if (recCats.length) {
    potentialNeeds.push(`Likely demand for ${recCats.join(', ')} based on industry signal`);
  }
  if (lead.history.inquiryCount > 0) potentialNeeds.push(`${lead.history.inquiryCount} prior inquiry on record`);

  const possibleCeramicDemand = potentialNeeds.length
    ? inferred(potentialNeeds.join('; '), 'Based on industry + declared interest + history')
    : unknown('No industry signal or history — purchase volume unknown', '');

  const purchaseSignals: string[] = [];
  if (lead.history.inquiryCount > 0) purchaseSignals.push(`${lead.history.inquiryCount} prior inquiries`);
  if (lead.history.orderCount > 0) purchaseSignals.push(`${lead.history.orderCount} prior orders`);
  if ((lead.productInterest || []).length) purchaseSignals.push(`Declared interest: ${lead.productInterest.join(', ')}`);

  const riskSignals: string[] = [];
  if (!lead.website) riskSignals.push('No website on record — cannot verify business online');
  if (!lead.contactName) riskSignals.push('No contact person confirmed');
  if (!lead.hasEmail && !lead.hasPhone && !lead.hasWhatsapp) riskSignals.push('No verified contact channel');
  if (lead.history.inquiryCount === 0) riskSignals.push('No prior inquiry → procurement intent unproven');

  const recommendedProducts = matchedProducts.length
    ? inferred(matchedProducts, 'Matched against Product catalog by industry/category')
    : unknown('No matching products in catalog (catalog may be empty)', []);

  const recommendedApproach = recCats.length
    ? inferred(`Send ${recCats.join('/')} catalog samples + request product specs / MOQ`,
        'Inferred from inferred product categories')
    : unknown('Need more company info to recommend approach', '');

  // 整体置信度：基于已知字段的简单加权
  const knownFields = [lead.companyName, lead.website, lead.country, lead.city, lead.industry, lead.companyType]
    .filter((f) => f && String(f) !== 'other').length;
  const completeness = Math.round((knownFields / 6) * 60);
  const historyBoost = Math.min(20, (lead.history.inquiryCount + lead.history.orderCount) * 5);
  const channelBoost = [lead.hasEmail, lead.hasPhone, lead.hasWhatsapp, lead.hasLinkedIn].filter(Boolean).length * 5;
  const confidence = Math.max(0, Math.min(100, completeness + historyBoost + channelBoost));

  return {
    companySummary,
    businessModel,
    industry,
    companyType,
    marketPosition,
    targetCustomers,
    productCategories,
    potentialNeeds: potentialNeeds.length
      ? inferred(potentialNeeds, 'Based on industry + declared interest + history')
      : unknown('No industry signal or history — purchase needs unknown', []),
    possibleCeramicDemand,
    purchaseSignals: purchaseSignals.length
      ? inferred(purchaseSignals, 'Based on Lead history + declared interest')
      : unknown('No procurement signals in Lead data', []),
    riskSignals: riskSignals.length
      ? inferred(riskSignals, 'Based on data gaps in Lead record')
      : unknown('No risk signals derivable — data completeness low', []),
    recommendedProducts,
    recommendedApproach,
    confidence,
    sources: [],   // §15 Mock 不联网
  };
}

// ========================================================================
// 2. 采购意向（§7）
// ========================================================================
export function mockPurchaseIntent(lead: AISanitizedLead): AIPurchaseIntent {
  let score = 0;
  const reasons: string[] = [];
  const risks: string[] = [];

  if (lead.history.orderCount > 0) { score += 40; reasons.push(`${lead.history.orderCount} prior orders`); }
  if (lead.history.inquiryCount > 0) { score += 25; reasons.push(`${lead.history.inquiryCount} prior inquiries`); }
  if ((lead.productInterest || []).length) {
    score += 20;
    reasons.push(`Declared product interest: ${lead.productInterest.join(', ')}`);
  }
  const recCats = inferRecommendedCategories(lead);
  if (recCats.length) {
    score += 10;
    reasons.push(`Industry signal matches ceramic categories: ${recCats.join(', ')}`);
  }
  if (lead.history.interactionCount > 0) {
    score += 5;
    reasons.push(`${lead.history.interactionCount} prior interactions`);
  }

  if (!lead.website) risks.push('No website — business unverified');
  if (!lead.contactName) risks.push('No decision-maker confirmed');
  if (lead.history.inquiryCount === 0 && lead.history.orderCount === 0) {
    risks.push('No procurement track record on file');
  }
  if (!lead.hasEmail && !lead.hasPhone && !lead.hasWhatsapp) {
    risks.push('No contactable channel');
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score === 0
    ? 'UNKNOWN'
    : score >= 70 ? 'HIGH'
      : score >= 40 ? 'MEDIUM'
        : 'LOW';
  return { score, grade, reasons, risks };
}

// ========================================================================
// 3. AI 评分（§8）—— 综合规则分 + AI 分 + 意向 + 完整度
// ========================================================================
export function mockLeadScore(
  lead: AISanitizedLead,
  ruleScore: number,
  intent: AIPurchaseIntent,
): AILeadScore {
  // AI Score: 基于 mockResearch 的 confidence + 历史信号
  const knownFields = [lead.companyName, lead.website, lead.country, lead.city, lead.industry, lead.companyType]
    .filter((f) => f && String(f) !== 'other').length;
  const completeness = Math.round((knownFields / 6) * 100);
  const historyBoost = Math.min(30, (lead.history.inquiryCount * 8) + (lead.history.orderCount * 12));
  const channelBoost = [lead.hasEmail, lead.hasPhone, lead.hasWhatsapp, lead.hasLinkedIn].filter(Boolean).length * 5;
  const aiScore = Math.max(0, Math.min(100, Math.round(completeness * 0.4 + historyBoost * 0.5 + channelBoost)));

  // Final Score = 0.4 rule + 0.3 ai + 0.2 intent + 0.1 completeness（任意权重，集中配置）
  const finalScore = Math.round(ruleScore * 0.4 + aiScore * 0.3 + intent.score * 0.2 + completeness * 0.1);

  const reasons: string[] = [
    `Rule score ${ruleScore}/100 (industry + type + country + contact)`,
    `AI score ${aiScore}/100 (data confidence + history signals)`,
    `Purchase intent ${intent.score}/100 [${intent.grade}]`,
    `Data completeness ${completeness}%`,
  ];
  const risks: string[] = [];
  if (!lead.website) risks.push('No website → unverified business');
  if (!lead.contactName) risks.push('Decision maker not confirmed');
  if (intent.grade === 'UNKNOWN') risks.push('Procurement volume unknown');
  if (lead.history.inquiryCount === 0) risks.push('No prior inquiry → purchase intent unproven');

  return {
    ruleScore,
    aiScore,
    purchaseIntent: intent.score,
    dataCompleteness: completeness,
    finalScore: Math.max(0, Math.min(100, finalScore)),
    reasons,
    risks,
    aiScoreReasons: [`AI confidence ${completeness}%`, `History boost ${historyBoost}`, `Channel score ${channelBoost}`],
  };
}

// ========================================================================
// 4. 产品匹配（§10-11）
// ========================================================================
export function mockProductMatch(
  lead: AISanitizedLead,
  products: AIProductSnippet[],
): AIProductMatch[] {
  const recCats = inferRecommendedCategories(lead);
  const out: AIProductMatch[] = [];
  for (const p of products) {
    let score = 0;
    let reason = '';
    let confidence: 'CONFIRMED' | 'INFERRED' | 'UNKNOWN' = 'INFERRED';
    if (recCats.includes(p.category)) {
      score = 75;
      reason = `Product category ${p.category} matches inferred demand from industry/companyType`;
      // 如果 Lead 显式声明了这个兴趣 → 升级为 CONFIRMED
      const map: Record<string, string> = {
        'tableware': 'Tableware,Dinnerware,Tea Set,Coffee Set',
        'hotel-ware': 'Hotelware',
        'vase': 'Vases,Home Decor,Giftware',
        'art-sculpture': 'Art Ceramics,Giftware',
        'oem-sample': 'Custom Ceramics,OEM,ODM',
      };
      const declared = (map[p.category] || '').split(',');
      if ((lead.productInterest || []).some((pi) => declared.includes(pi))) {
        score = 95;
        reason = `Lead explicitly declared interest in ${declared.join(', ')}`;
        confidence = 'CONFIRMED';
      }
    } else {
      score = 25;
      reason = `Category ${p.category} not directly matched to Lead signals`;
      confidence = 'INFERRED';
    }
    out.push({
      productId: String(p._id),
      matchScore: score,
      reason,
      confidence,
    });
  }
  return out.slice(0, 10);
}

// ========================================================================
// 5. 开发策略（§21）
// ========================================================================
export function mockStrategy(lead: AISanitizedLead, products: AIProductSnippet[]): AIDevelopmentStrategy {
  const recCats = inferRecommendedCategories(lead);
  const matched = products
    .filter((p) => recCats.includes(p.category))
    .slice(0, 5)
    .map((p) => p.nameEn);

  const persona = lead.companyType && lead.companyType !== 'other'
    ? inferred(`${lead.companyType} in ${lead.country || 'unknown market'}`,
        'Inferred from Lead metadata')
    : unknown('companyType not specified', '');

  const painPoints: string[] = [];
  if (!lead.website) painPoints.push('Limited online presence — hard to evaluate supplier credibility');
  if (!lead.hasWhatsapp && !lead.hasEmail) painPoints.push('No clear contact channel');
  painPoints.push('Likely comparing multiple ceramic suppliers on quality / lead time / MOQ');

  const channel = lead.hasLinkedIn
    ? confirmed('LinkedIn (Lead has LinkedIn on record)')
    : lead.hasEmail
      ? confirmed('Email (Lead has email on record)')
      : unknown('No preferred channel in Lead data', '');

  const timing = (lead.history.inquiryCount > 0 || lead.productInterest?.length)
    ? inferred('Reach within 7 days — Lead shows active procurement signals',
        'Based on inquiry history / declared interest')
    : unknown('No procurement signal — timing uncertain', '');

  return {
    targetPersona: persona,
    painPoints: inferred(painPoints, 'Inferred from Lead data gaps and B2B procurement norms'),
    potentialProducts: matched.length
      ? inferred(matched, 'Matched against Product catalog by industry/category')
      : unknown('No matching products in catalog', []),
    recommendedValueProposition: recCats.length
      ? inferred(`Highlight Jingdezhen craftsmanship in ${recCats.join(', ')}; offer samples + MOQ flexibility`,
          'Inferred from product fit + Jingdezhen brand positioning')
      : unknown('Need product fit clarity to recommend value prop', ''),
    recommendedChannel: channel,
    recommendedTiming: timing,
    followUpStrategy: inferred(
      'Day 0: first contact (email/LinkedIn); Day 3: follow-up with samples; Day 7: WhatsApp ping; Day 14: value recap',
      'Standard B2B ceramic procurement follow-up cadence',
    ),
    confidence: 60,
    sources: [],
  };
}

// ========================================================================
// 6. 话术草稿（§22-25）
// ========================================================================
export function mockMessageDraft(
  lead: AISanitizedLead,
  products: AIProductSnippet[],
  opts: { language: 'en' | 'ar' | 'zh'; channel: 'EMAIL' | 'WHATSAPP' | 'LINKEDIN' | 'OTHER'; purpose: 'FIRST_CONTACT' | 'FOLLOW_UP' | 'INQUIRY_FOLLOW_UP' | 'QUOTE_FOLLOW_UP' | 'REACTIVATION' },
): AIMessageDraftResult {
  const recCats = inferRecommendedCategories(lead);
  const matched = products.filter((p) => recCats.includes(p.category)).slice(0, 3).map((p) => p.nameEn);
  const productLine = matched.length ? matched.join(', ') : 'Jingdezhen ceramic tableware & hotelware';
  const contactName = lead.contactName || 'there';
  const country = lead.country || 'your market';
  const salesName = 'LuxeCeramics Sales Team';

  const personalization = ['{{firstName}}', '{{companyName}}', '{{country}}', '{{productName}}', '{{salesName}}'];

  let subject = '';
  let content = '';
  let reason = '';

  const isArabic = lead.country === 'AE' || lead.country === 'SA' || lead.country === 'QA' || lead.country === 'KW' || lead.country === 'OM' || lead.country === 'BH';
  const targetLang = opts.language; // 优先尊重调用方选择
  const useArabic = targetLang === 'ar' || (targetLang !== 'en' && targetLang !== 'zh' && isArabic);

  if (opts.channel === 'EMAIL') {
    subject = targetLang === 'ar'
      ? `عرض تعاون: ${productLine} من Jingdezhen لـ ${lead.companyName || 'شركتكم'}`
      : targetLang === 'zh'
        ? `合作提案 — 来自景德镇的 ${productLine} | ${lead.companyName || '贵公司'}`
        : `Partnership Proposal — ${productLine} from Jingdezhen for ${lead.companyName || 'your company'}`;
    content = targetLang === 'ar'
      ? `مرحباً ${contactName}،\n\nنحن LuxeCeramics — من Jingdezhen، عاصمة البورسلين الصينية. نود استكشاف فرص تعاون مع ${lead.companyName || 'شركتكم'} في ${country}.\n\nمنتجاتنا: ${productLine}.\n\nهل يمكننا ترتيب مكالمة قصيرة الأسبوع القادم؟\n\nمع خالص التحية،\n${salesName}`
      : targetLang === 'zh'
        ? `您好 ${contactName}，\n\n我们是 LuxeCeramics，来自中国瓷都景德镇。希望与${lead.companyName || '贵公司'}探讨在${country}的合作机会。\n\n核心产品：${productLine}。\n\n请问下周能否安排一次简短电话？\n\n顺颂商祺，\n${salesName}`
        : `Dear ${contactName},\n\nWe are LuxeCeramics, based in Jingdezhen — the porcelain capital of China. We would like to explore a partnership with ${lead.companyName || 'your company'} in ${country}.\n\nOur key products: ${productLine}.\n\nCould we schedule a brief call next week?\n\nBest regards,\n${salesName}`;
    reason = `B2B first-contact email: lead from ${lead.source || 'manual'}, industry=${lead.industry || 'unknown'}, recommended products matched from catalog.`;
  } else if (opts.channel === 'WHATSAPP') {
    content = targetLang === 'ar'
      ? `مرحباً ${contactName} 👋 — LuxeCeramics من Jingdezhen. نرسل لكم ${productLine}. هل يمكن المشاركة عبر البريد؟`
      : targetLang === 'zh'
        ? `${contactName}您好 — 我是 LuxeCeramics（景德镇）。我们主打${productLine}，能否发您邮箱详情？`
        : `Hi ${contactName} — LuxeCeramics from Jingdezhen here. We offer ${productLine}. May I send details to your email?`;
    subject = '';
    reason = 'WhatsApp short intro: under 300 chars, friendly tone, asks for permission to send email (anti-spam).';
  } else if (opts.channel === 'LINKEDIN') {
    subject = targetLang === 'en'
      ? `Connection request — ${productLine} supplier for ${lead.companyName || 'your business'}`
      : `${productLine} 供应商 — 期待与${lead.companyName || '您'}连接`;
    content = targetLang === 'en'
      ? `Hi ${contactName}, I lead partnerships at LuxeCeramics (Jingdezhen, China). We supply ${productLine} to ${country} buyers. I'd love to connect and share how our craftsmanship could fit your sourcing needs.`
      : `${contactName}您好，我是 LuxeCeramics（中国景德镇）的合作伙伴负责人，向${country}买家供应${productLine}。期待与您连接，分享我们的工艺如何契合您的采购需求。`;
    reason = 'LinkedIn-style connection note: 250-char limit, professional, reference product + market.';
  } else {
    content = `Hello ${contactName}, LuxeCeramics from Jingdezhen — ${productLine}.`;
    subject = '';
    reason = 'Fallback channel.';
  }

  // Follow-up variants
  if (opts.purpose === 'FOLLOW_UP') {
    content = targetLang === 'en'
      ? `Hi ${contactName}, just following up on my earlier note about ${productLine}. Happy to send samples or a quote — what would help most?`
      : `${contactName}您好，跟进上次关于${productLine}的邮件。需要样品或报价请告诉我。`;
    subject = targetLang === 'en' ? `Following up — ${productLine}` : `跟进 — ${productLine}`;
  } else if (opts.purpose === 'INQUIRY_FOLLOW_UP') {
    content = targetLang === 'en'
      ? `Dear ${contactName}, thanks for your inquiry about ${productLine}. Here are the requested specs + MOQ. Shall we proceed?`
      : `${contactName}您好，感谢您对${productLine}的询盘。附上规格和起订量，请确认是否进入报价阶段。`;
  } else if (opts.purpose === 'QUOTE_FOLLOW_UP') {
    content = targetLang === 'en'
      ? `Hi ${contactName}, following up on our quotation for ${productLine}. Any questions? Happy to adjust terms.`
      : `${contactName}您好，关于${productLine}的报价如有疑问请告知，我们可调整条款。`;
  } else if (opts.purpose === 'REACTIVATION') {
    content = targetLang === 'en'
      ? `Hi ${contactName}, it's been a while. We have new ${productLine} releases — would a quick update be useful?`
      : `${contactName}您好，久未联系。我们新增了${productLine}，需要更新信息请告知。`;
  }

  // 模型 token 估算
  const tokens = Math.ceil((subject.length + content.length) / 4);

  return {
    subject,
    content,
    personalization,
    reason,
    language: opts.language as any,
    channel: opts.channel,
    purpose: opts.purpose,
  };
}

/** 占位：仅供满足未使用的 import */
export const _mockEngineEnv = env;
void CONFIDENCE_LEVELS;

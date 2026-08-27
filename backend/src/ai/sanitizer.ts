/**
 * PHASE 2-C §16-18 数据最小化 + 隐私
 *
 * 把 Lead 完整数据脱敏成 AISanitizedLead：
 *   - 私人 email / phone / whatsapp / linkedin URL → 只发 hasXxx: boolean
 *   - notes / private remarks → 不发送
 *   - 历史统计 → 仅 count + lastInteractionAt（不含内容）
 *
 * 同步生成 AISourceRef，标记数据来源为 'lead_input'。
 */
import { Types } from 'mongoose';
import Lead, { ILead } from '../models/Lead';
import Inquiry from '../models/Inquiry';
import Quote from '../models/Quote';
import Order from '../models/Order';
import Interaction from '../models/Interaction';
import { AISanitizedLead, AISourceRef } from '../types/ai';

export async function sanitizeLeadForAI(leadId: string | Types.ObjectId): Promise<{ lead: AISanitizedLead | null; sources: AISourceRef[] }> {
  const lead = await Lead.findById(leadId).lean();
  if (!lead) return { lead: null, sources: [] };

  // 历史：仅统计数量 + lastInteractionAt
  const [inquiryCount, quoteCount, orderCount, interactionCount, lastInter] = await Promise.all([
    Inquiry.countDocuments({ leadId: lead._id }).catch(() => 0),
    Quote.countDocuments({ leadId: lead._id }).catch(() => 0),
    Order.countDocuments({ leadId: lead._id }).catch(() => 0),
    Interaction.countDocuments({ leadId: lead._id }).catch(() => 0),
    Interaction.findOne({ leadId: lead._id }).sort({ createdAt: -1 }).select('createdAt').lean().catch(() => null),
  ]);

  const sanitized: AISanitizedLead = {
    _id: String(lead._id),
    companyName: lead.companyName || '',
    website: lead.website || '',
    country: lead.country || '',
    city: lead.city || '',
    industry: lead.industry || '',
    companyType: lead.companyType || '',
    productInterest: Array.isArray(lead.productInterest) ? lead.productInterest : [],
    source: lead.source as any,
    sourceUrl: lead.sourceUrl || '',
    // notes 不发送（§18 隐私）
    notes: '',
    contactName: lead.contactName || '',
    jobTitle: lead.jobTitle || '',
    // 私人联系方式只发布尔值
    hasEmail: !!lead.email,
    hasPhone: !!lead.phone,
    hasWhatsapp: !!lead.whatsapp,
    hasLinkedIn: !!lead.linkedin,
    history: {
      inquiryCount,
      quoteCount,
      orderCount,
      interactionCount,
      lastInteractionAt: lastInter?.createdAt || undefined,
    },
  };

  const sources: AISourceRef[] = [
    {
      url: lead.sourceUrl || `/console/leads/${lead._id}`,
      title: `Lead record (${lead.companyName || lead._id})`,
      sourceType: 'lead_input',
    },
  ];

  return { lead: sanitized, sources };
}

/** 把 Lead 完整信息提供给 AI 前的可记录日志（§18 数据最小化审计） */
export function logAIDataProcessing(leadId: string, fieldsSent: string[]): { leadId: string; fieldsSent: string[]; redacted: string[] } {
  return {
    leadId,
    fieldsSent,
    redacted: ['email', 'phone', 'whatsapp', 'linkedin', 'instagram', 'facebook', 'xHandle', 'tiktok', 'notes'],
  };
}

export interface ILeadDoc extends ILead {}

/**
 * PHASE 2-C §22 AIMessageDraft — 话术草稿
 * 一次 AI 生成写一条；§27 人工 Edit/Approve/Reject 状态机。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { AI_MESSAGE_CHANNELS, AI_LANGUAGES, MESSAGE_PURPOSES, AI_DRAFT_STATUSES } from '../types/ai';

export interface IAIMessageDraft extends Document {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  jobId?: Types.ObjectId;
  language: 'en' | 'ar' | 'zh';
  channel: 'EMAIL' | 'WHATSAPP' | 'LINKEDIN' | 'OTHER';
  purpose: 'FIRST_CONTACT' | 'FOLLOW_UP' | 'INQUIRY_FOLLOW_UP' | 'QUOTE_FOLLOW_UP' | 'REACTIVATION';
  subject: string;
  content: string;
  personalization: string[];
  reason: string;
  status: 'DRAFT' | 'EDITED' | 'APPROVED' | 'REJECTED' | 'SENT';
  aiSnapshot?: any;            // §28 原始 AI 内容（不覆盖）
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AIMessageDraftSchema = new Schema<IAIMessageDraft>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'AIResearchJob', index: true },
    language: { type: String, enum: AI_LANGUAGES, default: 'en', index: true },
    channel: { type: String, enum: AI_MESSAGE_CHANNELS, default: 'EMAIL', index: true },
    purpose: { type: String, enum: MESSAGE_PURPOSES, default: 'FIRST_CONTACT' },
    subject: { type: String, default: '' },
    content: { type: String, default: '' },
    personalization: { type: [String], default: [] },
    reason: { type: String, default: '' },
    status: { type: String, enum: AI_DRAFT_STATUSES, default: 'DRAFT', index: true },
    aiSnapshot: { type: Schema.Types.Mixed, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

AIMessageDraftSchema.index({ leadId: 1, createdAt: -1 });
AIMessageDraftSchema.index({ status: 1, createdAt: -1 });

export const AIMessageDraft = model<IAIMessageDraft>('AIMessageDraft', AIMessageDraftSchema);
export default AIMessageDraft;

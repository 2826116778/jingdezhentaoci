/**
 * Lead Model — 潜在海外客户（CRM Pipeline 入口）。
 * Convert → Customer 时：this.status = 'CONVERTED'，并写入 customerId。
 * 数据不删除 Customer/Company；保持 Lead 记录可追溯。
 */
import { Schema, model, Document, Types } from 'mongoose';
import {
  LEAD_STATUSES, LEAD_GRADES, LEAD_SOURCES,
  COMPANY_TYPES, INDUSTRIES, LeadStatus, LeadGrade, LeadSource,
  RESEARCH_TYPES, ResearchType,
} from '../types/crm';

export interface ILead extends Document {
  _id: Types.ObjectId;

  // 公司
  companyName: string;
  website: string;
  country: string;
  city: string;
  industry: string;
  companyType: string;

  // 人
  contactName: string;
  jobTitle: string;
  email: string;
  phone: string;
  whatsapp: string;
  linkedin: string;

  // 社交（PHASE 2-B 新增）
  instagram: string;
  facebook: string;
  xHandle: string;
  tiktok: string;

  // 来源
  source: LeadSource;
  sourceUrl: string;

  // 意向
  productInterest: string[];
  purchaseIntent: 'none' | 'low' | 'medium' | 'high';
  estimatedPurchaseVolume: string;

  // 评分/分级
  score: number;   // 0–100
  grade: LeadGrade; // A/B/C/D
  scoreReasons: string[]; // PHASE 2-B：评分原因列表

  status: LeadStatus;

  ownerId?: Types.ObjectId;

  // 关联 Customer（如果 Convert 成功）
  customerId?: Types.ObjectId;
  companyId?: Types.ObjectId;

  // PHASE 2-B 新增：追溯
  importId?: Types.ObjectId;     // 来自哪次 LeadImport
  campaignId?: Types.ObjectId;   // 来自哪个 Campaign
  researchType?: ResearchType;   // MANUAL_RESEARCH / IMPORTED_DATA / AI_RESEARCH
  researchNotes?: string;       // 研究备注

  tags: string[];
  notes: string;

  lastContactAt?: Date;
  nextFollowUpAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    companyName: { type: String, required: true, index: true },
    website:     { type: String, default: '' },
    country:     { type: String, default: '', index: true },
    city:        { type: String, default: '' },
    industry:    { type: String, default: 'other', index: true },
    companyType: { type: String, default: 'other', index: true },

    contactName: { type: String, default: '' },
    jobTitle:    { type: String, default: '' },
    email:       { type: String, default: '' },
    phone:       { type: String, default: '' },
    whatsapp:    { type: String, default: '' },
    linkedin:    { type: String, default: '' },

    // PHASE 2-B 新增社交
    instagram:   { type: String, default: '' },
    facebook:    { type: String, default: '' },
    xHandle:     { type: String, default: '' },
    tiktok:      { type: String, default: '' },

    source:    { type: String, default: 'manual', index: true },
    sourceUrl: { type: String, default: '' },

    productInterest:          { type: [String], default: [] },
    purchaseIntent:           { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },
    estimatedPurchaseVolume:  { type: String, default: '' },

    score: { type: Number, min: 0, max: 100, default: 0, index: true },
    grade: { type: String, enum: LEAD_GRADES, default: 'C', index: true },
    scoreReasons: { type: [String], default: [] },

    status: { type: String, enum: LEAD_STATUSES, default: 'NEW', index: true },

    ownerId:    { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true, unique: false },
    companyId:  { type: Schema.Types.ObjectId, ref: 'Company',  index: true },

    // PHASE 2-B 追溯
    importId:     { type: Schema.Types.ObjectId, ref: 'LeadImport', index: true },
    campaignId:   { type: Schema.Types.ObjectId, ref: 'LeadCampaign', index: true },
    researchType: { type: String, enum: RESEARCH_TYPES, default: 'IMPORTED_DATA' },
    researchNotes:{ type: String, default: '' },

    tags:  { type: [String], default: [] },
    notes: { type: String, default: '' },

    lastContactAt:   { type: Date, index: true },
    nextFollowUpAt:  { type: Date, index: true },
  },
  { timestamps: true },
);

// Pipeline 查询最常见的索引
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ status: 1, grade: 1, score: -1 });
LeadSchema.index({ country: 1, status: 1 });
LeadSchema.index({ source: 1, status: 1 });
LeadSchema.index({ ownerId: 1, status: 1, nextFollowUpAt: 1 });
LeadSchema.index({ createdAt: -1 });
// 全文搜索关键词（name/company/email/whatsapp）复合简单索引；真实 search 用 $regex i
LeadSchema.index({ contactName: 1, email: 1, whatsapp: 1 });
// PHASE 2-B 追溯索引
LeadSchema.index({ importId: 1, status: 1 });
LeadSchema.index({ campaignId: 1, status: 1 });
// PHASE 2-B 去重：website + email + phone
LeadSchema.index({ website: 1, country: 1 });
LeadSchema.index({ email: 1 });
LeadSchema.index({ phone: 1 });

export const Lead = model<ILead>('Lead', LeadSchema);
export default Lead;

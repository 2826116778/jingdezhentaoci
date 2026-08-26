/**
 * Lead Model — 潜在海外客户（CRM Pipeline 入口）。
 * Convert → Customer 时：this.status = 'CONVERTED'，并写入 customerId。
 * 数据不删除 Customer/Company；保持 Lead 记录可追溯。
 */
import { Schema, model, Document, Types } from 'mongoose';
import {
  LEAD_STATUSES, LEAD_GRADES, LEAD_SOURCES,
  COMPANY_TYPES, INDUSTRIES, LeadStatus, LeadGrade, LeadSource,
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

  // 来源
  source: LeadSource;
  sourceUrl: string;

  // 意向
  productInterest: string[];
  purchaseIntent: 'none' | 'low' | 'medium' | 'high';
  estimatedPurchaseVolume: string;

  // 评分/分级
  score: number;   // 0–100，可由业务或 Phase 2 AI 计算
  grade: LeadGrade; // A/B/C/D

  status: LeadStatus;

  ownerId?: Types.ObjectId;

  // 关联 Customer（如果 Convert 成功）
  customerId?: Types.ObjectId;
  companyId?: Types.ObjectId;

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
    industry:    { type: String, enum: INDUSTRIES, default: 'other', index: true },
    companyType: { type: String, enum: COMPANY_TYPES, default: 'other', index: true },

    contactName: { type: String, default: '' },
    jobTitle:    { type: String, default: '' },
    email:       { type: String, default: '' },
    phone:       { type: String, default: '' },
    whatsapp:    { type: String, default: '' },
    linkedin:    { type: String, default: '' },

    source:    { type: String, enum: LEAD_SOURCES, default: 'manual', index: true },
    sourceUrl: { type: String, default: '' },

    productInterest:          { type: [String], default: [] },
    purchaseIntent:           { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },
    estimatedPurchaseVolume:  { type: String, default: '' },

    score: { type: Number, min: 0, max: 100, default: 0, index: true },
    grade: { type: String, enum: LEAD_GRADES, default: 'C', index: true },

    status: { type: String, enum: LEAD_STATUSES, default: 'NEW', index: true },

    ownerId:    { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true, unique: false },
    companyId:  { type: Schema.Types.ObjectId, ref: 'Company',  index: true },

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

export const Lead = model<ILead>('Lead', LeadSchema);
export default Lead;

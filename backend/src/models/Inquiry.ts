/**
 * Inquiry 模型 — 客户询盘
 *
 * PHASE 2-A 扩展：
 *   1. 新增 stage（NEW/PROCESSING/QUALIFIED/QUOTED/NEGOTIATING/WON/LOST），不破坏 legacy status（仍然保留 5 值）
 *   2. 新增关联字段：leadId / customerId / companyId / contactId / ownerId
 *   3. 新增业务字段：priority / estimatedValue / expectedCloseDate
 *   4. 兼容映射：pre-save 中若 stage 未显式给值，则按 legacy status → stage 自动同步（不会破坏老数据）
 *   5. source 枚举已扩展（website 等），保持原样
 *
 * 不删除任何原字段，不破坏现有 CMS 后台与公开表单。
 */
import { Schema, model, Document, Types } from 'mongoose';
import {
  INQUIRY_STAGES,
  INQUIRY_LEGACY_STATUS_TO_STAGE,
  InquiryStage,
} from '../types/crm';

export type InquiryStatus = 'new' | 'read' | 'replied' | 'closed' | 'archived';
export type InquirySource = 'contact' | 'product' | 'quote' | 'oem';
export type InquiryPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface IInquiry extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  whatsapp: string;
  country?: string;
  company?: string;
  quantity?: number;
  budget?: number;
  targetDate?: string;
  subject?: string;
  message: string;
  customDemand: string;
  productId?: Types.ObjectId;
  productName?: string;
  attachmentUrls?: string[];
  status: InquiryStatus;
  source: InquirySource;

  // ——— PHASE 2-A 新增（可选；旧数据均为 undefined，不会引发兼容问题）———
  stage: InquiryStage;

  leadId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  companyId?: Types.ObjectId;
  contactId?: Types.ObjectId;
  ownerId?: Types.ObjectId;

  priority: InquiryPriority;
  estimatedValue?: number;        // USD
  expectedCloseDate?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const InquirySchema = new Schema<IInquiry>({
  name: { type: String, required: true, index: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  country: { type: String, default: '' },
  company: { type: String, default: '' },
  quantity: { type: Number },
  budget: { type: Number },
  targetDate: { type: String, default: '' },
  subject: { type: String, default: '' },
  message: { type: String, default: '' },
  customDemand: { type: String, default: '' },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
  productName: { type: String, default: '' },
  attachmentUrls: [{ type: String }],
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'closed', 'archived'],
    default: 'new',
    index: true,
  },
  // source：PHASE 2-A 扩展枚举（兼容原有 contact/product/quote/oem/website；新增 CRM 常用来源）
  source: {
    type: String,
    enum: ['contact', 'product', 'quote', 'oem', 'website',
           'exhibition', 'linkedin', 'google', 'instagram', 'alibaba',
           'referral', 'manual', 'import', 'cold_email', 'whatsapp', 'other'],
    default: 'contact',
    index: true,
  },

  // ——— PHASE 2-A 新增 ———
  stage: {
    type: String,
    enum: INQUIRY_STAGES,
    default: 'NEW',
    index: true,
  },

  leadId:     { type: Schema.Types.ObjectId, ref: 'Lead',     index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
  companyId:  { type: Schema.Types.ObjectId, ref: 'Company',  index: true },
  contactId:  { type: Schema.Types.ObjectId, ref: 'Contact',  index: true },
  ownerId:    { type: Schema.Types.ObjectId, ref: 'Admin',    index: true },

  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM',
    index: true,
  },
  estimatedValue:    { type: Number, index: true },
  expectedCloseDate: { type: Date, index: true },
}, { timestamps: true });

InquirySchema.index({ createdAt: -1 });
// PHASE 2-A：业务工作台常用查询索引
InquirySchema.index({ ownerId: 1, stage: 1, createdAt: -1 });
InquirySchema.index({ customerId: 1, stage: 1 });
InquirySchema.index({ companyId: 1, stage: 1 });
InquirySchema.index({ stage: 1, estimatedValue: -1 });
InquirySchema.index({ priority: 1, stage: 1, createdAt: -1 });

// pre-save 1：保证 customDemand 与 message 双向填充（原有兼容逻辑保留）
InquirySchema.pre('save', function (next) {
  const doc = this as IInquiry;
  if (doc.message && !doc.customDemand) doc.customDemand = doc.message;
  if (doc.customDemand && !doc.message) doc.message = doc.customDemand;
  // PHASE 2-A：如果 stage 没显式给 / 未变化，按 legacy status 映射默认 stage
  // （让老数据 / 仅写 status 的旧接口也能得到合理的新 stage 默认值；显式写 stage 的新接口不受影响）
  if (!doc.stage && doc.status) {
    doc.stage = INQUIRY_LEGACY_STATUS_TO_STAGE[doc.status] ?? 'NEW';
  }
  next();
});

export const Inquiry = model<IInquiry>('Inquiry', InquirySchema);
export default Inquiry;

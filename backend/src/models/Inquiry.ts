/**
 * Inquiry 模型 — 客户询盘
 */
import { Schema, model, Document, Types } from 'mongoose';

export type InquiryStatus = 'new' | 'read' | 'replied' | 'closed' | 'archived';
export type InquirySource = 'contact' | 'product' | 'quote' | 'oem';

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
  source: { type: String, enum: ['contact', 'product', 'quote', 'oem', 'website'], default: 'contact', index: true },
}, { timestamps: true });

InquirySchema.index({ createdAt: -1 });

// pre-save 保证 customDemand 与 message 双向填充，兼容旧字段调用方
InquirySchema.pre('save', function (next) {
  const doc = this as IInquiry;
  if (doc.message && !doc.customDemand) doc.customDemand = doc.message;
  if (doc.customDemand && !doc.message) doc.message = doc.customDemand;
  next();
});

export const Inquiry = model<IInquiry>('Inquiry', InquirySchema);
export default Inquiry;

/**
 * PHASE 2-C §11 ProductMatch — Lead ↔ Product 匹配记录
 * 一次 AI matching 会写多条；查询时按 leadId 取最新一批。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { CONFIDENCE_LEVELS } from '../types/ai';

export interface IProductMatch extends Document {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  productId: Types.ObjectId;
  matchScore: number;          // 0-100
  reason: string;
  confidence: 'CONFIRMED' | 'INFERRED' | 'UNKNOWN';
  jobId?: Types.ObjectId;
  editSource: 'AI' | 'MANUALLY_EDITED';
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductMatchSchema = new Schema<IProductMatch>(
  {
    leadId:    { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    matchScore: { type: Number, default: 0, min: 0, max: 100 },
    reason: { type: String, default: '' },
    confidence: { type: String, enum: CONFIDENCE_LEVELS, default: 'INFERRED' },
    jobId: { type: Schema.Types.ObjectId, ref: 'AIResearchJob', index: true },
    editSource: { type: String, default: 'AI' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

// 同一 Lead + Product 唯一（重新匹配时覆盖）
ProductMatchSchema.index({ leadId: 1, productId: 1 }, { unique: true });
ProductMatchSchema.index({ leadId: 1, matchScore: -1 });

export const ProductMatch = model<IProductMatch>('ProductMatch', ProductMatchSchema);
export default ProductMatch;

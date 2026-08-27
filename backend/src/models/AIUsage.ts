/**
 * PHASE 2-C §30 AIUsage — AI 调用 token + 成本统计
 * 每次 AI 调用（含失败）写一条；用于 Dashboard 成本 + 失败次数统计。
 */
import { Schema, model, Document, Types } from 'mongoose';

export interface IAIUsage extends Document {
  _id: Types.ObjectId;
  provider: string;            // 'mock' | 'openai'
  aiModel: string;
  purpose: string;             // AI_PURPOSES 之一
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;       // USD
  status: 'OK' | 'FAILED';
  errorKind?: string;
  leadId?: Types.ObjectId;
  jobId?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AIUsageSchema = new Schema<IAIUsage>(
  {
    provider: { type: String, default: 'mock', index: true },
    aiModel:  { type: String, default: '', index: true },
    purpose:  { type: String, default: '', index: true },
    inputTokens:  { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    totalTokens:  { type: Number, default: 0, min: 0 },
    estimatedCost: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['OK', 'FAILED'], default: 'OK', index: true },
    errorKind: { type: String, default: '' },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', index: true },
    jobId:  { type: Schema.Types.ObjectId, ref: 'AIResearchJob', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

// §48 索引（按查询模式）
AIUsageSchema.index({ createdAt: -1 });
AIUsageSchema.index({ provider: 1, createdAt: -1 });
AIUsageSchema.index({ purpose: 1, createdAt: -1 });
AIUsageSchema.index({ leadId: 1, createdAt: -1 });

export const AIUsage = model<IAIUsage>('AIUsage', AIUsageSchema);
export default AIUsage;

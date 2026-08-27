/**
 * PHASE 2-C §21 DevelopmentStrategy — Lead 维度的 AI 开发策略
 * 一对一指向 Lead；§28 人工编辑后 editSource='MANUALLY_EDITED'，aiSnapshot 保留原始。
 */
import { Schema, model, Document, Types } from 'mongoose';

export interface IDevelopmentStrategy extends Document {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  jobId?: Types.ObjectId;
  targetPersona: any;
  painPoints: any;
  potentialProducts: any;
  recommendedValueProposition: any;
  recommendedChannel: any;
  recommendedTiming: any;
  followUpStrategy: any;
  confidence: number;
  sources: any[];
  editSource: 'AI' | 'MANUALLY_EDITED';
  aiSnapshot?: any;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DevelopmentStrategySchema = new Schema<IDevelopmentStrategy>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'AIResearchJob', index: true },
    targetPersona: { type: Schema.Types.Mixed, default: {} },
    painPoints: { type: Schema.Types.Mixed, default: {} },
    potentialProducts: { type: Schema.Types.Mixed, default: {} },
    recommendedValueProposition: { type: Schema.Types.Mixed, default: {} },
    recommendedChannel: { type: Schema.Types.Mixed, default: {} },
    recommendedTiming: { type: Schema.Types.Mixed, default: {} },
    followUpStrategy: { type: Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 0, min: 0, max: 100 },
    sources: [Schema.Types.Mixed],
    editSource: { type: String, default: 'AI' },
    aiSnapshot: { type: Schema.Types.Mixed, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

export const DevelopmentStrategy = model<IDevelopmentStrategy>('DevelopmentStrategy', DevelopmentStrategySchema);
export default DevelopmentStrategy;

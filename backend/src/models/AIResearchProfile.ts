/**
 * PHASE 2-C §5 AIResearchProfile — Lead 维度的"最新研究结果快照"
 * 不同于 Job（每次调用都建一条），Profile 一对一指向 Lead，
 * 用于 Lead 详情页直接展示，避免每次都 join 最近 Job。
 * §28 人工编辑会标记 editSource='MANUALLY_EDITED'，原始 AI 结果不覆盖（archive）。
 */
import { Schema, model, Document, Types } from 'mongoose';

export interface IAIResearchProfile extends Document {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  jobId?: Types.ObjectId;       // 最后一次生成该 profile 的 job
  companySummary: any;
  businessModel: any;
  industry: any;
  companyType: any;
  marketPosition: any;
  targetCustomers: any;
  productCategories: any;
  potentialNeeds: any;
  possibleCeramicDemand: any;
  purchaseSignals: any;
  riskSignals: any;
  recommendedProducts: any;
  recommendedApproach: any;
  confidence: number;
  sources: any[];
  researchStatus: 'AI_RESEARCH' | 'MANUAL_EDIT' | 'STALE';
  editSource: 'AI' | 'MANUALLY_EDITED' | 'IMPORTED';
  aiSnapshot?: any;            // §28 原始 AI 结果（不覆盖）
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AIResearchProfileSchema = new Schema<IAIResearchProfile>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'AIResearchJob', index: true },
    companySummary: { type: Schema.Types.Mixed, default: {} },
    businessModel: { type: Schema.Types.Mixed, default: {} },
    industry: { type: Schema.Types.Mixed, default: {} },
    companyType: { type: Schema.Types.Mixed, default: {} },
    marketPosition: { type: Schema.Types.Mixed, default: {} },
    targetCustomers: { type: Schema.Types.Mixed, default: {} },
    productCategories: { type: Schema.Types.Mixed, default: {} },
    potentialNeeds: { type: Schema.Types.Mixed, default: {} },
    possibleCeramicDemand: { type: Schema.Types.Mixed, default: {} },
    purchaseSignals: { type: Schema.Types.Mixed, default: {} },
    riskSignals: { type: Schema.Types.Mixed, default: {} },
    recommendedProducts: { type: Schema.Types.Mixed, default: {} },
    recommendedApproach: { type: Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 0, min: 0, max: 100 },
    sources: [Schema.Types.Mixed],
    researchStatus: { type: String, default: 'AI_RESEARCH' },
    editSource: { type: String, default: 'AI' },
    aiSnapshot: { type: Schema.Types.Mixed, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

export const AIResearchProfile = model<IAIResearchProfile>('AIResearchProfile', AIResearchProfileSchema);
export default AIResearchProfile;

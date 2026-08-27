/**
 * PHASE 2-C §4 AIResearchJob — AI 研究任务（含状态机 + 输入快照 + 结果）
 * 路径：/api/console/ai/research/:leadId / /api/console/ai/jobs
 */
import { Schema, model, Document, Types } from 'mongoose';
import { AI_JOB_STATUSES, AI_PURPOSES } from '../types/ai';

export interface IAIResearchJob extends Document {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  purpose: 'CUSTOMER_RESEARCH' | 'LEAD_QUALIFICATION' | 'PRODUCT_MATCHING' | 'DEVELOPMENT_STRATEGY' | 'MESSAGE_DRAFT';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  provider: string;            // 'mock' | 'openai'
  aiModel: string;
  promptVersion: string;       // §20 e.g. CUSTOMER_RESEARCH_V1
  inputSnapshot: any;          // §16-17 sanitized lead + products 摘要（不含私人 PII）
  result?: any;                // §5 校验通过后的结构化结果
  confidence?: number;         // 0-100
  sources?: any[];             // §15
  error?: string;
  errorKind?: string;
  tokenUsage?: { input: number; output: number; total: number };
  estimatedCostUsd?: number;
  startedAt?: Date;
  completedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AIResearchJobSchema = new Schema<IAIResearchJob>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    purpose: { type: String, enum: AI_PURPOSES, default: 'CUSTOMER_RESEARCH', index: true },
    status:  { type: String, enum: AI_JOB_STATUSES, default: 'QUEUED', index: true },
    provider: { type: String, default: 'mock', index: true },
    aiModel: { type: String, default: '' },
    promptVersion: { type: String, default: '', index: true },
    inputSnapshot: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed, default: null },
    confidence: { type: Number, min: 0, max: 100 },
    sources: { type: Array, default: [] },
    error: { type: String, default: '' },
    errorKind: { type: String, default: '' },
    tokenUsage: {
      type: { input: Number, output: Number, total: Number },
      default: { input: 0, output: 0, total: 0 },
    },
    estimatedCostUsd: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
  },
  { timestamps: true },
);

// §48 索引
AIResearchJobSchema.index({ leadId: 1, createdAt: -1 });
AIResearchJobSchema.index({ status: 1, createdAt: -1 });
AIResearchJobSchema.index({ purpose: 1, status: 1 });
AIResearchJobSchema.index({ createdBy: 1, createdAt: -1 });

export const AIResearchJob = model<IAIResearchJob>('AIResearchJob', AIResearchJobSchema);
export default AIResearchJob;

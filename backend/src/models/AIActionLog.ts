/**
 * PHASE 2-C §29 AIActionLog — 所有 AI 相关操作的审计日志
 * 操作：RESEARCH / SCORE / PRODUCT_MATCH / STRATEGY / MESSAGE_GENERATION /
 *       REGENERATE / APPROVE / EDIT / REJECT
 */
import { Schema, model, Document, Types } from 'mongoose';
import { AI_ACTIONS } from '../types/ai';

export interface IAIActionLog extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  leadId?: Types.ObjectId;
  jobId?: Types.ObjectId;
  action: 'RESEARCH' | 'SCORE' | 'PRODUCT_MATCH' | 'STRATEGY' | 'MESSAGE_GENERATION' | 'REGENERATE' | 'APPROVE' | 'EDIT' | 'REJECT';
  provider: string;
  aiModel: string;
  promptVersion?: string;
  status: 'OK' | 'FAILED' | 'CANCELLED';
  tokenUsage?: { input: number; output: number; total: number };
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const AIActionLogSchema = new Schema<IAIActionLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', index: true },
    jobId:  { type: Schema.Types.ObjectId, ref: 'AIResearchJob', index: true },
    action: { type: String, enum: AI_ACTIONS, required: true, index: true },
    provider: { type: String, default: '' },
    aiModel:  { type: String, default: '' },
    promptVersion: { type: String, default: '' },
    status: { type: String, enum: ['OK', 'FAILED', 'CANCELLED'], default: 'OK' },
    tokenUsage: {
      type: { input: Number, output: Number, total: Number },
      default: { input: 0, output: 0, total: 0 },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

AIActionLogSchema.index({ leadId: 1, createdAt: -1 });
AIActionLogSchema.index({ userId: 1, createdAt: -1 });
AIActionLogSchema.index({ action: 1, createdAt: -1 });

export const AIActionLog = model<IAIActionLog>('AIActionLog', AIActionLogSchema);
export default AIActionLog;

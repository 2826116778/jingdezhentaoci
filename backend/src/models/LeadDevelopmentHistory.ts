/**
 * PHASE 3-A LeadDevelopmentHistory — 客户开发生命周期状态变更历史。
 *
 * 设计原则（§2 不允许覆盖历史记录）：
 *   - 每次状态变化插入一条新记录，绝不 update/delete 已有历史。
 *   - 记录 from / to / 变更人 / 变更原因 / AI 动作触发源 / metadata。
 *   - 与 AIActionLog 区分：AIActionLog 记 AI 调用本身；
 *     本表记录 devStatus 状态机的转换历史（人工或 AI 触发的状态推进）。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { DEV_STATUSES, DevStatus } from '../types/crm';

export interface ILeadDevelopmentHistory extends Document {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  fromStatus: DevStatus | null;     // null = 初始创建
  toStatus: DevStatus;
  changedBy?: Types.ObjectId;       // Admin id
  reason: string;                    // 变更原因
  source: 'MANUAL' | 'AI_RESEARCH' | 'AI_QUALIFICATION' | 'AI_MESSAGE_APPROVE' | 'SYSTEM';
  metadata?: any;                   // 附加：jobId / draftId 等
  createdAt: Date;
  updatedAt: Date;
}

const LeadDevelopmentHistorySchema = new Schema<ILeadDevelopmentHistory>(
  {
    leadId:     { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    fromStatus: { type: String, enum: DEV_STATUSES, default: null },
    toStatus:   { type: String, enum: DEV_STATUSES, required: true },
    changedBy:  { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    reason:     { type: String, default: '' },
    source:     { type: String, enum: ['MANUAL', 'AI_RESEARCH', 'AI_QUALIFICATION', 'AI_MESSAGE_APPROVE', 'SYSTEM'], default: 'MANUAL' },
    metadata:   { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'lead_development_histories' },
);

// 时间线倒序查询索引
LeadDevelopmentHistorySchema.index({ leadId: 1, createdAt: -1 });
LeadDevelopmentHistorySchema.index({ toStatus: 1, createdAt: -1 });
LeadDevelopmentHistorySchema.index({ changedBy: 1, createdAt: -1 });

export const LeadDevelopmentHistory = model<ILeadDevelopmentHistory>(
  'LeadDevelopmentHistory',
  LeadDevelopmentHistorySchema,
);
export default LeadDevelopmentHistory;

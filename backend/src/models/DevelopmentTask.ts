/**
 * DevelopmentTask Model — 客户开发任务（Campaign 下的执行单元）。
 * 与普通 Task 区别：DevelopmentTask 专门面向客户开发活动，关联 campaignId，
 * 支持批量分配 Lead 给业务员，并统计漏斗。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { TASK_PRIORITIES, TASK_STATUSES, TaskPriority, TaskStatus } from '../types/crm';

export interface IDevelopmentTask extends Document {
  _id: Types.ObjectId;

  title: string;
  description: string;

  campaignId?: Types.ObjectId;
  leadIds: Types.ObjectId[];   // 关联的 Lead 列表

  // 分配
  ownerId?: Types.ObjectId;    // 负责人 Admin
  assignedTo?: Types.ObjectId[]; // 被分配的业务员列表

  type: string;
  priority: TaskPriority;
  status: TaskStatus;

  dueAt?: Date;
  completedAt?: Date;

  // 漏斗统计
  totalLeads: number;
  qualified: number;
  contacted: number;
  replied: number;
  interested: number;
  inquiry: number;
  converted: number;
  lost: number;

  createdAt: Date;
  updatedAt: Date;
}

const DevelopmentTaskSchema = new Schema<IDevelopmentTask>(
  {
    title:       { type: String, required: true, index: true },
    description: { type: String, default: '' },

    campaignId: { type: Schema.Types.ObjectId, ref: 'LeadCampaign', index: true },
    leadIds:    { type: [Schema.Types.ObjectId], default: [] },

    ownerId:    { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    assignedTo: { type: [Schema.Types.ObjectId], ref: 'Admin', default: [] },

    type:     { type: String, default: 'OTHER' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'MEDIUM', index: true },
    status:   { type: String, enum: TASK_STATUSES, default: 'TODO', index: true },

    dueAt:      { type: Date, index: true },
    completedAt:{ type: Date },

    totalLeads: { type: Number, default: 0 },
    qualified:  { type: Number, default: 0 },
    contacted:  { type: Number, default: 0 },
    replied:    { type: Number, default: 0 },
    interested: { type: Number, default: 0 },
    inquiry:    { type: Number, default: 0 },
    converted:  { type: Number, default: 0 },
    lost:       { type: Number, default: 0 },
  },
  { timestamps: true },
);

DevelopmentTaskSchema.index({ campaignId: 1, status: 1 });
DevelopmentTaskSchema.index({ ownerId: 1, status: 1, createdAt: -1 });

export const DevelopmentTask = model<IDevelopmentTask>('DevelopmentTask', DevelopmentTaskSchema);
export default DevelopmentTask;

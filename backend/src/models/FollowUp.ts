/**
 * FollowUp Model — 跟进记录
 * 可以挂在 Lead / Customer / Contact 任何一个上（三者至少选其一）。
 * 创建/完成时会写入 Interaction 时间线（Interaction.create 由 routes 层触发）。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { FOLLOWUP_STATUSES, FOLLOWUP_TYPES, FollowUpStatus, FollowUpType } from '../types/crm';

export interface IFollowUp extends Document {
  _id: Types.ObjectId;

  customerId?: Types.ObjectId;
  leadId?: Types.ObjectId;
  contactId?: Types.ObjectId;

  type: FollowUpType;

  content: string;
  result: string;
  nextAction: string;

  scheduledAt: Date;
  completedAt?: Date;

  ownerId?: Types.ObjectId;

  status: FollowUpStatus;

  createdAt: Date;
  updatedAt: Date;
}

const FollowUpSchema = new Schema<IFollowUp>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    leadId:     { type: Schema.Types.ObjectId, ref: 'Lead',     index: true },
    contactId:  { type: Schema.Types.ObjectId, ref: 'Contact',  index: true },

    type: { type: String, enum: FOLLOWUP_TYPES, default: 'OTHER', index: true },

    content:    { type: String, default: '' },
    result:     { type: String, default: '' },
    nextAction: { type: String, default: '' },

    scheduledAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },

    ownerId: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },

    status: { type: String, enum: FOLLOWUP_STATUSES, default: 'PENDING', index: true },
  },
  { timestamps: true },
);

// 今日跟进 / 逾期 / 完成 常用视图索引
FollowUpSchema.index({ ownerId: 1, status: 1, scheduledAt: 1 });
FollowUpSchema.index({ customerId: 1, scheduledAt: -1 });
FollowUpSchema.index({ leadId: 1, scheduledAt: -1 });
FollowUpSchema.index({ createdAt: -1 });

export const FollowUp = model<IFollowUp>('FollowUp', FollowUpSchema);
export default FollowUp;

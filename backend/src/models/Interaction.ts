/**
 * Interaction Model — 统一 Timeline / 互动记录。
 * 所有 Lead / Customer 重要业务动作写入这里，Customer 详情页 Timeline 直接从此表按 customerId 查询。
 * Lead 上的互动在 Convert 后可通过 leadId 关联统一展示。
 * 可选地 attach 一个 sourceId（如 followUpId / quoteId / orderId / taskId）用于跳转详情。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { INTERACTION_TYPES, InteractionType } from '../types/crm';

export interface IInteraction extends Document {
  _id: Types.ObjectId;

  // 关联对象：至少填一个
  customerId?: Types.ObjectId;
  leadId?: Types.ObjectId;
  companyId?: Types.ObjectId;
  contactId?: Types.ObjectId;

  type: InteractionType;

  title: string;
  content: string;

  // 详情源（可选）
  sourceRef?: {
    model: 'FollowUp' | 'Task' | 'Inquiry' | 'Quote' | 'Order' | string;
    id: Types.ObjectId;
  };

  // 负责人（谁触发的；系统类交互为 null）
  ownerId?: Types.ObjectId;

  occurredAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const InteractionSchema = new Schema<IInteraction>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    leadId:     { type: Schema.Types.ObjectId, ref: 'Lead',     index: true },
    companyId:  { type: Schema.Types.ObjectId, ref: 'Company',  index: true },
    contactId:  { type: Schema.Types.ObjectId, ref: 'Contact',  index: true },

    type: { type: String, enum: INTERACTION_TYPES, required: true, index: true },

    title:   { type: String, default: '' },
    content: { type: String, default: '' },

    sourceRef: {
      model: { type: String },
      id:    { type: Schema.Types.ObjectId },
    },

    ownerId:    { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

// 最常用查询：客户 timeline 按时间倒序
InteractionSchema.index({ customerId: 1, occurredAt: -1 });
InteractionSchema.index({ leadId: 1, occurredAt: -1 });
InteractionSchema.index({ companyId: 1, occurredAt: -1 });
InteractionSchema.index({ ownerId: 1, occurredAt: -1 });
InteractionSchema.index({ type: 1, occurredAt: -1 });
InteractionSchema.index({ createdAt: -1 });

export const Interaction = model<IInteraction>('Interaction', InteractionSchema);
export default Interaction;

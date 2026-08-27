/**
 * MessageTemplate Model — 开发话术模板（邮件/WhatsApp/LinkedIn/Other）。
 * 支持变量：{{firstName}} {{companyName}} {{country}} {{productName}} {{salesName}} 等。
 * Channel: EMAIL / WHATSAPP / LINKEDIN / OTHER
 * Status: ACTIVE / DRAFT / ARCHIVED
 */
import { Schema, model, Document, Types } from 'mongoose';
import { TEMPLATE_CHANNELS, TEMPLATE_STATUSES, TemplateChannel, TemplateStatus } from '../types/crm';

export interface IMessageTemplate extends Document {
  _id: Types.ObjectId;

  name: string;
  channel: TemplateChannel;
  language: string; // en / zh / ar / ...

  subject: string;   // Email 主题；WhatsApp/LinkedIn 可留空
  content: string;   // 正文，支持变量

  variables: string[]; // 使用的变量列表

  status: TemplateStatus;

  createdBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const MessageTemplateSchema = new Schema<IMessageTemplate>(
  {
    name:     { type: String, required: true, index: true },
    channel:  { type: String, enum: TEMPLATE_CHANNELS, default: 'EMAIL', index: true },
    language: { type: String, default: 'en' },

    subject: { type: String, default: '' },
    content: { type: String, required: true },

    variables: { type: [String], default: [] },

    status: { type: String, enum: TEMPLATE_STATUSES, default: 'ACTIVE', index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
  },
  { timestamps: true },
);

MessageTemplateSchema.index({ channel: 1, status: 1, createdAt: -1 });
MessageTemplateSchema.index({ language: 1, channel: 1 });

export const MessageTemplate = model<IMessageTemplate>('MessageTemplate', MessageTemplateSchema);
export default MessageTemplate;

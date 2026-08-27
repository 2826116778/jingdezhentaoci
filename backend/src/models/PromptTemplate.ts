/**
 * PHASE 2-C §19 PromptTemplate — AI Prompt 模板版本管理
 * 同名 + version 唯一；升级只新增 V2，不覆盖旧版本（§20）。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { AI_PURPOSES } from '../types/ai';

export interface IPromptTemplate extends Document {
  _id: Types.ObjectId;
  name: string;            // e.g. CUSTOMER_RESEARCH
  version: string;         // e.g. CUSTOMER_RESEARCH_V1
  purpose: 'CUSTOMER_RESEARCH' | 'LEAD_QUALIFICATION' | 'PRODUCT_MATCHING' | 'DEVELOPMENT_STRATEGY' | 'MESSAGE_DRAFT';
  systemPrompt: string;
  userPromptTemplate: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PromptTemplateSchema = new Schema<IPromptTemplate>(
  {
    name:    { type: String, required: true, index: true },
    version: { type: String, required: true, unique: true, index: true },
    purpose: { type: String, enum: AI_PURPOSES, required: true, index: true },
    systemPrompt: { type: String, default: '' },
    userPromptTemplate: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'DRAFT', 'ARCHIVED'], default: 'ACTIVE' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

PromptTemplateSchema.index({ name: 1, version: 1 }, { unique: true });

export const PromptTemplate = model<IPromptTemplate>('PromptTemplate', PromptTemplateSchema);
export default PromptTemplate;

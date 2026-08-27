/**
 * Customer Model — 已进入正式客户关系管理阶段的客户。
 * Customer != Lead：它不是 Lead 的副本，而是绑定到一个 Company（实体），
 * 并管理 customerLevel / status / owner / 销售全流程。
 * Lead → Convert → 生成 Customer(companyId=X) + Company/Contact（若缺）+ Lead.customerId。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { CUSTOMER_LEVELS, CUSTOMER_STATUSES, LEAD_SOURCES } from '../types/crm';

export interface ICustomer extends Document {
  _id: Types.ObjectId;

  companyId: Types.ObjectId;

  customerCode: string;  // CU-YYYYMMDD-NNNN 之类
  customerLevel: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'PROSPECT';
  status: 'ACTIVE' | 'PENDING' | 'AT_RISK' | 'INACTIVE' | 'CHURNED';

  source: string;        // 从哪个渠道进入系统
  ownerId?: Types.ObjectId;

  score: number;         // 0-100（综合评分，用于后续AI/分级排序）

  tags: string[];
  notes: string;

  lastContactAt?: Date;
  nextFollowUpAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true, unique: false },

    customerCode: { type: String, required: true, unique: true, index: true },
    customerLevel: { type: String, enum: CUSTOMER_LEVELS, default: 'PROSPECT', index: true },
    status:        { type: String, enum: CUSTOMER_STATUSES, default: 'PENDING', index: true },

    source:  { type: String, default: 'manual', index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },

    score: { type: Number, min: 0, max: 100, default: 0, index: true },

    tags:  { type: [String], default: [] },
    notes: { type: String, default: '' },

    lastContactAt:  { type: Date, index: true },
    nextFollowUpAt: { type: Date, index: true },
  },
  { timestamps: true },
);

CustomerSchema.index({ status: 1, customerLevel: -1, score: -1 });
CustomerSchema.index({ ownerId: 1, status: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ nextFollowUpAt: 1 });

export const Customer = model<ICustomer>('Customer', CustomerSchema);
export default Customer;

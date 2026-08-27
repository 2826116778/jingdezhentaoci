/**
 * Company Model — 公司（B2B CRM 核心共享实体）
 * 一个 Company 可以关联多个 Contact / Lead / Customer。
 * 新建 Lead Convert 时若没有对应公司会自动创建。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { COMPANY_TYPES, INDUSTRIES, LEAD_SOURCES } from '../types/crm';

export interface ICompany extends Document {
  _id: Types.ObjectId;

  name: string;       // 公司名（en 或本地化语言均可）
  nameEn?: string;
  nameAr?: string;
  website: string;
  country: string;
  city: string;
  address: string;

  industry: string;
  companyType: string;

  employeeCount?: number;
  annualPurchaseValueUsd?: number;

  profile: string;    // 公司简介

  source: string;
  sourceUrl?: string;

  tags: string[];
  notes: string;

  // 关联 Owner（当前版本 Admin，后续 Sales 角色）
  ownerId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, index: true },
    nameEn: { type: String, default: '' },
    nameAr: { type: String, default: '' },
    website: { type: String, default: '' },
    country: { type: String, default: '', index: true },
    city:    { type: String, default: '' },
    address: { type: String, default: '' },

    industry:    { type: String, default: 'other', index: true },
    companyType: { type: String, default: 'other', index: true },

    employeeCount:        { type: Number },
    annualPurchaseValueUsd: { type: Number },

    profile: { type: String, default: '' },

    source:    { type: String, default: 'manual', index: true },
    sourceUrl: { type: String, default: '' },

    tags:  { type: [String], default: [] },
    notes: { type: String, default: '' },

    ownerId: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
  },
  { timestamps: true },
);

// 组合索引：按国家+类型找公司
CompanySchema.index({ country: 1, companyType: 1 });
CompanySchema.index({ ownerId: 1, createdAt: -1 });
// 去重： name + country 唯一（避免重复录入）
CompanySchema.index({ name: 1, country: 1 }, { unique: true, partialFilterExpression: { name: { $exists: true }, country: { $exists: true } } });

export const Company = model<ICompany>('Company', CompanySchema);
export default Company;

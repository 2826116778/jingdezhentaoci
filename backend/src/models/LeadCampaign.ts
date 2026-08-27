/**
 * LeadCampaign Model — 客户开发活动（目标市场、行业、产品兴趣、业务员、Lead数等）。
 * 每个 Lead 可关联 campaignId，用于追溯「哪次客户开发活动带来了订单」。
 * Status: DRAFT / ACTIVE / PAUSED / COMPLETED / ARCHIVED
 */
import { Schema, model, Document, Types } from 'mongoose';
import { CAMPAIGN_STATUSES, CampaignStatus } from '../types/crm';

export interface ILeadCampaign extends Document {
  _id: Types.ObjectId;

  name: string;
  description: string;

  countries: string[];
  cities: string[];
  industries: string[];
  companyTypes: string[];
  productInterests: string[];

  targetLeadCount: number;
  actualLeadCount: number;

  ownerId?: Types.ObjectId;
  status: CampaignStatus;

  startDate?: Date;
  endDate?: Date;

  // 统计字段（实时计算，GET 时 aggregate 重新算更准）
  imported: number;
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

const LeadCampaignSchema = new Schema<ILeadCampaign>(
  {
    name:        { type: String, required: true, index: true },
    description: { type: String, default: '' },

    countries:        { type: [String], default: [], index: true },
    cities:            { type: [String], default: [] },
    industries:        { type: [String], default: [] },
    companyTypes:      { type: [String], default: [] },
    productInterests:  { type: [String], default: [] },

    targetLeadCount: { type: Number, default: 0, min: 0 },
    actualLeadCount: { type: Number, default: 0, min: 0 },

    ownerId: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    status:  { type: String, enum: CAMPAIGN_STATUSES, default: 'DRAFT', index: true },

    startDate: { type: Date, index: true },
    endDate:   { type: Date, index: true },

    imported:  { type: Number, default: 0 },
    qualified: { type: Number, default: 0 },
    contacted: { type: Number, default: 0 },
    replied:   { type: Number, default: 0 },
    interested:{ type: Number, default: 0 },
    inquiry:   { type: Number, default: 0 },
    converted: { type: Number, default: 0 },
    lost:      { type: Number, default: 0 },
  },
  { timestamps: true },
);

LeadCampaignSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
LeadCampaignSchema.index({ status: 1, createdAt: -1 });

export const LeadCampaign = model<ILeadCampaign>('LeadCampaign', LeadCampaignSchema);
export default LeadCampaign;

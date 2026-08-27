/**
 * MarketConfig Model — 国家/城市/市场优先级配置。
 * 管理员配置各国家的 priority (0-100)、城市列表、默认产品推荐等。
 * 不把国家硬编码在组件里，统一走 DB。
 */
import { Schema, model, Document, Types } from 'mongoose';

export interface IMarketConfig extends Document {
  _id: Types.ObjectId;

  // 国家
  countryCode: string;     // ISO code 如 AE, SA, US, GB
  countryName: string;     // 显示名 UAE, Saudi Arabia, United States
  priority: number;        // 0-100，国家优先级（评分用）
  isActive: boolean;

  // 城市
  cities: string[];

  // 默认推荐产品兴趣（根据该国市场偏好）
  defaultProductInterests: string[];

  // 备注
  notes: string;

  createdBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const MarketConfigSchema = new Schema<IMarketConfig>(
  {
    countryCode: { type: String, required: true, unique: true, index: true },
    countryName: { type: String, required: true, index: true },
    priority:    { type: Number, min: 0, max: 100, default: 50, index: true },
    isActive:    { type: Boolean, default: true },

    cities: { type: [String], default: [] },

    defaultProductInterests: { type: [String], default: [] },

    notes: { type: String, default: '' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

MarketConfigSchema.index({ isActive: 1, priority: -1 });
MarketConfigSchema.index({ countryName: 1 });

export const MarketConfig = model<IMarketConfig>('MarketConfig', MarketConfigSchema);
export default MarketConfig;

/**
 * Case 模型 — 工程案例
 * 同时支持 titleEn/Ar（老字段）与 nameEn/Ar（新的与前端类型对齐）
 */
import { Schema, model, Document, Types } from 'mongoose';

export interface ICase extends Document {
  _id: Types.ObjectId;
  titleEn: string;
  titleAr: string;
  nameEn: string;
  nameAr: string;
  clientNameEn: string;
  clientNameAr: string;
  locationEn: string;
  locationAr: string;
  year: number;
  category: 'hotel' | 'villa' | 'commercial';
  coverImage: string;
  images: string[];
  descEn: string;
  descAr: string;
  scopeEn: string;
  scopeAr: string;
  featured: boolean;
  isPublished: boolean;
  sort: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema = new Schema<ICase>({
  titleEn: { type: String, required: false, default: '' },
  titleAr: { type: String, required: false, default: '' },
  nameEn:  { type: String, required: false, default: '' },
  nameAr:  { type: String, required: false, default: '' },
  clientNameEn: { type: String, default: '' },
  clientNameAr: { type: String, default: '' },
  locationEn: { type: String, default: '' },
  locationAr: { type: String, default: '' },
  year: { type: Number, default: new Date().getFullYear() },
  category: { type: String, required: true, enum: ['hotel', 'villa', 'commercial'], index: true },
  coverImage: { type: String, default: '' },
  images: [{ type: String }],
  descEn: { type: String, default: '' },
  descAr: { type: String, default: '' },
  scopeEn: { type: String, default: '' },
  scopeAr: { type: String, default: '' },
  featured: { type: Boolean, default: false, index: true },
  isPublished: { type: Boolean, default: true, index: true },
  sort: { type: Number, default: 0 },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

// 保存前保持 nameX 与 titleX 双向同步，避免老逻辑用 titleX
CaseSchema.pre('save', function (next) {
  const doc = this as ICase;
  if (doc.nameEn && !doc.titleEn) doc.titleEn = doc.nameEn;
  if (doc.nameAr && !doc.titleAr) doc.titleAr = doc.nameAr;
  if (doc.titleEn && !doc.nameEn) doc.nameEn = doc.titleEn;
  if (doc.titleAr && !doc.nameAr) doc.nameAr = doc.titleAr;
  if (doc.sort && !doc.sortOrder) doc.sortOrder = doc.sort;
  next();
});

CaseSchema.index({ featured: 1, sortOrder: 1 });
CaseSchema.index({ isPublished: 1 });

export const CaseModel = model<ICase>('Case', CaseSchema);
export default CaseModel;

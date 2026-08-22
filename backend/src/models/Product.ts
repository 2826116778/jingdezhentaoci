/**
 * Product 模型 — 陶瓷产品
 */
import { Schema, model, Document, Types } from 'mongoose';

export interface IProduct extends Document {
  _id: Types.ObjectId;
  sku: string;
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  category: 'tableware' | 'vase' | 'art-sculpture' | 'hotel-ware' | 'tiles' | 'oem-sample';
  material: 'bone-china' | 'porcelain' | 'stoneware' | 'ceramic';
  glazeColor: string;
  size: string;
  images: string[];
  detailImages: string[];
  isCustom: boolean;
  isStock: boolean;
  isPublished: boolean;
  moq: number;
  priceMin: number;
  priceMax: number;
  oemOptions: string[];
  careEn: string;
  careAr: string;
  shippingNoteEn: string;
  shippingNoteAr: string;
  featured: boolean;
  sort: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  sku: { type: String, required: true, unique: true, index: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String, required: false, default: '' },
  descEn: { type: String, default: '' },
  descAr: { type: String, default: '' },
  category: {
    type: String,
    required: true,
    enum: ['tableware', 'vase', 'art-sculpture', 'hotel-ware', 'tiles', 'oem-sample'],
    index: true,
  },
  material: { type: String, enum: ['bone-china', 'porcelain', 'stoneware', 'ceramic'], default: 'porcelain' },
  glazeColor: { type: String, default: '' },
  size: { type: String, default: '' },
  images: [{ type: String }],
  detailImages: [{ type: String }],
  isCustom: { type: Boolean, default: false, index: true },
  isStock: { type: Boolean, default: false, index: true },
  isPublished: { type: Boolean, default: true, index: true },
  moq: { type: Number, default: 10 },
  priceMin: { type: Number, default: 0, min: 0 },
  priceMax: { type: Number, default: 0, min: 0 },
  oemOptions: [{ type: String }],
  careEn: { type: String, default: '' },
  careAr: { type: String, default: '' },
  shippingNoteEn: { type: String, default: '' },
  shippingNoteAr: { type: String, default: '' },
  featured: { type: Boolean, default: false, index: true },
  sort: { type: Number, default: 0 },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

ProductSchema.index({ priceMin: 1, priceMax: 1 });
ProductSchema.index({ featured: 1, sortOrder: 1 });

export const Product = model<IProduct>('Product', ProductSchema);
export default Product;

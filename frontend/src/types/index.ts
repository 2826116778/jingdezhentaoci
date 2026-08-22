/**
 * 全局类型定义
 */
import { ReactNode } from 'react';

export type Lang = 'en' | 'ar';

export interface Bilingual {
  en: string;
  ar: string;
}

export type ProductCategory = 'tableware' | 'vase' | 'art-sculpture' | 'hotel-ware' | 'tiles' | 'oem-sample';
export type ProductMaterial = 'bone-china' | 'porcelain' | 'stoneware' | 'ceramic';
export type CaseCategory = 'hotel' | 'villa' | 'commercial';
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'refunded' | 'cancelled';
export type InquiryStatus = 'new' | 'read' | 'replied' | 'closed' | 'archived';
export type InquirySource = 'contact' | 'product' | 'quote' | 'oem';

// -------- 前端 Checkout 草稿（sessionStorage） --------
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
}
export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  country?: string;
  shippingAddress?: string;
}
export interface CheckoutDraft {
  items: CartItem[];
  contactInfo: ContactInfo;
  customDemand: string;
}

export interface Product {
  _id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  category: ProductCategory;
  material: ProductMaterial;
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
  createdAt: string;
  updatedAt?: string;
}

export interface Case {
  _id: string;
  // 兼容：后端/前端可能用 titleX 或 nameX；两边都保留，渲染时 pickBilingual 容错
  titleEn: string;
  titleAr: string;
  nameEn: string;
  nameAr: string;
  clientNameEn: string;
  clientNameAr: string;
  locationEn: string;
  locationAr: string;
  year: number;
  category: CaseCategory;
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
  createdAt: string;
  updatedAt?: string;
}

export interface Inquiry {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  whatsapp: string;
  country?: string;
  company?: string;
  quantity?: number;
  budget?: number;
  targetDate?: string;
  subject?: string;
  message: string;
  customDemand: string;
  productId?: string;
  productName?: string;
  attachmentUrls?: string[];
  status: InquiryStatus;
  source: InquirySource;
  createdAt: string;
  updatedAt: string;
}

export interface OrderContact {
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  country?: string;
  company?: string;
  shippingAddress?: string;
}

export interface OrderItem {
  productId?: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
}

// 后台列表用的订单（比 OrderSummary 多字段）
export interface OrderListItem {
  _id: string;
  orderNo: string;
  items: OrderItem[];
  amount: number;
  paymentStatus: PaymentStatus;
  txHash?: string;
  txHashShort?: string;
  merchantAddress: string;
  contactInfo: ContactInfo;
  customDemand?: string;
  orderExpireAt: string;
  createdAt: string;
  paidAt?: string;
  blockConfirmations?: number;
}

export interface OrderSummary extends OrderListItem {
  usdtTolerance: number;
  tronNetwork: 'nile' | 'mainnet';
  usdtContractAddress: string;
  ttlSeconds?: number;
  qrcodeBase64?: string;
}

// 后台 Dashboard 汇总
export interface DashboardSummary {
  ordersTotal: number;
  ordersPaid: number;
  ordersPending: number;
  ordersExpired: number;
  revenuePaid: number;
  productsTotal: number;
  casesTotal: number;
  inquiriesTotal: number;
  inquiriesUnread: number;
}

export interface Admin {
  _id?: string;
  id?: string;
  username: string;
  role: 'superadmin' | 'editor' | 'admin';
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface ToastOptions {
  type?: 'success' | 'error' | 'info';
  text: string;
  duration?: number;
}

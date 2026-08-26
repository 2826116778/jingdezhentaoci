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
export type OrderType = 'retail' | 'dealer';
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
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
}
export interface DealerInfo {
  company?: string;
  whatsapp?: string;
  country?: string;
  website?: string;
  adminNotes?: string;
  tags?: string[];
}
export interface CheckoutDraft {
  items: CartItem[];
  contactInfo: ContactInfo;
  customDemand: string;
  orderType?: OrderType;
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
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
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
  orderType?: OrderType;
  items: OrderItem[];
  amount: number;
  paymentStatus: PaymentStatus;
  txHash?: string;
  txHashShort?: string;
  merchantAddress: string;
  contactInfo: ContactInfo;
  dealerInfo?: DealerInfo;
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

// ================================================================
// PHASE 1 外贸业务工作台（Console）基础类型 — 扩展位，Phase 2+ 补齐
// 设计原则：
//  - 任何 "list endpoint" 返回标准分页 ConsolePage<T>
//  - 任何 "get/:id endpoint" 返回 T | null
//  - Dashboard / Analytics 返回嵌套结构 + 空数组，不造假数字
// ================================================================

/** 所有 console list 接口统一分页结构 */
export interface ConsolePage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 工作台当前用户（对齐后端 /api/console/me，返回 req.admin） */
export interface ConsoleMe {
  id: string;
  username: string;
  role: string;
  avatar: string | null;
  timezone: string;
  locale: string;
}

// —— Dashboard ——
export interface ConsoleDashboardKPIs {
  totalLeads: number;
  totalCustomers: number;
  totalInquiries: number;
  totalQuotes: number;
  totalOrders: number;
  totalOrderAmountUsd: number;
  pendingTasks: number;
  upcomingFollowups: number;
  conversionRate: number;
}
export type TimeSeriesPoint = { date: string; count: number };
export type RevenuePoint    = { date: string; count: number; amount: number };
export type BySourcePoint   = { source: string; count: number };
export type ByCountryPoint  = { country: string; count: number };
export interface ConsoleDashboardCharts {
  leadsLast30Days:   TimeSeriesPoint[];
  ordersLast30Days:  RevenuePoint[];
  inquiriesBySource: BySourcePoint[];
  topCountries:      ByCountryPoint[];
}
export interface ConsoleDashboardSummary {
  kpis: ConsoleDashboardKPIs;
  charts: ConsoleDashboardCharts;
  recent: {
    inquiries: unknown[];
    orders:    unknown[];
    tasks:     unknown[];
  };
}

// —— 基础占位实体类型（Phase 2 扩展字段，Phase 1 只为 items 提供类型）——
export interface ConsoleLead      { id: string; [k: string]: any }
export interface ConsoleCustomer  { id: string; [k: string]: any }
export interface ConsoleInquiry   { id: string; [k: string]: any }
export interface ConsoleQuote     { id: string; [k: string]: any }
export interface ConsoleOrder     { id: string; [k: string]: any }
export interface ConsoleFollowUp  { id: string; [k: string]: any }
export interface ConsoleTask      { id: string; [k: string]: any }

// —— Analytics Overview ——
export interface ConsoleAnalyticsOverview {
  period: string;
  funnels: {
    leads: number;
    inquiries: number;
    quotes: number;
    orders: number;
  };
  bySource:   Array<{ source: string; leads: number; orders: number; revenue: number }>;
  byCountry:  Array<{ country: string; leads: number; orders: number; revenue: number }>;
  byProduct:  Array<{ productId: string; sku: string; name: string; orders: number; revenue: number }>;
  bySalesRep: Array<{ salesRep: string; leads: number; orders: number; revenue: number }>;
}

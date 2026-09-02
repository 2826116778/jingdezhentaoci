/**
 * Order 模型 — 订单（真实 TRC20-USDT 链上支付）
 * v1.2 新增：orderType (retail/dealer) + 完整收货地址 + 经销商信息
 *   - Retail（散客）：只需填收货地址即可支付，表单精简
 *   - Dealer（经销商）：必须填公司/WhatsApp/国家/项目需求，收货地址可选
 * v1.1 原有：orderExpireAt / expired / blockConfirmations / chainTxRaw / usdtTolerance
 *       + tronNetwork / usdtContractAddress / 幂等 txHash 唯一索引
 */
import { Schema, model, Document, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'refunded' | 'cancelled';
export type OrderType = 'retail' | 'dealer';

export interface OrderItem {
  productId?: Types.ObjectId;
  name: string;
  price: number;    // USD 单价
  qty: number;
  image?: string;
}

export interface ContactInfo {
  name: string;
  email: string;
  whatsapp?: string;
  phone?: string;
  country?: string;
  company?: string;
  // 完整收货地址
  shippingAddress?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
}

export interface DealerInfo {
  company: string;
  whatsapp: string;
  country?: string;
  website?: string;
  // 管理员后台可手动编辑的备注
  adminNotes?: string;
  tags?: string[];
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNo: string;
  orderType: OrderType;
  items: OrderItem[];
  totalAmount: number;       // USD
  usdtAmount: number;        // 应付 USDT
  usdtTolerance: number;     // 容错比例，例如 0.01
  contactInfo: ContactInfo;
  dealerInfo?: DealerInfo;   // 仅 dealer 类型必填；retail 可无
  customDemand: string;      // 项目需求 / 询盘内容（dealer 强需求）
  paymentMethod: 'USDT-TRC20';
  orderExpireAt: Date;
  walletAddress: string;
  tronNetwork: 'nile' | 'mainnet';
  usdtContractAddress: string;
  paymentStatus: PaymentStatus;
  txHash?: string;
  chainTxRaw?: any;
  blockConfirmations?: number;
  paidAt?: Date;
  expiredAt?: Date;
  userSubmittedTxHash?: string;
  lastCheckedAt?: Date;
  matchSource?: 'cron-auto' | 'user-trigger';

  // ——— PHASE 2-A 新增：CRM 业务链路关联（均可选，兼容老订单 & 商城订单）———
  customerId?: Types.ObjectId;   // 关联 Customer（由 Quote 或手动录入生成）
  inquiryId?: Types.ObjectId;    // 关联 Inquiry
  quoteId?: Types.ObjectId;      // 关联 Quote（报价单）
  ownerId?: Types.ObjectId;      // 负责人 Admin（Sales/Superadmin）

  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<OrderItem>({
  productId: { type: String, default: '' },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  qty: { type: Number, required: true, min: 1 },
  image: { type: String, default: '' },
}, { _id: false });

const ContactInfoSchema = new Schema<ContactInfo>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  whatsapp: { type: String, default: '' },
  phone: { type: String, default: '' },
  country: { type: String, default: '' },
  company: { type: String, default: '' },
  // 收货地址完整字段
  shippingAddress: { type: String, default: '' },
  shippingAddress2: { type: String, default: '' },
  shippingCity: { type: String, default: '' },
  shippingState: { type: String, default: '' },
  shippingZip: { type: String, default: '' },
  shippingCountry: { type: String, default: '' },
}, { _id: false });

const DealerInfoSchema = new Schema<DealerInfo>({
  company: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  country: { type: String, default: '' },
  website: { type: String, default: '' },
  adminNotes: { type: String, default: '' },
  tags: { type: [String], default: [] },
}, { _id: false });

const OrderSchema = new Schema<IOrder>({
  orderNo: { type: String, required: true, unique: true, index: true },
  orderType: { type: String, enum: ['retail', 'dealer'], default: 'retail', required: true, index: true },
  items: { type: [OrderItemSchema], required: true, default: [] },
  totalAmount: { type: Number, required: true },
  usdtAmount: { type: Number, required: true },
  usdtTolerance: { type: Number, required: true, default: 0.01 },
  contactInfo: { type: ContactInfoSchema, required: true },
  dealerInfo: { type: DealerInfoSchema, default: null },
  customDemand: { type: String, default: '' },
  paymentMethod: { type: String, default: 'USDT-TRC20', enum: ['USDT-TRC20'] },

  orderExpireAt: { type: Date, required: true, index: true },
  walletAddress: { type: String, required: true },
  tronNetwork: { type: String, enum: ['nile', 'mainnet'], required: true },
  usdtContractAddress: { type: String, required: true },

  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'paid', 'expired', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
    index: true,
  },
  txHash: {
    type: String,
    // 部分唯一索引在下方定义：仅当 txHash 存在且为 string 时才唯一
  },
  chainTxRaw: { type: Schema.Types.Mixed },
  blockConfirmations: { type: Number },
  paidAt: { type: Date },
  expiredAt: { type: Date },
  userSubmittedTxHash: { type: String },
  lastCheckedAt: { type: Date },
  matchSource: { type: String, enum: ['cron-auto', 'user-trigger'] },

  // ——— PHASE 2-A 新增：CRM 关联索引 ———
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
  inquiryId:  { type: Schema.Types.ObjectId, ref: 'Inquiry',  index: true },
  quoteId:    { type: Schema.Types.ObjectId, ref: 'Quote',    index: true },
  ownerId:    { type: Schema.Types.ObjectId, ref: 'Admin',    index: true },
}, { timestamps: true });

// 关键复合索引：加速 cron 扫描 pending + 未过期的订单
OrderSchema.index({ paymentStatus: 1, orderExpireAt: 1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ orderType: 1, paymentStatus: 1 });
// 部分唯一索引：确保同一 txHash 只用于一笔订单（当 txHash 存在时唯一）
OrderSchema.index(
  { txHash: 1 },
  { unique: true, partialFilterExpression: { txHash: { $exists: true, $type: 'string' } } },
);
// PHASE 2-A 新增：CRM 视角常用查询
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ inquiryId: 1 });
OrderSchema.index({ quoteId: 1 }, { unique: false });
OrderSchema.index({ ownerId: 1, paymentStatus: 1 });

export const Order = model<IOrder>('Order', OrderSchema);
export default Order;

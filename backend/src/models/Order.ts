/**
 * Order 模型 — 订单（真实 TRC20-USDT 链上支付）
 * v1.1 新增字段：orderExpireAt / expired 状态 / blockConfirmations / chainTxRaw / usdtTolerance
 *       + tronNetwork / usdtContractAddress 快照 / 幂等 txHash 唯一索引
 */
import { Schema, model, Document, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'refunded';

export interface OrderItem {
  productId?: Types.ObjectId;
  name: string;
  price: number;    // USD 单价
  qty: number;
}

export interface ContactInfo {
  name: string;
  email: string;
  whatsapp: string;
  shippingAddress?: string;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNo: string;
  items: OrderItem[];
  totalAmount: number;       // USD
  usdtAmount: number;        // 应付 USDT
  usdtTolerance: number;     // 容错比例，例如 0.01
  contactInfo: ContactInfo;
  customDemand: string;
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
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<OrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  qty: { type: Number, required: true, min: 1 },
}, { _id: false });

const ContactInfoSchema = new Schema<ContactInfo>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  whatsapp: { type: String, required: true },
  shippingAddress: { type: String, default: '' },
}, { _id: false });

const OrderSchema = new Schema<IOrder>({
  orderNo: { type: String, required: true, unique: true, index: true },
  items: { type: [OrderItemSchema], required: true, default: [] },
  totalAmount: { type: Number, required: true },
  usdtAmount: { type: Number, required: true },
  usdtTolerance: { type: Number, required: true, default: 0.01 },
  contactInfo: { type: ContactInfoSchema, required: true },
  customDemand: { type: String, default: '' },
  paymentMethod: { type: String, default: 'USDT-TRC20', enum: ['USDT-TRC20'] },

  orderExpireAt: { type: Date, required: true, index: true },
  walletAddress: { type: String, required: true },
  tronNetwork: { type: String, enum: ['nile', 'mainnet'], required: true },
  usdtContractAddress: { type: String, required: true },

  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'paid', 'expired', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  },
  txHash: {
    type: String,
    index: true,
    unique: true,
    // 允许 null（未支付时），但一旦写入必须唯一（部分唯一索引）
  },
  chainTxRaw: { type: Schema.Types.Mixed },
  blockConfirmations: { type: Number },
  paidAt: { type: Date },
  expiredAt: { type: Date },
  userSubmittedTxHash: { type: String },
  lastCheckedAt: { type: Date },
  matchSource: { type: String, enum: ['cron-auto', 'user-trigger'] },
}, { timestamps: true });

// 关键复合索引：加速 cron 扫描 pending + 未过期的订单
OrderSchema.index({ paymentStatus: 1, orderExpireAt: 1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
// 部分唯一索引：确保同一 txHash 只用于一笔订单（当 txHash 存在时唯一）
OrderSchema.index(
  { txHash: 1 },
  { unique: true, partialFilterExpression: { txHash: { $exists: true, $type: 'string' } } },
);

export const Order = model<IOrder>('Order', OrderSchema);
export default Order;

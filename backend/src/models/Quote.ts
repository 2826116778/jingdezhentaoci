/**
 * Quote Model — 报价单 + 内嵌 QuoteItem 数组 + 版本（QuoteVersion 字段内嵌 current version）。
 *
 * 关联：customerId / inquiryId / createdBy (Admin)。
 * Quote 一旦生成订单，写入对应 Order 的 quoteId。
 * Status: DRAFT / SENT / VIEWED / NEGOTIATING / ACCEPTED / REJECTED / EXPIRED。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { QUOTE_STATUSES, QuoteStatus } from '../types/crm';

export interface IQuoteItem {
  productId?: Types.ObjectId;
  sku: string;
  name: string;

  quantity: number;
  unitPrice: number;
  amount: number;

  notes: string;
}

export interface IQuote extends Document {
  _id: Types.ObjectId;

  quoteNo: string;

  customerId?: Types.ObjectId;
  inquiryId?: Types.ObjectId;

  items: IQuoteItem[];

  currency: string; // USD/EUR/RMB 等 — 默认 USD

  subtotal: number;
  shippingFee: number;
  discount: number;
  tax: number;
  total: number;

  incoterm: string;       // EXW / FOB / CIF / DDP 等
  paymentTerms: string;   // 30% deposit / TT in advance / L/C at sight 等

  validUntil?: Date;

  status: QuoteStatus;

  notes: string;

  createdBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const QuoteItemSchema = new Schema<IQuoteItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
    sku:       { type: String, default: '' },
    name:      { type: String, required: true },
    quantity:  { type: Number, required: true, min: 0, default: 1 },
    unitPrice: { type: Number, required: true, min: 0, default: 0 },
    amount:    { type: Number, required: true, min: 0, default: 0 },
    notes:     { type: String, default: '' },
  },
  { _id: false },
);

const QuoteSchema = new Schema<IQuote>(
  {
    quoteNo: { type: String, required: true, unique: true, index: true },

    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    inquiryId:  { type: Schema.Types.ObjectId, ref: 'Inquiry',  index: true },

    items: { type: [QuoteItemSchema], default: [] },

    currency: { type: String, default: 'USD', required: true },

    subtotal:    { type: Number, required: true, default: 0 },
    shippingFee: { type: Number, required: true, default: 0 },
    discount:    { type: Number, required: true, default: 0 },
    tax:         { type: Number, required: true, default: 0 },
    total:       { type: Number, required: true, default: 0 },

    incoterm:     { type: String, default: 'FOB' },
    paymentTerms: { type: String, default: '' },

    validUntil: { type: Date, index: true },

    status: { type: String, enum: QUOTE_STATUSES, default: 'DRAFT', index: true },

    notes: { type: String, default: '' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
  },
  { timestamps: true },
);

QuoteSchema.index({ customerId: 1, status: 1, createdAt: -1 });
QuoteSchema.index({ inquiryId: 1, status: 1 });
QuoteSchema.index({ status: 1, validUntil: 1 });
QuoteSchema.index({ createdBy: 1, createdAt: -1 });

export const Quote = model<IQuote>('Quote', QuoteSchema);
export default Quote;

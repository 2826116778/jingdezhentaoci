/**
 * Contact Model — 公司/客户下的联系人（一个 Company 多个 Contact）。
 * 允许挂到 customerId 或 companyId 上（isPrimary 标记主联系人）。
 */
import { Schema, model, Document, Types } from 'mongoose';

export interface IContact extends Document {
  _id: Types.ObjectId;

  companyId?: Types.ObjectId;
  customerId?: Types.ObjectId;

  name: string;
  jobTitle: string;

  email: string;
  phone: string;
  whatsapp: string;
  linkedin: string;

  isPrimary: boolean;

  notes: string;

  ownerId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    companyId:  { type: Schema.Types.ObjectId, ref: 'Company',  index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },

    name:     { type: String, required: true, index: true },
    jobTitle: { type: String, default: '' },

    email:    { type: String, default: '' },
    phone:    { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    linkedin: { type: String, default: '' },

    isPrimary: { type: Boolean, default: false },

    notes: { type: String, default: '' },

    ownerId: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
  },
  { timestamps: true },
);

ContactSchema.index({ companyId: 1, isPrimary: -1 });
ContactSchema.index({ customerId: 1, isPrimary: -1 });
ContactSchema.index({ email: 1 });
ContactSchema.index({ whatsapp: 1 });

export const Contact = model<IContact>('Contact', ContactSchema);
export default Contact;

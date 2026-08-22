/**
 * Admin 模型 — 后台管理员
 */
import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdmin extends Document {
  _id: Types.ObjectId;
  username: string;
  passwordHash: string;
  role: 'superadmin' | 'editor';
  createdAt: Date;
  comparePassword(pwd: string): Promise<boolean>;
}

const AdminSchema = new Schema<IAdmin>({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'editor'], default: 'editor' },
}, { timestamps: true });

// 校验密码
AdminSchema.methods.comparePassword = async function (pwd: string): Promise<boolean> {
  return bcrypt.compare(pwd, this.passwordHash);
};

export const Admin = model<IAdmin>('Admin', AdminSchema);
export default Admin;

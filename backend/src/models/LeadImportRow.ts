/**
 * LeadImportRow Model — 导入的单行数据（解析→映射→校验→去重→导入）。
 * 每行关联 importId，状态记录该行是 VALID / INVALID / DUPLICATE / IMPORTED / SKIPPED / UPDATED。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { IMPORT_ROW_STATUSES, ImportRowStatus } from '../types/crm';

// Omit Document.errors（mongoose 内置 ValidationError）以允许本接口自定义 errors: string[]
export interface ILeadImportRow extends Omit<Document, 'errors'> {
  _id: Types.ObjectId;

  importId: Types.ObjectId;
  rowIndex: number;

  // 映射后的数据
  data: any;

  // 校验结果
  status: ImportRowStatus;
  errors: string[];      // 校验错误列表
  duplicateLeadId?: Types.ObjectId; // 如果重复，关联的已有 Lead._id

  // 导入结果
  importedLeadId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const LeadImportRowSchema = new Schema<ILeadImportRow>(
  {
    importId: { type: Schema.Types.ObjectId, ref: 'LeadImport', required: true, index: true },
    rowIndex: { type: Number, required: true },

    data: { type: Schema.Types.Mixed, default: {} },

    status: { type: String, enum: IMPORT_ROW_STATUSES, default: 'VALID', index: true },
    errors: { type: [String], default: [] },
    duplicateLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' },

    importedLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  },
  { timestamps: true },
);

LeadImportRowSchema.index({ importId: 1, rowIndex: 1 });
LeadImportRowSchema.index({ importId: 1, status: 1 });

export const LeadImportRow = model<ILeadImportRow>('LeadImportRow', LeadImportRowSchema);
export default LeadImportRow;

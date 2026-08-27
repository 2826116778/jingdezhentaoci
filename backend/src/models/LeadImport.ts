/**
 * LeadImport Model — 一次 CSV / Excel 导入的元数据记录。
 * 状态流转：UPLOADED → PARSED → MAPPED → VALIDATED → IMPORTING → COMPLETED / FAILED / CANCELLED
 * 每一行数据存在 LeadImportRow 集合（importId 关联）。
 */
import { Schema, model, Document, Types } from 'mongoose';
import { IMPORT_STATUSES, ImportStatus } from '../types/crm';

export interface ILeadImport extends Document {
  _id: Types.ObjectId;

  fileName: string;
  fileType: 'csv' | 'xlsx' | 'json';
  fileSize: number;
  rawData: Types.Array<any>;  // 解析后的原始行数据（可被前端预览）

  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;

  // 字段映射：{ sourceField: targetField }
  fieldMapping: Map<string, string>;

  // 重复处理策略
  duplicateStrategy: string; // SKIP / UPDATE / CREATE_ANYWAY

  campaignId?: Types.ObjectId;

  status: ImportStatus;

  errorMsg?: string;

  createdBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const LeadImportSchema = new Schema<ILeadImport>(
  {
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ['csv', 'xlsx', 'json'], default: 'csv' },
    fileSize: { type: Number, default: 0 },
    rawData:  { type: [Schema.Types.Mixed], default: [] } as any,

    totalRows:     { type: Number, default: 0 },
    validRows:     { type: Number, default: 0 },
    invalidRows:   { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    importedRows:  { type: Number, default: 0 },

    fieldMapping: {
      type: Map,
      of: String,
      default: new Map(),
    },

    duplicateStrategy: { type: String, default: 'SKIP' },

    campaignId: { type: Schema.Types.ObjectId, ref: 'LeadCampaign', index: true },

    status: { type: String, enum: IMPORT_STATUSES, default: 'UPLOADED', index: true },

    errorMsg: { type: String, default: '' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
  },
  { timestamps: true },
);

LeadImportSchema.index({ createdBy: 1, createdAt: -1 });
LeadImportSchema.index({ status: 1, createdAt: -1 });

export const LeadImport = model<ILeadImport>('LeadImport', LeadImportSchema);
export default LeadImport;

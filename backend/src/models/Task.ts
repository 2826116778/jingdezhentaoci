/**
 * Task Model — 销售/运营团队任务。
 * Task 可以挂到 customer / lead 上（均可选）。
 * 完成后写入 Interaction 时间线。
 */
import { Schema, model, Document, Types } from 'mongoose';
import {
  TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES,
  TaskStatus, TaskPriority, TaskType,
} from '../types/crm';

export interface ITask extends Document {
  _id: Types.ObjectId;

  title: string;
  description: string;

  customerId?: Types.ObjectId;
  leadId?: Types.ObjectId;

  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;

  dueAt?: Date;
  completedAt?: Date;

  ownerId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title:       { type: String, required: true, index: true },
    description: { type: String, default: '' },

    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    leadId:     { type: Schema.Types.ObjectId, ref: 'Lead',     index: true },

    type:     { type: String, enum: TASK_TYPES,     default: 'OTHER', index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'MEDIUM', index: true },
    status:   { type: String, enum: TASK_STATUSES,   default: 'TODO', index: true },

    dueAt:       { type: Date, index: true },
    completedAt: { type: Date },

    ownerId: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
  },
  { timestamps: true },
);

TaskSchema.index({ ownerId: 1, status: 1, priority: -1, dueAt: 1 });
TaskSchema.index({ customerId: 1, status: 1, dueAt: 1 });
TaskSchema.index({ leadId: 1, status: 1, dueAt: 1 });
TaskSchema.index({ createdAt: -1 });

export const Task = model<ITask>('Task', TaskSchema);
export default Task;

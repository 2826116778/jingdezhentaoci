/**
 * multer 上传配置（产品/案例图片）
 * - 仅 jpg/png/webp
 * - 单文件最大 UPLOAD_MAX_MB
 * - 文件名用 UUID 重命名，防遍历
 */
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { env } from '../config/env';

const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// 公开静态访问：Express 会把 /uploads 目录挂载出去
export const UPLOAD_URL_PREFIX = '/uploads';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.includes(ext) || !allowedMime.includes(file.mimetype)) {
    return cb(new Error('只允许上传 JPG / PNG / WEBP 图片'));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024 },
  fileFilter,
});

export default upload;

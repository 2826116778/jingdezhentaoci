/**
 * 上传路由（后台） — 单图 / 多图
 * POST /upload           multipart/form-data, field=file  → { url, size }
 * POST /upload/multi     files=多个 → { files: [{url,size}] }
 * URL 格式：/uploads/<filename> （前端通过 Vite 代理到后端）
 */
import { Router, Request, Response } from 'express';
import { upload, UPLOAD_URL_PREFIX } from '../config/upload';
import { authJWT } from '../middleware/authJWT';
import { success, fail } from '../utils/response';

const router = Router();

router.post('/upload', authJWT(), upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return fail(res, '请上传文件');
  const url = `${UPLOAD_URL_PREFIX}/${req.file.filename}`;
  return success(res, { url, size: req.file.size, filename: req.file.filename, originalName: req.file.originalname }, '上传成功', 201);
});

router.post('/upload/multi', authJWT(), upload.array('files', 12), (req: Request, res: Response) => {
  const files = (req.files || []) as Express.Multer.File[];
  if (!files.length) return fail(res, '请上传至少一个文件');
  const urls = files.map(f => ({
    url: `${UPLOAD_URL_PREFIX}/${f.filename}`,
    size: f.size,
    filename: f.filename,
    originalName: f.originalname,
  }));
  return success(res, { files: urls }, '上传成功', 201);
});

export default router;

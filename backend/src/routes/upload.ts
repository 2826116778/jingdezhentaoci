/**
 * 上传路由（后台） — 单图 / 多图
 * POST /upload           multipart/form-data, field=file  → { url, size }
 * POST /upload/multi     files=多个 → { files: [{url,size}] }
 * URL 格式：绝对 URL（https://site.com/uploads/<filename>），SPA 同源/非同源部署都兼容
 */
import { Router, Request, Response } from 'express';
import { upload, UPLOAD_URL_PREFIX } from '../config/upload';
import { authJWT } from '../middleware/authJWT';
import { success, fail } from '../utils/response';
import { env } from '../config/env';

const router = Router();

function absUrl(req: Request, rel: string) {
  const site = (env.SITE_URL || '').trim().replace(/\/$/, '');
  if (site) return `${site}${rel}`;
  // 没配置 SITE_URL 就从请求头推导
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  return host ? `${proto}://${host}${rel}` : rel;
}

router.post('/upload', authJWT(), upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return fail(res, '请上传文件');
  const rel = `${UPLOAD_URL_PREFIX}/${req.file.filename}`;
  const url = absUrl(req, rel);
  return success(res, { url, size: req.file.size, filename: req.file.filename, originalName: req.file.originalname }, '上传成功', 201);
});

router.post('/upload/multi', authJWT(), upload.array('files', 12), (req: Request, res: Response) => {
  const files = (req.files || []) as Express.Multer.File[];
  if (!files.length) return fail(res, '请上传至少一个文件');
  const urls = files.map(f => {
    const rel = `${UPLOAD_URL_PREFIX}/${f.filename}`;
    return {
      url: absUrl(req, rel),
      size: f.size,
      filename: f.filename,
      originalName: f.originalname,
    };
  });
  return success(res, { files: urls }, '上传成功', 201);
});

export default router;

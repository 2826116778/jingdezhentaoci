/**
 * 认证路由（后台管理员登录）
 * POST /api/auth/login  → { token, admin }
 * GET  /api/auth/me     → 当前用户（需 JWT）
 * 首次 seed 会自动创建 admin/admin123
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin';
import { authJWT, AuthRequest } from '../middleware/authJWT';
import { success, fail } from '../utils/response';
import { env } from '../config/env';

const router = Router();

router.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return fail(res, '请输入用户名和密码', 400);
    const admin = await Admin.findOne({ username });
    if (!admin) return fail(res, env.NODE_ENV === 'development' ? '用户不存在（请先 npm run seed）' : '用户名或密码错误', 401);
    const ok = await admin.comparePassword(password);
    if (!ok) return fail(res, '用户名或密码错误', 401);
    const token = jwt.sign(
      { id: admin._id.toString(), username: admin.username, role: admin.role },
      env.JWT_SECRET as jwt.Secret,
      { expiresIn: env.JWT_EXPIRES_IN as any },
    );
    return success(res, {
      token,
      admin: { id: admin._id, username: admin.username, role: admin.role },
      expiresIn: env.JWT_EXPIRES_IN,
    }, '登录成功');
  } catch (e) { next(e); }
});

router.get('/auth/me', authJWT(), (req: AuthRequest, res) => {
  return success(res, req.admin || null);
});

export default router;

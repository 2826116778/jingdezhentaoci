/**
 * JWT 鉴权中间件 — 保护后台管理接口
 * Token 格式：Authorization: Bearer <xxx>
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import Admin from '../models/Admin';

export interface JwtPayload {
  id: string;
  username: string;
  role: 'superadmin' | 'editor';
}

export interface AuthRequest extends Request {
  admin?: JwtPayload;
}

export function authJWT(requiredRole?: 'superadmin') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ code: 401, message: 'Unauthorized' });
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      // 二次校验：用户是否仍存在
      const admin = await Admin.findById(payload.id);
      if (!admin) return res.status(401).json({ code: 401, message: 'Admin not found' });
      if (requiredRole === 'superadmin' && admin.role !== 'superadmin') {
        return res.status(403).json({ code: 403, message: 'Superadmin role required' });
      }
      req.admin = { id: String(admin._id), username: admin.username, role: admin.role };
      next();
    } catch (e) {
      return res.status(401).json({ code: 401, message: 'Invalid or expired token' });
    }
  };
}

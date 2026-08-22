/**
 * 统一响应工具函数
 */
import { Response } from 'express';

export function success<T = any>(res: Response, data: T, message = 'ok', status = 200) {
  return res.status(status).json({ code: 0, message, data });
}

export function fail(res: Response, message: string, code = 1, status = 400, extra?: any) {
  return res.status(status).json({ code, message, data: extra ?? null });
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

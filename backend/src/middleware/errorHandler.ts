/**
 * 全局错误处理器（兜底 Express 异常）
 */
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('[ErrorHandler]', err?.message || err);
  if (res.headersSent) return next(err);
  const status = err?.status || err?.statusCode || 500;
  res.status(status).json({
    code: status === 500 ? 500 : (err?.code || 1),
    message: err?.message || 'Internal Server Error',
    data: null,
    ...(process.env.NODE_ENV === 'development' && err?.stack ? { stack: String(err.stack) } : {}),
  });
};

export default errorHandler;

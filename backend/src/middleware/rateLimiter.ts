/**
 * Rate Limit 中间件（集中配置）
 *
 * 设计原则：
 *  1. 所有阈值来自 env.ts（又可由 .env 覆盖），业务路由不硬编码任何数字
 *  2. 4 类高风险接口独立限频：登录 / 询盘 / 订单 / 上传
 *  3. 返回标准 429 + code + 中文/英文双语消息，与现有 ApiResponse 风格一致
 *  4. 复用 express-rate-limit 自带的 default IP keyGenerator（已处理 IPv6 折叠），
 *     配合 index.ts `app.set('trust proxy', true)` 可正确穿透 Nginx / CDN 读取真实用户 IP
 *
 *  后续扩展某个模块的限流，只需要在此文件新增一个 limiter，并在 index.ts 用
 *    app.use('/api/xxx/xxx', xxLimiter)
 *  挂载；绝对不要散落到 routes/*.ts 业务 handler 内。
 */
import rateLimit, { Options } from 'express-rate-limit';
import { env } from '../config/env';

// 统一的 429 响应格式（贴合项目 {code, message, data} 风格）
const standardHandler: NonNullable<Options['handler']> = (_req, res) => {
  res.status(429).json({
    code: 429,
    message: env.RATE_LIMIT_MESSAGE,
    data: null,
  });
};

/** 🔐 登录接口：同 IP 15 次/分钟 → 防暴力破解 */
export const loginLimiter = rateLimit({
  windowMs: env.RATE_LOGIN_WINDOW_MS,
  max: env.RATE_LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: env.RATE_LIMIT_MESSAGE,
  handler: standardHandler,
});

/** 📩 询盘接口：同 IP 30 次/分钟 → 防垃圾表单机器人 */
export const inquiryLimiter = rateLimit({
  windowMs: env.RATE_INQUIRY_WINDOW_MS,
  max: env.RATE_INQUIRY_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: env.RATE_LIMIT_MESSAGE,
  handler: standardHandler,
});

/** 🛒 订单接口：同 IP 60 次/分钟 → 防重复创建 / Tx 刷验证 / 爬虫轮询 */
export const orderLimiter = rateLimit({
  windowMs: env.RATE_ORDER_WINDOW_MS,
  max: env.RATE_ORDER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: env.RATE_LIMIT_MESSAGE,
  handler: standardHandler,
});

/** 📤 文件上传：同 IP 80 次/分钟 → 防恶意刷磁盘占用 */
export const uploadLimiter = rateLimit({
  windowMs: env.RATE_UPLOAD_WINDOW_MS,
  max: env.RATE_UPLOAD_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: env.RATE_LIMIT_MESSAGE,
  handler: standardHandler,
});

export default {
  loginLimiter,
  inquiryLimiter,
  orderLimiter,
  uploadLimiter,
};

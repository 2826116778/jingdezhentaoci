/**
 * 中文注释：环境配置读取 — 基于 dotenv
 * 所有模块需要 env 变量都从此处取，不要直接 process.env，方便集中管理
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_PREFIX: process.env.API_PREFIX || '/api',

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luxeceramics',

  JWT_SECRET: process.env.JWT_SECRET || 'CHANGE_ME_luxeceramics_jwt_secret_32chars_luxeceramics',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  ADMIN_DEFAULT_USERNAME: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
  ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123',

  SITE_NAME: process.env.SITE_NAME || 'LuxeCeramics',
  SITE_URL: process.env.SITE_URL || 'http://localhost:5173',
  SALES_EMAIL: process.env.SALES_EMAIL || 'sales@luxeceramics.com',

  // 邮件
  EMAIL_MODE: (process.env.EMAIL_MODE as 'demo' | 'smtp') || 'demo',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: process.env.SMTP_SECURE !== 'false',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '"LuxeCeramics" <noreply@luxeceramics.com>',
  EMAIL_NOTIFY_TO: process.env.EMAIL_NOTIFY_TO || 'sales@luxeceramics.com',

  // 上传
  UPLOAD_DIR: process.env.UPLOAD_DIR || './public/uploads',
  UPLOAD_MAX_MB: parseInt(process.env.UPLOAD_MAX_MB || '10', 10),

  // ========== Tron 链上收款 ==========
  TRON_NETWORK: (process.env.TRON_NETWORK as 'nile' | 'mainnet') || 'nile',
  TRONGRID_API_KEY: process.env.TRONGRID_API_KEY || '',
  MERCHANT_WALLET_TRON: process.env.MERCHANT_WALLET_TRON || '',
  USDT_CONTRACT_NILE: process.env.USDT_CONTRACT_NILE || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  USDT_CONTRACT_MAINNET: process.env.USDT_CONTRACT_MAINNET || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',

  ORDER_TTL_MINUTES: parseInt(process.env.ORDER_TTL_MINUTES || '15', 10),
  USDT_TOLERANCE: parseFloat(process.env.USDT_TOLERANCE || '0.01'),
  REQUIRED_CONFIRMATIONS: parseInt(process.env.REQUIRED_CONFIRMATIONS || '6', 10),
  USD_TO_USDT_RATE: parseFloat(process.env.USD_TO_USDT_RATE || '1.0'),

  CRON_AUTO_MATCH: process.env.CRON_AUTO_MATCH || '*/30 * * * * *',
  CRON_EXPIRE_SCAN: process.env.CRON_EXPIRE_SCAN || '0 */1 * * * *',

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  RUN_SEED_ON_BOOT: process.env.RUN_SEED_ON_BOOT || 'true',
  FRONTEND_DIST_PATH: process.env.FRONTEND_DIST_PATH || '../frontend/dist',

  // ========== Rate Limit（集中配置，海外用户勿过低） ==========
  //  登录：防暴力破解 —— 默认同一 IP 15 次/分钟
  RATE_LOGIN_WINDOW_MS: parseInt(process.env.RATE_LOGIN_WINDOW_MS || String(60 * 1000), 10),
  RATE_LOGIN_MAX:      parseInt(process.env.RATE_LOGIN_MAX      || '15', 10),
  //  询盘：防垃圾提交 —— 默认同一 IP 30 次/分钟（含表单、产品详情、OEM/Contact 多入口）
  RATE_INQUIRY_WINDOW_MS: parseInt(process.env.RATE_INQUIRY_WINDOW_MS || String(60 * 1000), 10),
  RATE_INQUIRY_MAX:      parseInt(process.env.RATE_INQUIRY_MAX      || '30', 10),
  //  订单：防重复创建/重放验证 —— 默认同一 IP 60 次/分钟（创建+Tx验证+轮询详情）
  RATE_ORDER_WINDOW_MS: parseInt(process.env.RATE_ORDER_WINDOW_MS || String(60 * 1000), 10),
  RATE_ORDER_MAX:      parseInt(process.env.RATE_ORDER_MAX      || '60', 10),
  //  上传：防高频写磁盘 —— 默认同一 IP 80 次/分钟（含产品、案例多图）
  RATE_UPLOAD_WINDOW_MS: parseInt(process.env.RATE_UPLOAD_WINDOW_MS || String(60 * 1000), 10),
  RATE_UPLOAD_MAX:      parseInt(process.env.RATE_UPLOAD_MAX      || '80', 10),
  //  统一 429 消息语言
  RATE_LIMIT_MESSAGE: process.env.RATE_LIMIT_MESSAGE || '请求过于频繁，请稍后再试。 | Too many requests, please try again later.',

  // ========== PHASE 2-C AI ==========
  //  §3 OPENAI_API_KEY 不能写死在代码
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_API_BASE: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  //  §51 默认 Provider — 未配置 OPENAI_API_KEY 强制 Mock
  AI_PROVIDER: (process.env.AI_PROVIDER as 'mock' | 'openai') || 'mock',
  //  §52 超时（默认 60s）
  AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS || '60000', 10),
  //  §31 预算保护：每日 / 每月 / 单 Lead 每日
  AI_DAILY_REQUEST_LIMIT: parseInt(process.env.AI_DAILY_REQUEST_LIMIT || '200', 10),
  AI_MONTHLY_REQUEST_LIMIT: parseInt(process.env.AI_MONTHLY_REQUEST_LIMIT || '3000', 10),
  AI_PER_LEAD_DAILY_LIMIT: parseInt(process.env.AI_PER_LEAD_DAILY_LIMIT || '5', 10),
  //  §33 队列并发 + 重试
  AI_CONCURRENCY: parseInt(process.env.AI_CONCURRENCY || '3', 10),
  AI_MAX_RETRIES: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
  //  §38 / §39 Mock provider 占位模型标识
  AI_MOCK_MODEL_ID: process.env.AI_MOCK_MODEL_ID || 'mock-researcher-v1',
  //  OpenAI 估算单价（USD / 1K tokens）用于成本统计
  AI_OPENAI_INPUT_PRICE_PER_1K: parseFloat(process.env.AI_OPENAI_INPUT_PRICE_PER_1K || '0.00015'),
  AI_OPENAI_OUTPUT_PRICE_PER_1K: parseFloat(process.env.AI_OPENAI_OUTPUT_PRICE_PER_1K || '0.0006'),

  // ---- 计算属性 ----
  get usdtContract(): string {
    return this.TRON_NETWORK === 'mainnet' ? this.USDT_CONTRACT_MAINNET : this.USDT_CONTRACT_NILE;
  },
  get trongridBase(): string {
    // PROD：主网、Nile分开域名
    return this.TRON_NETWORK === 'mainnet'
      ? 'https://api.trongrid.io'
      : 'https://nile.trongrid.io';
  },
};

export default env;

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

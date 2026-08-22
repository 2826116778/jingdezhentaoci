/**
 * LuxeCeramics 后端入口
 * - 加载 dotenv
 * - 连接 MongoDB
 * - 注册中间件（helmet/cors/JSON/静态上传/路由/错误）
 * - 启动 node-cron 支付监控
 */
import path from 'path';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { connectDB } from './config/db';
import errorHandler from './middleware/errorHandler';

import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import caseRoutes from './routes/cases';
import inquiryRoutes from './routes/inquiries';
import orderRoutes from './routes/orders';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin';
import { startPaymentCronJobs } from './jobs/paymentWatcher';
import { UPLOAD_URL_PREFIX } from './config/upload';

async function bootstrap() {
  const app = express();

  // 安全头（生产加严）
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS
  app.use(cors({
    origin: (origin, cb) => {
      // 允许无 origin（移动端/Postman），或匹配白名单
      if (!origin) return cb(null, true);
      const allowed = env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
      // 本地开发 + 任意子域也允许
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || allowed.some(a => origin.startsWith(a))) {
        return cb(null, true);
      }
      return cb(null, true); // 外贸站 CORS 宽松一些（如果需要生产收紧，注释掉上面两行启用这里的限制）
    },
    credentials: true,
    maxAge: 86400,
  }));

  // 静态目录：上传文件
  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use(UPLOAD_URL_PREFIX, express.static(uploadDir, { maxAge: '30d' }));

  // 解析 JSON
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // 根健康检查
  app.get('/healthz', (_req, res) => {
    res.json({ code: 0, message: 'ok', data: { service: 'luxeceramics-backend', time: new Date().toISOString(), env: env.NODE_ENV } });
  });

  // 路由挂载（前缀 /api）
  const prefix = env.API_PREFIX;
  app.use(prefix, authRoutes);
  app.use(prefix, productRoutes);
  app.use(prefix, caseRoutes);
  app.use(prefix, inquiryRoutes);
  app.use(prefix, orderRoutes);
  app.use(prefix, uploadRoutes);
  app.use(prefix, adminRoutes);

  // 404
  app.use((req, res) => {
    res.status(404).json({ code: 404, message: `Route not found: ${req.method} ${req.path}`, data: null });
  });

  // 全局错误
  app.use(errorHandler);

  // 连接 DB
  await connectDB();

  // 启动支付 cron
  startPaymentCronJobs();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`\n🚀 LuxeCeramics Backend running`);
    console.log(`   http://0.0.0.0:${env.PORT}`);
    console.log(`   Health: http://0.0.0.0:${env.PORT}/healthz`);
    console.log(`   API prefix: ${env.API_PREFIX}`);
    console.log(`   Node env: ${env.NODE_ENV} | MongoDB: ${env.MONGODB_URI.split('@').pop()}\n`);
  });

  // 优雅关机：关闭 cron 等
  const shutdown = async (signal: string) => {
    console.log(`[Shutdown] received ${signal}, closing HTTP server...`);
    server.close(() => {
      console.log('[Shutdown] HTTP closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10_000);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch(e => {
  console.error('❌ Bootstrap failed:', e);
  process.exit(1);
});

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
import { runSeed } from './seed/seedData';
import mongoose from 'mongoose';

/**
 * 如果没有本地 MongoDB（沙盒/Docker 容器环境常见），尝试启动 mongodb-memory-server
 * （进程内 ephemeral 实例，用完即丢，适合演示）。
 */
async function tryStartMemoryMongo(): Promise<string | null> {
  const envFlag = process.env.USE_MEMORY_MONGO;
  if (envFlag && String(envFlag).toLowerCase() !== 'true') return null;
  try {
    // @ts-ignore: 可选依赖，动态导入
    const mod = await import('mongodb-memory-server');
    const MongoMemoryServer = mod.MongoMemoryServer || mod.default?.MongoMemoryServer;
    if (!MongoMemoryServer) return null;
    console.log('[MongoDB] 未检测到本地 mongod → 启动 Memory Server（演示用，数据重启后丢失）…');
    const mongod = await MongoMemoryServer.create({
      instance: { dbName: 'luxeceramics' },
    });
    const uri = mongod.getUri();
    console.log(`[MongoDB] Memory Server started at ${uri}`);
    return uri;
  } catch (e) {
    if (envFlag === 'true') {
      console.warn('[MongoDB] USE_MEMORY_MONGO=true 但启动失败：', (e as Error).message);
    }
    return null;
  }
}

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
      // 允许无 origin（移动端/Postman/curl），或匹配白名单
      if (!origin) return cb(null, true);
      const allowed = env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
      // 本地开发 + 任意子域也允许
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || allowed.some(a => origin.startsWith(a))) {
        return cb(null, true);
      }
      // ⚠️ 安全修复：未知 origin 不再兜底放行
      // （之前的 return cb(null, true) + credentials:true 会导致跨站任意域携带JWT发起请求，存在CSRF风险）
      // 如果前端部署域名不是 localhost，请到 backend/.env 把 CORS_ORIGIN 设置为正确的前端域名（多个用 , 分隔）
      return cb(new Error(`CORS blocked: origin ${origin} not in CORS_ORIGIN whitelist`));
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

  // ===== 托管前端 dist（SPA，同源部署）必须放在全局 404 之前 =====
  const frontDist = path.resolve(process.cwd(), env.FRONTEND_DIST_PATH);
  const frontDistValid = fs.existsSync(frontDist) && fs.existsSync(path.join(frontDist, 'index.html'));

  // `/images` 额外托管前端 public/images 下的真实陶瓷产品/分类/主视觉图
  // （public/images 不经过 vite 打包复制，但 SPA 又需要直接访问它们）
  const publicImagesDirCandidates = [
    path.resolve(process.cwd(), '../frontend/public/images'),
    path.resolve(process.cwd(), '../../frontend/public/images'),
    path.resolve(process.cwd(), 'src/assets/images'),
  ];
  const publicImagesDir = publicImagesDirCandidates.find(d => fs.existsSync(d));
  if (publicImagesDir) {
    console.log(`[Bootstrap] 托管额外 /images 目录 → ${publicImagesDir}`);
    app.use('/images', express.static(publicImagesDir, { maxAge: '7d' }));
  }

  if (frontDistValid) {
    console.log(`[Bootstrap] 托管前端静态目录：${frontDist}`);
    app.use(express.static(frontDist, { maxAge: '1d', index: false }));
    // SPA fallback：除了 /healthz、/api/*、/uploads/* 以外，所有 GET 都返回 index.html
    app.get('*', (req, res, next) => {
      const p = req.path;
      if (p.startsWith(env.API_PREFIX) || p.startsWith(UPLOAD_URL_PREFIX) || p === '/healthz') {
        return next();
      }
      res.sendFile(path.join(frontDist, 'index.html'));
    });
  } else {
    console.warn(`[Bootstrap] 前端 dist 不存在（${frontDist}），跳过 SPA 托管。如果需要同源部署请 build frontend。`);
  }

  // 全局 404：
  // - /api/*  /uploads/*  /healthz 命中不到，返回 JSON 404（原行为）
  // - 其他路径：如果启用了 SPA 托管，应该已经被上面的 app.get('*') 消费掉了。
  //            此处做双重保护：GET/HEAD 非 API 路径就回 index.html；其他方法或前缀仍返回 JSON。
  app.use((req, res) => {
    const p = req.path;
    const isApiLike = p.startsWith(env.API_PREFIX) || p.startsWith(UPLOAD_URL_PREFIX) || p === '/healthz';
    if (!isApiLike && frontDistValid && (req.method === 'GET' || req.method === 'HEAD')) {
      return res.sendFile(path.join(frontDist, 'index.html'));
    }
    res.status(404).json({ code: 404, message: `Route not found: ${req.method} ${req.path}`, data: null });
  });

  // 全局错误
  app.use(errorHandler);

  // 连接 DB：优先内存 MongoDB（适合演示/没装 MongoDB 的容器环境）
  const memoryUri = await tryStartMemoryMongo();
  let finalMongoUri = env.MONGODB_URI;
  if (memoryUri) {
    (env as any).MONGODB_URI = memoryUri;
    finalMongoUri = memoryUri;
  }
  // 临时断开已失败的连接（如之前被静态 require 触发过）
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  try {
    await connectDB(finalMongoUri);
  } catch (dbErr: any) {
    console.warn('[Bootstrap] ⚠️  MongoDB 连接失败（' + (dbErr?.message || dbErr) + '）。前端静态页面仍可访问，但登录/询盘等 DB 操作会报错。');
  }

  // 首次播种（幂等）
  if (String(env.RUN_SEED_ON_BOOT).toLowerCase() === 'true') {
    try {
      console.log('[Bootstrap] RUN_SEED_ON_BOOT=true → 运行 seeds…');
      await (runSeed as any)(true);
    } catch (e: any) {
      console.warn('[Bootstrap] seed 执行失败（可能已 seed 过）：', e?.message || e);
    }
  }

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

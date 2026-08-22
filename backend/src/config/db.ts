/**
 * MongoDB 连接 — 使用 Mongoose
 */
import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB() {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      autoIndex: true,
      maxPoolSize: 10,
    });
    console.log(`[MongoDB] Connected ✅ → ${env.MONGODB_URI.split('@').pop()}`);
  } catch (e) {
    console.error('[MongoDB] Connect failed ❌', e);
    process.exit(1);
  }
}

export default mongoose;

/**
 * MongoDB 连接 — 使用 Mongoose
 */
import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(overrideUri?: string) {
  try {
    await mongoose.connect(overrideUri || env.MONGODB_URI, {
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });
    const uri = overrideUri || env.MONGODB_URI;
    console.log(`[MongoDB] Connected ✅ → ${uri.split('@').pop()}`);
  } catch (e) {
    console.error('[MongoDB] Connect failed ❌', e);
    throw e;
  }
}

export default mongoose;

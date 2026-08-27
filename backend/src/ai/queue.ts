/**
 * PHASE 2-C §33 批量 AI 研究队列
 *
 * 不允许 Promise.all(1000) 打爆 API；必须用并发上限 + 重试 + 指数退避 + 超时。
 * 单进程内的简易队列，足以支撑同租户批量 50/100 Lead 的研究（§32 二次确认后入队）。
 *
 * 用法：
 *   const q = new AIQueue({ concurrency: env.AI_CONCURRENCY });
 *   const promises = leadIds.map(id => q.enqueue(() => runResearch(id)));
 *   const results = await Promise.allSettled(promises);
 */
import { env } from '../config/env';

export interface AIQueueOpts {
  concurrency?: number;
  maxRetries?: number;
  baseDelayMs?: number;     // 退避起始
  maxDelayMs?: number;
}

export class AIQueue {
  private concurrency: number;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private running = 0;
  private waitQueue: Array<() => void> = [];

  constructor(opts: AIQueueOpts = {}) {
    this.concurrency = Math.max(1, opts.concurrency ?? env.AI_CONCURRENCY);
    this.maxRetries  = Math.max(0, opts.maxRetries ?? env.AI_MAX_RETRIES);
    this.baseDelayMs = Math.max(100, opts.baseDelayMs ?? 500);
    this.maxDelayMs  = Math.max(this.baseDelayMs, opts.maxDelayMs ?? 8000);
  }

  async enqueue<T>(task: () => Promise<T>, opts: { retries?: number } = {}): Promise<T> {
    await this.acquire();
    try {
      const maxRetry = opts.retries ?? this.maxRetries;
      let lastErr: any;
      for (let attempt = 0; attempt <= maxRetry; attempt++) {
        try {
          return await task();
        } catch (e: any) {
          lastErr = e;
          // 不可重试错误（BUDGET_EXCEEDED / INVALID_JSON / NOT_CONFIGURED / CANCELLED / PERMISSION_DENIED）
          const k = e?.kind;
          if (k === 'BUDGET_EXCEEDED' || k === 'INVALID_JSON' || k === 'NOT_CONFIGURED'
            || k === 'CANCELLED' || k === 'PERMISSION_DENIED') {
            throw e;
          }
          if (attempt >= maxRetry) break;
          const delay = Math.min(this.maxDelayMs, this.baseDelayMs * Math.pow(2, attempt) + Math.random() * 200);
          await sleep(delay);
        }
      }
      throw lastErr;
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.running < this.concurrency) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.waitQueue.push(() => { this.running++; resolve(); }));
  }

  private release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      // 把"获取下一个 slot"的 resolve 放到下一 tick，避免运行计数错乱
      setImmediate(() => next());
    } else {
      this.running--;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

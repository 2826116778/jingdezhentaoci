/**
 * paymentWatcher — node-cron 支付监控
 * 2 个任务：
 *  1) cronAutoMatch: 每 30s → 扫 pending 订单 → 调 Trongrid v1/accounts/ 列表 TRC20 转入 → 6 项校验 → processPaymentSuccess
 *  2) cronExpireScan: 每分钟 → 扫 paymentStatus=pending && orderExpireAt < now → 置 expired
 *
 * 并提供公共函数 processPaymentSuccess(order, txHash, raw, confs, source) 供：
 *   - cron 自动命中
 *   - /orders/:orderNo/verify-tx 手动触发命中
 * 两者复用；DB 层唯一索引 + findOneAndUpdate 原子操作保证幂等
 */
import { CronJob } from 'cron';
import { Types } from 'mongoose';
import Order, { IOrder } from '../models/Order';
import { env } from '../config/env';
import {
  listAccountTRC20Transfers,
  getTransactionById,
  getTransactionInfoById,
  getNowBlock,
  TRC20Event,
} from '../utils/tronClient';
import { validateUSDTTransfer } from '../utils/paymentValidator';
import { logPayment, writePaymentLog } from '../utils/logger';
import { notifyOrderPaid } from '../utils/email';

// ---------- 公共：命中成功后的幂等写入 ----------
export type ProcessResult =
  | { ok: true; paid: boolean; order: IOrder }
  | { ok: false; code: string; message: string; order?: IOrder };

/**
 * 将一笔订单标记为 paid（写入 txHash、chainTxRaw 等）
 * 强幂等：
 *  1) txHash 唯一索引（DB 层阻止同一 hash 用于多订单）
 *  2) findOneAndUpdate 原子：只能是 status=pending/expired(不允许 expired 变 paid) 且 txHash 不存在
 *     如果已有 txHash == 相同 hash → 视为重复，返回成功（但 paid 标志为 false：实际没有新写入）
 */
export async function processPaymentSuccess(
  orderId: Types.ObjectId | string,
  txHash: string,
  chainTxRaw: any,
  confirmations: number,
  matchSource: 'cron-auto' | 'user-trigger',
): Promise<ProcessResult> {
  const id = typeof orderId === 'string' ? new Types.ObjectId(orderId) : orderId;
  const txId = txHash.trim();

  // 先查一遍，做一些日志
  let order = await Order.findById(id);
  if (!order) return { ok: false, code: 'ORDER_NOT_FOUND', message: 'order not found' };

  // 1. 已 paid 且 txHash 相同 → 幂等重复，直接返回成功（paid=false 表示"没新动作"）
  if (order.paymentStatus === 'paid') {
    if (order.txHash === txId) {
      return { ok: true, paid: false, order };
    }
    return {
      ok: false,
      code: 'ALREADY_PAID_OTHER_TX',
      message: `order already paid with txHash=${order.txHash}, cannot set another tx=${txId}`,
      order,
    };
  }
  // 2. 过期订单不允许 paid
  if (order.paymentStatus === 'expired') {
    return { ok: false, code: 'ORDER_EXPIRED', message: 'order already expired' };
  }

  // 3. 唯一性预查：该 txHash 是否已属于其他订单（DB 唯一索引会兜底，但这里给出更清晰的错误）
  const conflict = await Order.findOne({ txHash: txId, _id: { $ne: order._id } });
  if (conflict) {
    writePaymentLog(order.orderNo, [`[processPaymentSuccess] ❌ txHash=${txId} already used by order=${conflict.orderNo}`]);
    return { ok: false, code: 'DUPLICATE_TX_HASH', message: 'TX hash already used by another order' };
  }

  // 4. 原子 CAS 写入（findOneAndUpdate：要求原状态仍为 pending 且 txHash 仍不存在）
  try {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: 'pending', txHash: { $exists: false } },
      {
        $set: {
          paymentStatus: 'paid',
          txHash: txId,
          chainTxRaw,
          blockConfirmations: confirmations,
          paidAt: new Date(),
          matchSource,
          lastCheckedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!updated) {
      // 并发竞态：其他协程已写入。二次读取返回状态
      order = (await Order.findById(order._id)) || order;
      if (order.paymentStatus === 'paid' && order.txHash === txId) {
        return { ok: true, paid: false, order };
      }
      return { ok: false, code: 'RACE_CONDITION', message: 'order no longer pending, retry later', order };
    }
    logPayment(order.orderNo, `✅ PAID (${matchSource}) tx=${txId.slice(0, 16)}… confirmations=${confirmations} usdt=${updated.usdtAmount}`);
    // 异步触发通知，不阻塞主流程
    notifyOrderPaid(updated).catch(err => console.error('[PaymentWatcher] notifyOrderPaid error:', err));
    return { ok: true, paid: true, order: updated };
  } catch (e: any) {
    // 唯一索引兜底命中 → Mongo 11000
    if (e?.code === 11000) {
      return { ok: false, code: 'DUPLICATE_TX_HASH', message: 'TX hash already used (Mongo unique index)' };
    }
    console.error('[processPaymentSuccess] Mongo error:', e);
    return { ok: false, code: 'DB_ERROR', message: String(e?.message || e) };
  }
}

// ---------- 辅助：对单笔订单 + 一条 TRC20 事件 or 一个 txHash 做完整校验并可能更新 paid ----------
export async function tryMatchOrderByEvent(
  order: IOrder,
  ev: TRC20Event,
): Promise<ProcessResult> {
  // 1. 预过滤：事件 to == 商户钱包 且 contract == USDT
  if (!ev.to || ev.to !== order.walletAddress) return { ok: false, code: 'SKIP_TO', message: 'to mismatch' };
  const contract = ev.token_info?.address;
  if (!contract || contract !== order.usdtContractAddress) {
    return { ok: false, code: 'SKIP_CONTRACT', message: 'contract mismatch' };
  }
  return tryMatchOrderByTxHash(order, ev.transaction_id);
}

export async function tryMatchOrderByTxHash(order: IOrder, txHash: string): Promise<ProcessResult> {
  if (order.paymentStatus !== 'pending') {
    return { ok: false, code: 'NOT_PENDING', message: `order status=${order.paymentStatus}` };
  }

  const lines: string[] = [];
  lines.push(`[tryMatchOrderByTxHash] tx=${txHash}`);

  // 拉当前区块号
  const b = await getNowBlock();
  if (!b.ok) { lines.push('  getNowBlock FAIL: ' + b.message); writePaymentLog(order.orderNo, lines); return { ok: false, code: b.code, message: b.message }; }
  const currentBlock = b.data;
  lines.push(`  currentBlock=${currentBlock}`);

  // 拉 txInfo + txRaw
  const [info, raw] = await Promise.all([getTransactionInfoById(txHash), getTransactionById(txHash)]);
  if (!info.ok) { lines.push('  getTxInfo FAIL: ' + info.message); writePaymentLog(order.orderNo, lines); return { ok: false, code: info.code, message: info.message }; }
  if (!raw.ok) { lines.push('  getTxRaw FAIL: ' + raw.message); writePaymentLog(order.orderNo, lines); return { ok: false, code: raw.code, message: raw.message }; }

  const expectedSun = BigInt(Math.round(order.usdtAmount * 1_000_000));

  const v = validateUSDTTransfer({
    txInfo: info.data,
    txRaw: raw.data,
    expectedContract: order.usdtContractAddress,
    expectedTo: order.walletAddress,
    expectedAmountSun: expectedSun,
    tolerancePct: order.usdtTolerance,
    requiredConfirmations: env.REQUIRED_CONFIRMATIONS,
    orderCreatedAt: order.createdAt,
    orderExpireAt: order.orderExpireAt,
    currentBlock,
  });

  lines.push(`  validate=${v.ok ? 'OK' : 'FAIL reason=' + v.reason}, confirmations=${v.confirmations ?? 'n/a'}, amountSun=${v.amountSun?.toString() ?? 'n/a'}`);

  if (!v.ok) {
    // 更新 lastCheckedAt
    await Order.findByIdAndUpdate(order._id, { $set: { lastCheckedAt: new Date() } });
    writePaymentLog(order.orderNo, lines);
    return { ok: false, code: 'VALIDATE_FAIL', message: v.reason || 'validation failed' };
  }

  writePaymentLog(order.orderNo, lines);
  return processPaymentSuccess(order._id, txHash, { info: info.data, raw: raw.data }, v.confirmations || env.REQUIRED_CONFIRMATIONS, 'cron-auto');
}

// ---------- 两个 cron 任务 ----------
async function doCronAutoMatch() {
  const t0 = Date.now();
  try {
    const pending = await Order.find({
      paymentStatus: 'pending',
      orderExpireAt: { $gt: new Date() },
    }).sort({ createdAt: 1 }).limit(200);
    if (!pending.length) return;

    // 取 [最早订单的 createdAt - 30s, 现在]
    const minTs = Math.max(0, pending[0].createdAt.getTime() - 30_000);
    const maxTs = Date.now();
    const transfers = await listAccountTRC20Transfers(env.MERCHANT_WALLET_TRON, {
      onlyTo: true,
      contract: env.usdtContract,
      minTs, maxTs, limit: 200,
    });
    if (!transfers.ok) {
      console.warn('[CronAutoMatch] Trongrid list failed:', transfers.message);
      return;
    }
    const events = transfers.data.data || [];
    logPayment('__cron__', `Scan ${pending.length} pending orders, ${events.length} TRC20 events in window (${(Date.now()-t0)}ms fetch)`);

    // 对每笔订单尝试匹配事件（先按金额粗筛 + 事件窗口）
    for (const order of pending) {
      const expectedSun = BigInt(Math.round(order.usdtAmount * 1_000_000));
      const tolerance = order.usdtTolerance;
      // 遍历事件找候选（from/contract/to 一致 + 金额 ±tolerance + blockTs 在窗口）
      const candidates = events.filter(ev => {
        if (ev.to !== order.walletAddress) return false;
        const contract = ev.token_info?.address;
        if (contract !== order.usdtContractAddress) return false;
        const v = BigInt(String(ev.value));
        const diff = v > expectedSun ? v - expectedSun : expectedSun - v;
        const scaled = diff * 10000n;
        const limit = expectedSun * BigInt(Math.round(tolerance * 10000));
        if (scaled > limit) return false;
        const ts = ev.block_timestamp;
        return ts >= order.createdAt.getTime() - 30_000 && ts <= order.orderExpireAt.getTime();
      });
      for (const ev of candidates) {
        const r = await tryMatchOrderByEvent(order, ev);
        if (r.ok && r.paid) break; // 本订单已解决
      }
      // 记录 lastCheckedAt
      await Order.findByIdAndUpdate(order._id, { $set: { lastCheckedAt: new Date() } });
    }
  } catch (e) {
    console.error('[CronAutoMatch] Unexpected error', e);
  } finally {
    logPayment('__cron__', `AutoMatch round end (${Date.now()-t0}ms total)`);
  }
}

async function doCronExpireScan() {
  try {
    const now = new Date();
    const r = await Order.updateMany(
      { paymentStatus: 'pending', orderExpireAt: { $lt: now } },
      { $set: { paymentStatus: 'expired', expiredAt: now } },
    );
    if (r.modifiedCount > 0) {
      console.log(`[CronExpireScan] Marked ${r.modifiedCount} orders as expired`);
    }
  } catch (e) {
    console.error('[CronExpireScan] error', e);
  }
}

export function startPaymentCronJobs() {
  if (!env.MERCHANT_WALLET_TRON) {
    console.warn('[PaymentCron] ⚠️ MERCHANT_WALLET_TRON 未配置，cron 任务已跳过。请在 backend/.env 中写入商户钱包地址。');
    return;
  }
  const job1 = new CronJob(env.CRON_AUTO_MATCH, doCronAutoMatch, null, false, 'UTC');
  const job2 = new CronJob(env.CRON_EXPIRE_SCAN, doCronExpireScan, null, false, 'UTC');
  job1.start();
  job2.start();
  console.log(`[PaymentCron] ✅ 已启动：AutoMatch (${env.CRON_AUTO_MATCH}) / ExpireScan (${env.CRON_EXPIRE_SCAN})`);
  console.log(`[PaymentCron] 链=${env.TRON_NETWORK} | 商户钱包=${env.MERCHANT_WALLET_TRON}`);
  console.log(`[PaymentCron] USDT合约=${env.usdtContract} | 确认数>=${env.REQUIRED_CONFIRMATIONS} | 容错=${(env.USDT_TOLERANCE*100).toFixed(2)}%`);
}

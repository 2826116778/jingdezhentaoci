/**
 * 订单路由（真实 TRC20-USDT）
 * 公开：
 *   POST /orders                     创建订单（联系信息+商品），返回订单 + qrcodeBase64
 *   GET  /orders/:orderNo            订单状态（给前端轮询）
 *   POST /orders/:orderNo/verify-tx  用户手动输入 txHash → 辅助触发校验（绝不直接 paid）
 *   GET  /orders/:orderNo/qrcode     重新生成二维码（可选）
 * 管理（JWT）：
 *   GET  /orders                     管理列表
 *   GET  /orders/:id                 详情
 *   PATCH /orders/:id/status         改状态（预留：客服手动 paid/refund 等）
 */
import { Router } from 'express';
import QRCode from 'qrcode';
import Order, { IOrder, OrderItem, ContactInfo } from '../models/Order';
import { env } from '../config/env';
import { authJWT } from '../middleware/authJWT';
import { success, fail } from '../utils/response';
import { tryMatchOrderByTxHash } from '../jobs/paymentWatcher';

const router = Router();

/**
 * 生成订单号：OC + YYYYMMDD + 6位随机数字字母
 */
function genOrderNo() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const ymd = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `OC${ymd}${rnd}`;
}

/**
 * 构造支付二维码数据字符串
 * 通用：tron:<to>?amount=<usdt>&contract=<usdtContract>
 */
function makeQrString(wallet: string, usdt: number, contract: string) {
  return `tron:${wallet}?amount=${usdt.toFixed(6)}&contract=${contract}&token=USDT`;
}

/**
 * 创建订单
 */
router.post('/orders', async (req, res, next) => {
  try {
    const body = req.body || {};
    const items = (body.items || []) as OrderItem[];
    if (!items.length) return fail(res, '购物车不能为空');
    const contact = body.contactInfo as ContactInfo;
    if (!contact?.name || !contact?.email || !contact?.whatsapp) {
      return fail(res, '姓名/邮箱/WhatsApp 为必填项');
    }

    const total = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);
    if (!(total > 0)) return fail(res, '订单总额必须大于 0');
    const usdtAmount = +(total * env.USD_TO_USDT_RATE).toFixed(6);

    const order = new Order({
      orderNo: genOrderNo(),
      items: items.map(i => ({
        productId: i.productId,
        name: i.name,
        price: Number(i.price),
        qty: Number(i.qty),
      })),
      totalAmount: +total.toFixed(2),
      usdtAmount,
      usdtTolerance: env.USDT_TOLERANCE,
      contactInfo: {
        name: contact.name,
        email: contact.email,
        whatsapp: contact.whatsapp,
        shippingAddress: contact.shippingAddress || '',
      },
      customDemand: body.customDemand || '',
      paymentMethod: 'USDT-TRC20',
      orderExpireAt: new Date(Date.now() + env.ORDER_TTL_MINUTES * 60_000),
      walletAddress: env.MERCHANT_WALLET_TRON,
      tronNetwork: env.TRON_NETWORK,
      usdtContractAddress: env.usdtContract,
      paymentStatus: 'pending',
    });
    await order.save();

    // 生成二维码 base64
    const qr = await QRCode.toDataURL(makeQrString(order.walletAddress, order.usdtAmount, order.usdtContractAddress), {
      margin: 2, width: 400, color: { dark: '#2C2A26', light: '#FAF7F2' },
    });

    return success(res, {
      orderNo: order.orderNo,
      totalAmount: order.totalAmount,
      usdtAmount: order.usdtAmount,
      usdtTolerance: order.usdtTolerance,
      walletAddress: order.walletAddress,
      tronNetwork: order.tronNetwork,
      usdtContractAddress: order.usdtContractAddress,
      orderExpireAt: order.orderExpireAt,
      createdAt: order.createdAt,
      items: order.items,
      contactInfo: order.contactInfo,
      customDemand: order.customDemand,
      qrcodeBase64: qr,
    }, '订单创建成功', 201);
  } catch (e) { next(e); }
});

/**
 * 查询订单状态（按 orderNo）
 */
router.get('/orders/:orderNo', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderNo: req.params.orderNo }).lean();
    if (!order) return fail(res, '订单不存在', 404, 404);

    const ttlMs = Math.max(0, order.orderExpireAt.getTime() - Date.now());
    const isExpired = order.paymentStatus === 'pending' && ttlMs === 0;
    // 真实 expired status 会由 cron 写入，但这里前端也做一次显示判断
    const displayStatus = isExpired ? 'expired' : order.paymentStatus;

    return success(res, {
      orderNo: order.orderNo,
      items: order.items,
      totalAmount: order.totalAmount,
      usdtAmount: order.usdtAmount,
      usdtTolerance: order.usdtTolerance,
      walletAddress: order.walletAddress,
      tronNetwork: order.tronNetwork,
      usdtContractAddress: order.usdtContractAddress,
      orderExpireAt: order.orderExpireAt,
      createdAt: order.createdAt,
      contactInfo: order.contactInfo,
      customDemand: order.customDemand,
      paymentStatus: displayStatus,
      confirmations: order.blockConfirmations,
      paidAt: order.paidAt,
      expiredAt: order.expiredAt,
      txHashShort: order.txHash ? order.txHash.slice(0, 12) + '…' : undefined,
      lastCheckedAt: order.lastCheckedAt,
      ttlSeconds: Math.ceil(ttlMs / 1000),
    });
  } catch (e) { next(e); }
});

/**
 * 重新拉二维码
 */
router.get('/orders/:orderNo/qrcode', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderNo: req.params.orderNo }).lean();
    if (!order) return fail(res, '订单不存在', 404);
    const qr = await QRCode.toDataURL(
      makeQrString(order.walletAddress, order.usdtAmount, order.usdtContractAddress),
      { margin: 2, width: 400, color: { dark: '#2C2A26', light: '#FAF7F2' } },
    );
    return success(res, { qrcodeBase64: qr, walletAddress: order.walletAddress, usdtAmount: order.usdtAmount });
  } catch (e) { next(e); }
});

/**
 * 手动输入 txHash → 辅助触发校验（绝不直接 paid）
 * 行为：
 *  - 写 userSubmittedTxHash 字段
 *  - 调 tryMatchOrderByTxHash 做 6 项校验
 *  - 失败则仍保持 pending，返回 willRecheck=true + message
 *  - 成功则订单变 paid
 *  - 同一 txHash 被其他订单占用 → 返回 409 DUPLICATE_TX_HASH
 */
router.post('/orders/:orderNo/verify-tx', async (req, res, next) => {
  try {
    const { txHash } = req.body || {};
    if (!txHash || typeof txHash !== 'string' || txHash.trim().length < 40) {
      return fail(res, '请输入正确的交易哈希（TXID）');
    }
    const order = await Order.findOne({ orderNo: req.params.orderNo });
    if (!order) return fail(res, '订单不存在', 404);
    if (order.paymentStatus === 'expired') return fail(res, '订单已过期，请重新下单', 410);
    if (order.paymentStatus === 'paid') {
      return success(res, { alreadyPaid: true, txHash: order.txHash, paidAt: order.paidAt }, '订单已支付成功');
    }
    if (order.paymentStatus !== 'pending') return fail(res, `当前订单状态=${order.paymentStatus}，无法校验`);

    // 记录用户提交的 hash
    order.userSubmittedTxHash = txHash.trim();
    await order.save();

    const r = await tryMatchOrderByTxHash(order, txHash.trim());
    // 把 matchSource 修正为 user-trigger（如果命中成功且匹配了）
    if (r.ok && r.paid && r.order.matchSource !== 'user-trigger') {
      r.order.matchSource = 'user-trigger';
      await Order.findByIdAndUpdate(r.order._id, { $set: { matchSource: 'user-trigger' } });
    }

    if (r.ok) {
      if (r.paid) {
        return success(res, {
          paid: true,
          orderNo: r.order.orderNo,
          paymentStatus: r.order.paymentStatus,
          paidAt: r.order.paidAt,
          txHash: r.order.txHash,
          confirmations: r.order.blockConfirmations,
        }, '支付成功，感谢您的订购');
      }
      return success(res, { alreadyPaid: true }, '订单已支付');
    }
    // 失败：保持 pending，返回友好消息
    const msg = r.code === 'DUPLICATE_TX_HASH'
      ? '该交易哈希已被其他订单占用，请检查 TXID 是否正确。'
      : r.code === 'ORDER_EXPIRED'
        ? '订单已过期，请重新下单'
        : r.code === 'VALIDATE_FAIL'
          ? `链上校验未通过：${r.message}。后台每 30 秒自动扫描一次，请耐心等待或检查 TXID 是否正确。`
          : `暂时无法确认（${r.code}:${r.message}）。后台每 30 秒自动扫描，若已转账请耐心等待。`;
    return success(res, {
      paid: false,
      willRecheck: true,
      why: r.code,
      detail: r.message,
      paymentStatus: 'pending',
    }, msg);
  } catch (e: any) {
    // Mongo 11000 = txHash 唯一索引冲突
    if (e?.code === 11000) {
      return res.status(409).json({ code: 409, message: '该交易哈希已被其他订单占用（DUPLICATE_TX_HASH）', data: null });
    }
    next(e);
  }
});

// -------- 管理 --------
router.get('/orders', authJWT(), async (req, res, next) => {
  try {
    const { page = '1', limit = '20', status } = req.query as any;
    const q: any = {};
    if (status) q.paymentStatus = status;
    const pageN = Math.max(1, Number(page));
    const limitN = Math.min(200, Math.max(1, Number(limit)));
    const [list, total] = await Promise.all([
      Order.find(q).sort({ createdAt: -1 }).skip((pageN - 1) * limitN).limit(limitN).lean(),
      Order.countDocuments(q),
    ]);
    return success(res, { list, total, page: pageN, limit: limitN });
  } catch (e) { next(e); }
});

router.patch('/orders/:id/status', authJWT(), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['pending', 'paid', 'expired', 'failed', 'refunded', 'cancelled'].includes(status)) return fail(res, '无效 status');
    const r = await Order.findByIdAndUpdate(req.params.id, { $set: { paymentStatus: status } }, { new: true });
    if (!r) return fail(res, '订单不存在', 404);
    return success(res, r.toObject());
  } catch (e) { next(e); }
});

// ------- 按 _id 查询 / 校验（前端 Checkout / 后台统一调用） -------
router.get('/orders/id/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const order = /^[0-9a-fA-F]{24}$/.test(id)
      ? await Order.findById(id).lean()
      : await Order.findOne({ orderNo: id }).lean();
    if (!order) return fail(res, '订单不存在', 404);

    const ttlMs = Math.max(0, order.orderExpireAt.getTime() - Date.now());
    const isExpired = order.paymentStatus === 'pending' && ttlMs === 0;
    const displayStatus: any = isExpired ? 'expired' : order.paymentStatus;
    const summary = {
      _id: order._id,
      orderNo: order.orderNo,
      items: order.items,
      amount: order.usdtAmount,
      usdtAmount: order.usdtAmount,
      usdtTolerance: order.usdtTolerance,
      walletAddress: order.walletAddress,
      merchantAddress: order.walletAddress,
      tronNetwork: order.tronNetwork,
      usdtContractAddress: order.usdtContractAddress,
      orderExpireAt: order.orderExpireAt,
      createdAt: order.createdAt,
      contactInfo: order.contactInfo,
      customDemand: order.customDemand,
      paymentStatus: displayStatus,
      confirmations: order.blockConfirmations,
      blockConfirmations: order.blockConfirmations,
      paidAt: order.paidAt,
      expiredAt: order.expiredAt,
      txHash: order.txHash,
      txHashShort: order.txHash ? order.txHash.slice(0, 12) + '…' : undefined,
      lastCheckedAt: order.lastCheckedAt,
      ttlSeconds: Math.ceil(ttlMs / 1000),
    };
    return success(res, summary);
  } catch (e) { next(e); }
});

// 按 ID 手动校验 TX
router.post('/orders/id/:id/verify-tx', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { txHash } = req.body || {};
    if (!txHash || typeof txHash !== 'string' || txHash.trim().length < 40) {
      return fail(res, '请输入正确的交易哈希（TXID）');
    }
    const order = /^[0-9a-fA-F]{24}$/.test(id)
      ? await Order.findById(id)
      : await Order.findOne({ orderNo: id });
    if (!order) return fail(res, '订单不存在', 404);
    if (order.paymentStatus === 'expired') return fail(res, '订单已过期，请重新下单', 410);
    if (order.paymentStatus === 'paid') {
      return success(res, {
        paid: true,
        status: 'paid',
        txHash: order.txHash,
        paidAt: order.paidAt,
        msg: '订单已支付成功',
      });
    }
    if (order.paymentStatus !== 'pending') return fail(res, `当前订单状态=${order.paymentStatus}，无法校验`);

    order.userSubmittedTxHash = txHash.trim();
    await order.save();

    const r = await tryMatchOrderByTxHash(order, txHash.trim());
    if (r.ok && r.paid && r.order.matchSource !== 'user-trigger') {
      r.order.matchSource = 'user-trigger';
      await Order.findByIdAndUpdate(r.order._id, { $set: { matchSource: 'user-trigger' } });
    }

    if (r.ok && r.paid) {
      return success(res, {
        paid: true,
        status: 'paid',
        txHash: r.order.txHash,
        paidAt: r.order.paidAt,
        msg: '支付成功，感谢您的订购',
      });
    }
    if (r.ok) {
      return success(res, { status: order.paymentStatus, msg: '订单已支付' });
    }
    const msg = r.code === 'DUPLICATE_TX_HASH'
      ? '该交易哈希已被其他订单占用，请检查 TXID 是否正确。'
      : r.code === 'ORDER_EXPIRED'
        ? '订单已过期，请重新下单'
        : r.code === 'VALIDATE_FAIL'
          ? `链上校验未通过：${r.message}。后台每 30 秒自动扫描一次，请耐心等待或检查 TXID 是否正确。`
          : `暂时无法确认（${r.code}:${r.message}）。后台每 30 秒自动扫描，若已转账请耐心等待。`;
    return success(res, {
      paid: false,
      status: 'pending',
      willRecheck: true,
      why: r.code,
      detail: r.message,
      txHash: txHash.trim(),
      msg,
    }, msg);
  } catch (e: any) {
    if (e?.code === 11000) {
      return res.status(409).json({ code: 409, message: '该交易哈希已被其他订单占用（DUPLICATE_TX_HASH）', data: null });
    }
    next(e);
  }
});

export default router;

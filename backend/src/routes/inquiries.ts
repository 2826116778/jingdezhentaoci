/**
 * 询盘路由
 * 公开：
 *   POST /inquiries          提交询盘 → 写 DB + 邮件通知运营
 * 管理（JWT）：
 *   GET  /inquiries          列表（分页、筛选 status/source/keyword、按时间倒序）
 *   GET  /inquiries/export   导出 CSV（带 UTF-8 BOM，防中文乱码）
 *   GET  /inquiries/:id      详情
 *   PATCH /inquiries/:id/status  更新 status
 */
import { Router } from 'express';
import Inquiry from '../models/Inquiry';
import { authJWT, AuthRequest } from '../middleware/authJWT';
import { success, fail } from '../utils/response';
import { notifyNewInquiry } from '../utils/email';
import { Types } from 'mongoose';
import { Parser } from 'json2csv';

const router = Router();

// 客户提交
router.post('/inquiries', async (req, res, next) => {
  try {
    const body = req.body || {};
    const { name, email, whatsapp } = body;
    if (!name || !email || !whatsapp) return fail(res, '姓名/邮箱/WhatsApp 为必填项', 400);

    const inquiry = new Inquiry({
      name, email, whatsapp,
      country: body.country || '',
      company: body.company || '',
      quantity: body.quantity ? Number(body.quantity) : undefined,
      customDemand: body.customDemand || '',
      productId: body.productId && Types.ObjectId.isValid(body.productId) ? new Types.ObjectId(body.productId) : undefined,
      productName: body.productName || '',
      status: 'new',
      source: body.source || 'contact',
    });
    await inquiry.save();

    // 异步通知，不阻塞响应
    notifyNewInquiry({
      id: String(inquiry._id),
      name: inquiry.name,
      email: inquiry.email,
      whatsapp: inquiry.whatsapp,
      country: inquiry.country,
      company: inquiry.company,
      quantity: inquiry.quantity,
      customDemand: inquiry.customDemand,
      productName: inquiry.productName,
      source: inquiry.source,
    }).catch(err => console.error('[inquiry route] notify error', err));

    return success(res, { id: inquiry._id, status: inquiry.status }, '提交成功', 201);
  } catch (e) { next(e); }
});

// 管理：列表
router.get('/inquiries', authJWT(), async (req, res, next) => {
  try {
    const { page = '1', limit = '20', status, source, keyword } = req.query as any;
    const q: any = {};
    if (status) q.status = status;
    if (source) q.source = source;
    if (keyword) {
      const reg = { $regex: new RegExp(String(keyword), 'i') };
      q.$or = [{ name: reg }, { email: reg }, { whatsapp: reg }, { productName: reg }, { customDemand: reg }];
    }
    const pageN = Math.max(1, Number(page));
    const limitN = Math.min(200, Math.max(1, Number(limit)));
    const skip = (pageN - 1) * limitN;
    const [list, total] = await Promise.all([
      Inquiry.find(q).sort({ createdAt: -1 }).skip(skip).limit(limitN).lean(),
      Inquiry.countDocuments(q),
    ]);
    return success(res, { list, total, page: pageN, limit: limitN });
  } catch (e) { next(e); }
});

// 管理：导出 CSV
router.get('/inquiries/export', authJWT(), async (_req, res, next) => {
  try {
    const list = await Inquiry.find({}).sort({ createdAt: -1 }).lean();
    const rows = list.map(i => ({
      ID: String(i._id),
      状态: i.status,
      来源: i.source,
      姓名: i.name,
      邮箱: i.email,
      WhatsApp: i.whatsapp,
      国家: i.country || '',
      公司: i.company || '',
      数量: i.quantity ?? '',
      产品: i.productName || '',
      定制需求: (i.customDemand || '').replace(/\r?\n/g, ' | '),
      创建时间: new Date(i.createdAt).toISOString(),
    }));
    const parser = new Parser({ fields: Object.keys(rows[0] || {
      ID:'',状态:'',来源:'',姓名:'',邮箱:'',WhatsApp:'',国家:'',公司:'',数量:'',产品:'',定制需求:'',创建时间:''
    }) });
    let csv = list.length ? parser.parse(rows) : parser.parse([]);
    // UTF-8 BOM —— Excel 打开不乱码
    const BOM = '\uFEFF';
    const filename = `luxeceramics_inquiries_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(BOM + csv);
  } catch (e) { next(e); }
});

// 详情
router.get('/inquiries/:id', authJWT(), async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) return fail(res, '无效 ID', 404);
    const r = await Inquiry.findById(id).lean();
    if (!r) return fail(res, '询盘不存在', 404);
    return success(res, r);
  } catch (e) { next(e); }
});

// 更新状态
router.patch('/inquiries/:id/status', authJWT(), async (req, res, next) => {
  try {
    const id = req.params.id;
    const { status } = req.body || {};
    if (!['new', 'read', 'replied', 'closed'].includes(status)) return fail(res, '无效 status', 400);
    if (!Types.ObjectId.isValid(id)) return fail(res, '无效 ID', 404);
    const r = await Inquiry.findByIdAndUpdate(id, { $set: { status } }, { new: true });
    if (!r) return fail(res, '询盘不存在', 404);
    return success(res, r.toObject(), '状态更新成功');
  } catch (e) { next(e); }
});

export default router;

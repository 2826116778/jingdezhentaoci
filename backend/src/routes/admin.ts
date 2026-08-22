/**
 * 后台管理路由（全部需 authJWT）：
 *  GET  /api/admin/dashboard            → 汇总统计
 *  GET  /api/admin/products             → 产品列表
 *  POST /api/admin/products             → 创建产品
 *  PATCH /api/admin/products/:id         → 更新产品
 *  DELETE /api/admin/products/:id        → 删除产品
 *  GET  /api/admin/cases                → 案例列表
 *  POST /api/admin/cases                → 创建案例
 *  PATCH /api/admin/cases/:id            → 更新案例
 *  DELETE /api/admin/cases/:id           → 删除案例
 *  GET  /api/admin/inquiries            → 询盘列表（支持 status/source/keyword 过滤）
 *  PATCH /api/admin/inquiries/:id        → 更新询盘（状态、归档等）
 *  GET  /api/admin/inquiries/export     → 导出 CSV（直接 application/octet-stream）
 */
import { Router } from 'express';
import Product from '../models/Product';
import Case from '../models/Case';
import Inquiry from '../models/Inquiry';
import Order from '../models/Order';
import { authJWT } from '../middleware/authJWT';
import { success, fail } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

// 取分页工具
const pickPage = (q: any) => {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
  return { page, limit };
};

// ========== Dashboard ==========
router.get('/admin/dashboard', authJWT(), async (req, res, next) => {
  try {
    const [
      ordersTotal, ordersPaid, ordersPending, ordersExpired,
      paidList,
      productsTotal, casesTotal, inquiriesTotal, inquiriesUnread,
    ] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ paymentStatus: 'paid' }),
      Order.countDocuments({ paymentStatus: 'pending' }),
      Order.countDocuments({ paymentStatus: 'expired' }),
      Order.find({ paymentStatus: 'paid' }, { usdtAmount: 1 }).lean(),
      Product.countDocuments({}),
      Case.countDocuments({}),
      Inquiry.countDocuments({}),
      Inquiry.countDocuments({ status: { $in: ['new', 'read'] } }),
    ]);
    const revenuePaid = paidList.reduce((s, o) => s + (o.usdtAmount || 0), 0);
    return success(res, {
      ordersTotal, ordersPaid, ordersPending, ordersExpired,
      revenuePaid: Math.round(revenuePaid * 100) / 100,
      productsTotal, casesTotal, inquiriesTotal, inquiriesUnread,
    });
  } catch (e) { next(e); }
});

// ========== Products ==========
router.get('/admin/products', authJWT(), async (req, res, next) => {
  try {
    const { limit } = pickPage(req.query);
    const { category, material, keyword } = req.query as any;
    const q: any = {};
    if (category) q.category = { $in: String(category).split(',') };
    if (material) q.material = { $in: String(material).split(',') };
    if (keyword) {
      const rgx = new RegExp(String(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [
        { sku: rgx }, { nameEn: rgx }, { nameAr: rgx }, { descEn: rgx }, { descAr: rgx },
      ];
    }
    const list = await Product.find(q).sort({ sort: 1, sortOrder: 1, createdAt: -1 }).limit(limit).lean();
    return success(res, list);
  } catch (e) { next(e); }
});

router.post('/admin/products', authJWT(), async (req, res, next) => {
  try {
    const data = req.body || {};
    if (!data.sku || !data.nameEn) return fail(res, 'SKU 与 nameEn 必填');
    // 缺失字段时给默认值，与前端 Product 类型对齐
    const payload = {
      ...data,
      isStock: data.isStock !== undefined ? Boolean(data.isStock) : true,
      isCustom: data.isCustom !== undefined ? Boolean(data.isCustom) : false,
      isPublished: data.isPublished !== undefined ? Boolean(data.isPublished) : true,
      moq: Number(data.moq || 0),
      priceMin: Number(data.priceMin || 0),
      priceMax: Number(data.priceMax || 0),
      sort: Number(data.sort || 0),
      sortOrder: Number(data.sortOrder || data.sort || 0),
      featured: data.featured !== undefined ? Boolean(data.featured) : false,
      oemOptions: Array.isArray(data.oemOptions) ? data.oemOptions : [],
      images: Array.isArray(data.images) ? data.images : [],
      detailImages: Array.isArray(data.detailImages) ? data.detailImages : [],
    };
    const doc = await Product.create(payload);
    logger.info('[Admin] Product created', { sku: doc.sku, by: (req as any).admin?.username });
    return success(res, doc.toObject(), '创建成功', 201);
  } catch (e) { next(e); }
});

router.patch('/admin/products/:id', authJWT(), async (req, res, next) => {
  try {
    const data: any = { ...req.body };
    if (data.moq != null) data.moq = Number(data.moq);
    if (data.priceMin != null) data.priceMin = Number(data.priceMin);
    if (data.priceMax != null) data.priceMax = Number(data.priceMax);
    if (data.sort != null) { data.sort = Number(data.sort); data.sortOrder = Number(data.sortOrder ?? data.sort); }
    const doc = await Product.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!doc) return fail(res, '产品不存在', 404);
    logger.info('[Admin] Product updated', { id: doc._id, by: (req as any).admin?.username });
    return success(res, doc.toObject(), '更新成功');
  } catch (e) { next(e); }
});

router.delete('/admin/products/:id', authJWT(), async (req, res, next) => {
  try {
    const doc = await Product.findByIdAndDelete(req.params.id);
    if (!doc) return fail(res, '产品不存在', 404);
    logger.info('[Admin] Product deleted', { id: doc._id, sku: doc.sku, by: (req as any).admin?.username });
    return success(res, null, '删除成功');
  } catch (e) { next(e); }
});

// ========== Cases ==========
router.get('/admin/cases', authJWT(), async (req, res, next) => {
  try {
    const { limit } = pickPage(req.query);
    const { category, keyword } = req.query as any;
    const q: any = {};
    if (category) q.category = { $in: String(category).split(',') };
    if (keyword) {
      const rgx = new RegExp(String(keyword), 'i');
      q.$or = [
        { titleEn: rgx }, { titleAr: rgx }, { nameEn: rgx }, { nameAr: rgx },
        { clientNameEn: rgx }, { clientNameAr: rgx },
      ];
    }
    const list = await Case.find(q).sort({ sort: 1, sortOrder: 1, createdAt: -1 }).limit(limit).lean();
    return success(res, list);
  } catch (e) { next(e); }
});

router.post('/admin/cases', authJWT(), async (req, res, next) => {
  try {
    const data = req.body || {};
    if (!data.nameEn && !data.titleEn) return fail(res, 'nameEn/titleEn 必填其一');
    const payload = {
      ...data,
      titleEn: data.titleEn || data.nameEn || '',
      titleAr: data.titleAr || data.nameAr || '',
      nameEn: data.nameEn || data.titleEn || '',
      nameAr: data.nameAr || data.titleAr || '',
      year: Number(data.year || new Date().getFullYear()),
      isPublished: data.isPublished !== undefined ? Boolean(data.isPublished) : true,
      sort: Number(data.sort || 0),
      sortOrder: Number(data.sortOrder ?? data.sort ?? 0),
      featured: data.featured !== undefined ? Boolean(data.featured) : false,
      images: Array.isArray(data.images) ? data.images : [],
    };
    const doc = await Case.create(payload);
    return success(res, doc.toObject(), '创建成功', 201);
  } catch (e) { next(e); }
});

router.patch('/admin/cases/:id', authJWT(), async (req, res, next) => {
  try {
    const data: any = { ...req.body };
    if (data.year != null) data.year = Number(data.year);
    if (data.sort != null) { data.sort = Number(data.sort); data.sortOrder = Number(data.sortOrder ?? data.sort); }
    if (data.titleEn && !data.nameEn) data.nameEn = data.titleEn;
    if (data.titleAr && !data.nameAr) data.nameAr = data.titleAr;
    if (data.nameEn && !data.titleEn) data.titleEn = data.nameEn;
    if (data.nameAr && !data.titleAr) data.titleAr = data.nameAr;
    const doc = await Case.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!doc) return fail(res, '案例不存在', 404);
    return success(res, doc.toObject(), '更新成功');
  } catch (e) { next(e); }
});

router.delete('/admin/cases/:id', authJWT(), async (req, res, next) => {
  try {
    const doc = await Case.findByIdAndDelete(req.params.id);
    if (!doc) return fail(res, '案例不存在', 404);
    return success(res, null, '删除成功');
  } catch (e) { next(e); }
});

// ========== Inquiries ==========
function csvEscape(v: any) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

router.get('/admin/inquiries', authJWT(), async (req, res, next) => {
  try {
    const { status, source, keyword } = req.query as any;
    const q: any = {};
    if (status) q.status = { $in: String(status).split(',') };
    if (source) q.source = { $in: String(source).split(',') };
    if (keyword) {
      const rgx = new RegExp(String(keyword), 'i');
      q.$or = [
        { name: rgx }, { email: rgx }, { company: rgx }, { subject: rgx },
        { customDemand: rgx }, { message: rgx }, { whatsapp: rgx }, { phone: rgx },
      ];
    }
    const list = await Inquiry.find(q).sort({ createdAt: -1 }).limit(500).lean();
    return success(res, list);
  } catch (e) { next(e); }
});

router.patch('/admin/inquiries/:id', authJWT(), async (req, res, next) => {
  try {
    const doc = await Inquiry.findByIdAndUpdate(req.params.id, { $set: req.body || {} }, { new: true });
    if (!doc) return fail(res, '询盘不存在', 404);
    return success(res, doc.toObject(), '更新成功');
  } catch (e) { next(e); }
});

router.get('/admin/inquiries/export', authJWT(), async (req, res, next) => {
  try {
    const { status } = req.query as any;
    const q: any = {};
    if (status) q.status = { $in: String(status).split(',') };
    const list = await Inquiry.find(q).sort({ createdAt: -1 }).limit(5000).lean();
    const header = ['ID', 'Created At', 'Status', 'Source', 'Name', 'Email', 'Phone/WhatsApp', 'Country', 'Company', 'Product', 'Qty', 'Budget', 'Target Date', 'Subject', 'Message', 'CustomDemand', 'URLs'];
    const rows = list.map(x => [
      String(x._id),
      new Date(x.createdAt).toLocaleString('en-GB'),
      x.status,
      x.source,
      x.name || '',
      x.email || '',
      [x.phone, x.whatsapp].filter(Boolean).join(' / '),
      x.country || '',
      x.company || '',
      x.productName || (x.productId || ''),
      x.quantity || '',
      x.budget || '',
      x.targetDate || '',
      x.subject || '',
      x.message || x.customDemand || '',
      x.customDemand || '',
      Array.isArray(x.attachmentUrls) ? x.attachmentUrls.join(' | ') : '',
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(csvEscape).join(','))
      .join('\n');
    // BOM 兼容 Excel
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inquiries-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (e) { next(e); }
});

export default router;

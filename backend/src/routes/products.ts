/**
 * 产品路由
 * 公开：
 *   GET  /products           列表（支持 category/material/isCustom/isStock/minPrice/maxPrice/keyword/page/limit/sort）
 *   GET  /products/featured  首页推荐前 8
 *   GET  /products/:id       详情
 * 管理（JWT）：
 *   POST /products           新增
 *   PATCH /products/:id      修改
 *   DELETE /products/:id     删除
 */
import { Router, Request } from 'express';
import Product, { IProduct } from '../models/Product';
import { authJWT } from '../middleware/authJWT';
import { success, fail } from '../utils/response';
import { FilterQuery, Types } from 'mongoose';

const router = Router();

// 列表
router.get('/products', async (req, res, next) => {
  try {
    const {
      category, material, isCustom, isStock, keyword,
      minPrice, maxPrice,
      page = '1', limit = '24', sort = 'new',
    } = req.query as Record<string, any>;

    const q: FilterQuery<IProduct> = {};
    if (category) q.category = { $in: Array.isArray(category) ? category : [category] };
    if (material) q.material = { $in: Array.isArray(material) ? material : [material] };
    if (isCustom === '1' || isCustom === 'true') q.isCustom = true;
    if (isStock === '1' || isStock === 'true') q.isStock = true;
    if (keyword) {
      const reg = { $regex: new RegExp(String(keyword), 'i') };
      q.$or = [{ nameEn: reg }, { nameAr: reg }, { sku: reg }, { descEn: reg }, { descAr: reg }];
    }
    if (minPrice !== undefined) q.priceMin = { $gte: Number(minPrice) };
    if (maxPrice !== undefined) {
      q.priceMax = q.priceMax || {} as any;
      (q.priceMax as any).$lte = Number(maxPrice);
      // 同时 priceMin <= maxPrice（交叉价格）
      if (minPrice !== undefined) {
        // 简单处理：只要价格区间有交集
        q.$and = [
          { priceMin: { $gte: Number(minPrice) } },
          { priceMax: { $lte: Number(maxPrice) } },
        ];
        delete q.priceMin; delete q.priceMax;
      }
    }

    const pageN = Math.max(1, Number(page) || 1);
    const limitN = Math.min(100, Math.max(1, Number(limit) || 24));
    const skip = (pageN - 1) * limitN;

    let sortDef: Record<string, 1 | -1> = { sortOrder: 1, createdAt: -1 };
    if (sort === 'price_asc') sortDef = { priceMin: 1, _id: -1 };
    else if (sort === 'price_desc') sortDef = { priceMin: -1, _id: -1 };
    else if (sort === 'new') sortDef = { createdAt: -1, _id: -1 };

    const [list, total] = await Promise.all([
      Product.find(q).sort(sortDef).skip(skip).limit(limitN).lean(),
      Product.countDocuments(q),
    ]);
    return success(res, { list, total, page: pageN, limit: limitN, hasMore: skip + list.length < total });
  } catch (e) { next(e); }
});

// 推荐
router.get('/products/featured', async (_req, res, next) => {
  try {
    const list = await Product.find({ featured: true }).sort({ sortOrder: 1, createdAt: -1 }).limit(8).lean();
    return success(res, list);
  } catch (e) { next(e); }
});

// 详情
router.get('/products/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) return fail(res, '无效的产品 ID', 404, 404);
    const p = await Product.findById(id).lean();
    if (!p) return fail(res, '产品不存在', 404, 404);
    // 相关产品（相同 category 排除自己，最多 6 条）
    const related = await Product.find({ category: p.category, _id: { $ne: p._id } })
      .limit(6).sort({ featured: -1, createdAt: -1 }).lean();
    return success(res, { product: p, related });
  } catch (e) { next(e); }
});

// ---- 管理 ----
router.post('/products', authJWT(), async (req, res, next) => {
  try {
    const p = new Product(req.body);
    await p.save();
    return success(res, p.toObject(), '创建成功', 201);
  } catch (e) { next(e); }
});

router.patch('/products/:id', authJWT(), async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) return fail(res, '无效 ID', 404);
    const p = await Product.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });
    if (!p) return fail(res, '产品不存在', 404);
    return success(res, p.toObject(), '更新成功');
  } catch (e) { next(e); }
});

router.delete('/products/:id', authJWT(), async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) return fail(res, '无效 ID', 404);
    const r = await Product.findByIdAndDelete(id);
    if (!r) return fail(res, '产品不存在', 404);
    return success(res, null, '删除成功');
  } catch (e) { next(e); }
});

export default router;

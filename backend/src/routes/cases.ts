/**
 * 工程案例路由（Case 模型）
 * GET   /cases              列表（?category=hotel|villa|commercial  可选）
 * GET   /cases/featured     首页推荐前 4
 * GET   /cases/:id          详情
 * POST  /cases              JWT 新增
 * PATCH /cases/:id          JWT 修改
 * DELETE /cases/:id         JWT 删除
 */
import { Router } from 'express';
import CaseModel from '../models/Case';
import { authJWT } from '../middleware/authJWT';
import { success, fail } from '../utils/response';
import { Types } from 'mongoose';

const router = Router();

router.get('/cases', async (req, res, next) => {
  try {
    const { category, limit } = req.query;
    const q: any = {};
    if (category && category !== 'all') q.category = category;
    const docs = await CaseModel.find(q)
      .limit(limit ? Math.min(100, Number(limit)) : 100)
      .sort({ featured: -1, sortOrder: 1, year: -1, createdAt: -1 })
      .lean();
    return success(res, docs);
  } catch (e) { next(e); }
});

router.get('/cases/featured', async (_req, res, next) => {
  try {
    const docs = await CaseModel.find({ featured: true })
      .limit(4).sort({ sortOrder: 1, year: -1 }).lean();
    return success(res, docs);
  } catch (e) { next(e); }
});

router.get('/cases/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) return fail(res, '无效 ID', 404);
    const c = await CaseModel.findById(id).lean();
    if (!c) return fail(res, '案例不存在', 404);
    return success(res, c);
  } catch (e) { next(e); }
});

router.post('/cases', authJWT(), async (req, res, next) => {
  try {
    const c = new CaseModel(req.body);
    await c.save();
    return success(res, c.toObject(), '创建成功', 201);
  } catch (e) { next(e); }
});

router.patch('/cases/:id', authJWT(), async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) return fail(res, '无效 ID', 404);
    const c = await CaseModel.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });
    if (!c) return fail(res, '案例不存在', 404);
    return success(res, c.toObject(), '更新成功');
  } catch (e) { next(e); }
});

router.delete('/cases/:id', authJWT(), async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) return fail(res, '无效 ID', 404);
    const r = await CaseModel.findByIdAndDelete(id);
    if (!r) return fail(res, '案例不存在', 404);
    return success(res, null, '删除成功');
  } catch (e) { next(e); }
});

export default router;

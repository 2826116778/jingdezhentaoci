/**
 * PHASE 2-A 外贸业务工作台 — 真实 CRUD 路由（MongoDB）
 * 路径：/api/console/*
 *
 * 安全：
 *  1. 全部受 authJWT() 保护
 *  2. 非 superadmin 只能操作 ownerId === 自己 的数据（读 + 写）；读 list 时自动加 owner 过滤
 *     - superadmin：可看/操作全部
 *     - 其他（editor 等）：视为 Sales，仅能管自己的
 *  3. 写操作（PATCH/DELETE/CONVERT）额外再校验一次 owner 权限
 *
 * 业务：
 *  - Dashboard /summary：真实聚合 KPIs + 4 张图表（MongoDB aggregation），空数组就返回 []
 *  - Leads / Companies / Contacts / Customers / FollowUps / Tasks / Quotes / Orders / Inquiries
 *    全部真实 CRUD（GET / GET /id / POST / PATCH /id / DELETE /id）
 *  - POST /leads/:id/convert → Lead → Customer 真实转换 + Company + Contact + LEAD_CONVERTED Interaction
 *  - POST /quotes/:id/convert-order → Quote ACCEPTED → Order 真实生成，关联 quoteId/inquiryId/customerId
 *  - POST /customers/:id/followup → 为 Customer 加 FollowUp，同步 Interaction
 *  - 所有分页：{items, total, page, pageSize, totalPages}
 */
import { Router } from 'express';
import { Types, FilterQuery } from 'mongoose';
import { authJWT, AuthRequest } from '../middleware/authJWT';
import { CODE_PREFIXES } from '../types/crm';

import Lead, { ILead } from '../models/Lead';
import Company, { ICompany } from '../models/Company';
import Contact, { IContact } from '../models/Contact';
import Customer, { ICustomer } from '../models/Customer';
import FollowUp, { IFollowUp } from '../models/FollowUp';
import Task, { ITask } from '../models/Task';
import Interaction, { IInteraction } from '../models/Interaction';
import Quote, { IQuote, IQuoteItem } from '../models/Quote';
import Inquiry, { IInquiry } from '../models/Inquiry';
import Order, { IOrder } from '../models/Order';
import { env } from '../config/env';
import developmentRoutes from './development';
import aiRoutes from './ai';
import aiDevelopmentRoutes from './aiDevelopment';

const router = Router();

// ============ 全局保护 ============
router.use(authJWT());

// ============ PHASE 2-B 客户开发中心子路由（继承上方全局 authJWT 保护） ============
router.use('/development', developmentRoutes);

// ============ PHASE 2-C AI 海外客户研究 & 开发助手子路由 ============
router.use('/ai', aiRoutes);

// ============ PHASE 3-A AI Customer Development Center 子路由 ============
router.use('/ai/development', aiDevelopmentRoutes);

// ---------- 工具 ----------
const ok = <T>(res: any, data: T, message = 'ok') =>
  res.json({ code: 0, message, data });

const fail = (res: any, status: number, code: number, message: string) =>
  res.status(status).json({ code, message, data: null });

const toId = (s: string | undefined): Types.ObjectId | undefined => {
  if (!s) return undefined;
  try { return new Types.ObjectId(s); } catch { return undefined; }
};

function isValidObjectId(s: string | undefined): boolean {
  if (!s) return false;
  return Types.ObjectId.isValid(s) && new Types.ObjectId(s).toString() === s;
}

/**
 * 基于当前 admin 角色生成 owner 过滤：
 *   - superadmin：无限制
 *   - 其他：仅 ownerId === 自己  OR  ownerId 为 null/undefined（视为公共，可看但改时会被拒绝）
 * readScope：list 查询用；writeScope：写前二次校验用
 */
function readScope(req: AuthRequest): FilterQuery<any> {
  if (req.admin?.role === 'superadmin') return {};
  const id = toId(req.admin?.id);
  return { $or: [{ ownerId: id }, { ownerId: null }, { ownerId: { $exists: false } }] };
}
function isWritable(req: AuthRequest, doc: { ownerId?: Types.ObjectId | string | null }): boolean {
  if (req.admin?.role === 'superadmin') return true;
  const me = req.admin?.id;
  if (!me) return false;
  const oid = String(doc.ownerId ?? '');
  // owner 匹配或 owner 为空时允许首次分配（PATCH 能把 ownerId 设为自己）
  return oid === me || oid === '';
}

/** 解析分页参数 */
function parsePage(q: any) {
  const page = Math.max(1, parseInt(q.page as string, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(q.pageSize as string, 10) || 20));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

/** 基础 CRUD 分页查找 */
async function paginate<T>(model: any, baseFilter: FilterQuery<T>, page: number, pageSize: number, skip: number, sort: any = { createdAt: -1 }) {
  const [items, total] = await Promise.all([
    model.find(baseFilter).sort(sort).skip(skip).limit(pageSize).lean(),
    model.countDocuments(baseFilter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 0,
  };
}

// ========================================================================
//  0. 当前 Console 会话用户
// ========================================================================
router.get('/me', (req: AuthRequest, res) =>
  ok(res, {
    id:       req.admin?.id ?? '',
    username: req.admin?.username ?? '',
    role:     req.admin?.role ?? 'admin',
    avatar:   null as string | null,
    timezone: 'UTC',
    locale:   'en',
  }),
);

// ========================================================================
//  1. Dashboard 真实汇总
// ========================================================================
router.get('/dashboard/summary', async (req: AuthRequest, res) => {
  const scope = readScope(req);

  // 将通用 scope 包装为各集合可用的过滤器
  const withScope = (extra?: any): any => {
    if (!Object.keys(scope).length) return extra ?? {};
    return extra ? { $and: [scope, extra] } : scope;
  };

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [
    totalLeads, totalCustomers, totalInquiries, totalQuotes, totalOrders,
    totalOrderAmountRow, pendingTasks, upcomingFollowups,
    convertedLeads,
    leads30, orders30, inquiriesBySource, topCountries,
  ] = await Promise.all([
    Lead.countDocuments(withScope()),
    Customer.countDocuments(withScope()),
    Inquiry.countDocuments(withScope()),
    Quote.countDocuments(withScope()),
    Order.countDocuments(withScope()),
    Order.aggregate([
      { $match: withScope({ paymentStatus: { $in: ['paid', 'pending'] } }) as any },
      { $group: { _id: null, amount: { $sum: '$totalAmount' } } },
    ]),
    Task.countDocuments(withScope({ status: { $in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] } })),
    FollowUp.countDocuments(withScope({
      status: { $in: ['PENDING', 'OVERDUE'] },
      scheduledAt: { $gte: startOfToday, $lte: sevenDaysLater },
    })),
    Lead.countDocuments(withScope({ status: 'CONVERTED' })),
    // leadsLast30Days
    Lead.aggregate([
      { $match: withScope({ createdAt: { $gte: thirtyAgo } }) as any },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } },
    ]),
    // ordersLast30Days
    Order.aggregate([
      { $match: withScope({ createdAt: { $gte: thirtyAgo } }) as any },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count:  { $sum: 1 },
        amount: { $sum: '$totalAmount' },
      } },
      { $project: { _id: 0, date: '$_id', count: 1, amount: 1 } },
      { $sort: { date: 1 } },
    ]),
    // inquiriesBySource（优先 stage 新来源 + source 旧来源合并；实际只用 source 字段）
    Inquiry.aggregate([
      { $match: withScope() as any },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $project: { _id: 0, source: { $ifNull: ['$_id', 'unknown'] }, count: 1 } },
      { $sort: { count: -1 } },
    ]),
    // topCountries（Lead country 聚合）
    Lead.aggregate([
      { $match: withScope({ country: { $exists: true, $ne: '' } }) as any },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $project: { _id: 0, country: '$_id', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const totalOrderAmountUsd = totalOrderAmountRow?.[0]?.amount ?? 0;
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

  ok(res, {
    kpis: {
      totalLeads,
      totalCustomers,
      totalInquiries,
      totalQuotes,
      totalOrders,
      totalOrderAmountUsd,
      pendingTasks,
      upcomingFollowups,
      conversionRate,
    },
    charts: {
      leadsLast30Days:   leads30 ?? [],
      ordersLast30Days:  orders30 ?? [],
      inquiriesBySource: inquiriesBySource ?? [],
      topCountries:      topCountries ?? [],
    },
    recent: {
      inquiries: [],
      orders:    [],
      tasks:     [],
    },
  });
});

// ========================================================================
//  2. Leads 真实 CRUD
// ========================================================================
router.get('/leads', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<ILead> = readScope(req);
  // 搜索 & 筛选
  const q = req.query;
  if (q.search && typeof q.search === 'string' && q.search.trim()) {
    const s = q.search.trim();
    base.$or = [
      { companyName: { $regex: s, $options: 'i' } },
      { contactName: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { whatsapp: { $regex: s, $options: 'i' } },
    ];
  }
  if (q.country && typeof q.country === 'string') base.country = q.country;
  if (q.industry && typeof q.industry === 'string') base.industry = q.industry;
  if (q.status && typeof q.status === 'string') base.status = q.status;
  if (q.grade && typeof q.grade === 'string') base.grade = q.grade;
  if (q.source && typeof q.source === 'string') base.source = q.source;
  if (q.minScore !== undefined) base.score = { ...(base.score ?? {}), $gte: Number(q.minScore) };
  if (q.maxScore !== undefined) base.score = { ...(base.score ?? {}), $lte: Number(q.maxScore) };

  const sort: any = {};
  if (q.sort && typeof q.sort === 'string') {
    sort[q.sort] = (q.order === 'asc') ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }
  ok(res, await paginate<ILead>(Lead, base, page, pageSize, skip, sort));
});

router.get('/leads/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid lead id');
  const doc = await Lead.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
  if (!doc) return fail(res, 404, 404, 'Lead not found');
  ok(res, doc);
});

router.post('/leads', async (req: AuthRequest, res) => {
  const body = req.body || {};
  const owner = toId(req.admin!.id);
  const doc: Partial<ILead> = {
    ...body,
    ownerId: body.ownerId ? (toId(body.ownerId) ?? owner) : owner,
  };
  // 简单校验
  if (!doc.companyName) return fail(res, 400, 400, 'companyName is required');
  try {
    const lead = await Lead.create(doc as any);
    await Interaction.create({
      customerId: undefined, leadId: lead._id,
      type: 'LEAD_CREATED',
      title: 'Lead created',
      content: `Lead "${lead.companyName}" created by ${req.admin!.username}.`,
      ownerId: owner,
      occurredAt: new Date(),
    } as unknown as Partial<IInteraction>);
    return ok(res, lead.toObject());
  } catch (e: any) {
    return fail(res, 400, 400, e?.message || 'Create lead failed');
  }
});

router.patch('/leads/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid lead id');
  const doc = await Lead.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Lead not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  const patch = { ...(req.body || {}) };
  if (patch.ownerId) patch.ownerId = toId(patch.ownerId) ?? doc.ownerId;
  try {
    Object.assign(doc, patch);
    await doc.save();
    ok(res, doc.toObject());
  } catch (e: any) {
    fail(res, 400, 400, e?.message || 'Update lead failed');
  }
});

router.delete('/leads/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid lead id');
  const doc = await Lead.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Lead not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  await doc.deleteOne();
  ok(res, { deleted: true, id: req.params.id });
});

/** Lead → Customer 真实转换：
 *   1. 基于 Lead.companyName/country 查或建 Company
 *   2. 基于 Lead.contactName 建 Contact（主联系人）挂到该 Company
 *   3. 建 Customer（绑定 companyId，生成 customerCode）
 *   4. Lead.status=CONVERTED，Lead.customerId/companyId 写回
 *   5. 写入 Interaction LEAD_CONVERTED & LEAD_CREATED/Customer 对应时间线
 */
router.post('/leads/:id/convert', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid lead id');
  const lead = await Lead.findById(req.params.id);
  if (!lead) return fail(res, 404, 404, 'Lead not found');
  if (!isWritable(req, lead)) return fail(res, 403, 403, 'Permission denied');
  if (lead.status === 'CONVERTED' && lead.customerId) {
    return fail(res, 400, 400, 'Lead already converted');
  }
  const owner = toId(req.admin!.id)!;

  try {
    // 1) Company：按 name+country 幂等
    let company = await Company.findOne({
      name: lead.companyName,
      ...(lead.country ? { country: lead.country } : {}),
    });
    if (!company) {
      company = await Company.create({
        name: lead.companyName,
        website: lead.website,
        country: lead.country,
        city: lead.city,
        industry: lead.industry,
        companyType: lead.companyType,
        source: lead.source,
        sourceUrl: lead.sourceUrl,
        ownerId: owner,
        tags: lead.tags?.slice() ?? [],
        notes: `Converted from Lead ${lead._id}`,
      } as Partial<ICompany>);
    }

    // 2) Contact：主联系人挂到 companyId
    let contact = await Contact.findOne({
      companyId: company._id,
      $or: [
        { email: lead.email || '__none__' },
        { whatsapp: lead.whatsapp || '__none__' },
        { name: lead.contactName || '__none__' },
      ],
    });
    if (!contact) {
      contact = await Contact.create({
        companyId: company._id,
        name: lead.contactName || company.name,
        jobTitle: lead.jobTitle,
        email: lead.email,
        phone: lead.phone,
        whatsapp: lead.whatsapp,
        linkedin: lead.linkedin,
        isPrimary: true,
        notes: `Converted from Lead ${lead._id}`,
        ownerId: owner,
      } as Partial<IContact>);
    }

    // 3) Customer
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    const seq = String(Math.floor(1000 + Math.random() * 9000));
    const customerCode = `${CODE_PREFIXES.CUSTOMER}-${ymd}-${seq}`;
    const customer = await Customer.create({
      companyId: company._id,
      customerCode,
      customerLevel: req.body?.customerLevel ?? 'PROSPECT',
      status: 'PENDING',
      source: lead.source,
      ownerId: owner,
      score: lead.score ?? 0,
      tags: lead.tags?.slice() ?? [],
      notes: (lead.notes ? lead.notes + '\n' : '') + `Converted from Lead ${lead._id}`,
      lastContactAt: lead.lastContactAt,
      nextFollowUpAt: lead.nextFollowUpAt,
    } as Partial<ICustomer>);

    // 4) Contact 关联 customerId（若是 customer 级）
    if (!contact.customerId) {
      contact.customerId = customer._id;
      await contact.save();
    }

    // 5) Lead 写回
    lead.status = 'CONVERTED';
    lead.customerId = customer._id;
    lead.companyId = company._id;
    await lead.save();

    // 6) Interactions
    const now = new Date();
    await Interaction.insertMany([
      {
        customerId: customer._id, leadId: lead._id, companyId: company._id,
        type: 'LEAD_CONVERTED',
        title: 'Lead converted to Customer',
        content: `Lead "${lead.companyName}" → Customer ${customer.customerCode} by ${req.admin!.username}.`,
        ownerId: owner,
        occurredAt: now,
      },
    ] as Partial<IInteraction>[]);

    return ok(res, {
      lead:     { id: lead._id, status: lead.status, customerId: lead.customerId },
      customer: customer.toObject(),
      company:  company.toObject(),
      contact:  contact.toObject(),
    });
  } catch (e: any) {
    return fail(res, 500, 500, e?.message || 'Convert lead failed');
  }
});

// ========================================================================
//  3. Companies 真实 CRUD
// ========================================================================
router.get('/companies', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<ICompany> = readScope(req);
  const q = req.query;
  if (q.search && typeof q.search === 'string') {
    base.name = { $regex: q.search, $options: 'i' };
  }
  if (q.country && typeof q.country === 'string') base.country = q.country;
  if (q.industry && typeof q.industry === 'string') base.industry = q.industry;
  ok(res, await paginate<ICompany>(Company, base, page, pageSize, skip));
});
router.get('/companies/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Company.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
  if (!doc) return fail(res, 404, 404, 'Not found');
  ok(res, doc);
});
router.post('/companies', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.name) return fail(res, 400, 400, 'name is required');
  try {
    const owner = toId(req.admin!.id);
    const doc = await Company.create({ ...b, ownerId: b.ownerId ?? owner });
    ok(res, doc.toObject());
  } catch (e: any) {
    fail(res, 400, 400, e?.message || 'Create company failed');
  }
});
router.patch('/companies/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Company.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  try { Object.assign(doc, req.body || {}); await doc.save(); ok(res, doc.toObject()); }
  catch (e: any) { fail(res, 400, 400, e?.message || 'Update failed'); }
});

// ========================================================================
//  4. Contacts 真实 CRUD
// ========================================================================
router.get('/contacts', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<IContact> = readScope(req);
  const q = req.query;
  if (q.companyId) base.companyId = toId(q.companyId as string);
  if (q.customerId) base.customerId = toId(q.customerId as string);
  if (q.search) base.name = { $regex: q.search as string, $options: 'i' };
  ok(res, await paginate<IContact>(Contact, base, page, pageSize, skip));
});
router.get('/contacts/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Contact.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
  if (!doc) return fail(res, 404, 404, 'Not found');
  ok(res, doc);
});
router.post('/contacts', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.name) return fail(res, 400, 400, 'name is required');
  try {
    const owner = toId(req.admin!.id);
    const doc = await Contact.create({
      ...b,
      companyId: toId(b.companyId),
      customerId: toId(b.customerId),
      ownerId: b.ownerId ?? owner,
    });
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Create contact failed'); }
});
router.patch('/contacts/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Contact.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  const b = req.body || {};
  if (b.companyId) b.companyId = toId(b.companyId);
  if (b.customerId) b.customerId = toId(b.customerId);
  try { Object.assign(doc, b); await doc.save(); ok(res, doc.toObject()); }
  catch (e: any) { fail(res, 400, 400, e?.message || 'Update failed'); }
});

// ========================================================================
//  5. Customers 真实 CRUD + Detail (Company + Contact + Timeline + Inquiries/Quotes/Orders + AddFollowUp)
// ========================================================================
router.get('/customers', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<ICustomer> = readScope(req);
  const q = req.query;
  if (q.search && typeof q.search === 'string') {
    // 通过 company name 联表 join 做搜索：aggregate
    const s = q.search;
    const custIds = await Company.find({ name: { $regex: s, $options: 'i' } }).distinct('_id');
    if (custIds.length === 0) base.companyId = new Types.ObjectId('000000000000000000000000'); // 空匹配
    else base.companyId = { $in: custIds as any[] };
  }
  if (q.country && typeof q.country === 'string') {
    const custIds = await Company.find({ country: q.country }).distinct('_id');
    base.companyId = { $in: (custIds as any[]).length ? custIds as any[] : [new Types.ObjectId('000000000000000000000000')] };
  }
  if (q.customerLevel) base.customerLevel = q.customerLevel;
  if (q.status) base.status = q.status;
  if (q.ownerId) base.ownerId = toId(q.ownerId as string);
  ok(res, await paginate<ICustomer>(Customer, base, page, pageSize, skip));
});

router.get('/customers/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const customer = await Customer.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
  if (!customer) return fail(res, 404, 404, 'Not found');
  const [company, contacts, timeline, inquiries, quotes, orders, followups, tasks] = await Promise.all([
    customer.companyId ? Company.findById(customer.companyId).lean() : null,
    Contact.find({ customerId: customer._id }).sort({ isPrimary: -1, createdAt: 1 }).lean(),
    Interaction.find({
      $or: [{ customerId: customer._id }, { companyId: customer.companyId }],
    }).sort({ occurredAt: -1 }).limit(100).lean(),
    Inquiry.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(50).lean(),
    Quote.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(50).lean(),
    Order.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(50).lean(),
    FollowUp.find({ customerId: customer._id }).sort({ scheduledAt: -1 }).limit(50).lean(),
    Task.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  ok(res, { customer, company, contacts, timeline, inquiries, quotes, orders, followups, tasks });
});

router.post('/customers', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.companyId && !b.company) return fail(res, 400, 400, 'companyId or company is required');
  const owner = toId(req.admin!.id)!;
  try {
    let companyId = toId(b.companyId);
    if (!companyId) {
      const comp = await Company.create({
        name: b.company,
        website: b.website, country: b.country, city: b.city,
        industry: b.industry, companyType: b.companyType,
        source: b.source || 'manual',
        ownerId: owner,
      } as any);
      companyId = comp._id;
    }
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    const customerCode = `${CODE_PREFIXES.CUSTOMER}-${ymd}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const customer = await Customer.create({
      ...b,
      companyId,
      customerCode: b.customerCode || customerCode,
      ownerId: b.ownerId || owner,
    } as any);
    ok(res, customer.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Create customer failed'); }
});

router.patch('/customers/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Customer.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  try { Object.assign(doc, req.body || {}); await doc.save(); ok(res, doc.toObject()); }
  catch (e: any) { fail(res, 400, 400, e?.message || 'Update failed'); }
});

router.delete('/customers/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Customer.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  await doc.deleteOne();
  ok(res, { deleted: true, id: req.params.id });
});

/** Customer 快捷加 FollowUp */
router.post('/customers/:id/followup', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const customer = await Customer.findById(req.params.id);
  if (!customer) return fail(res, 404, 404, 'Customer not found');
  if (!isWritable(req, customer)) return fail(res, 403, 403, 'Permission denied');
  const b = req.body || {};
  const owner = toId(req.admin!.id)!;
  const fu = await FollowUp.create({
    customerId: customer._id,
    type: b.type || 'OTHER',
    content: b.content || '',
    result: b.result || '',
    nextAction: b.nextAction || '',
    scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : new Date(),
    completedAt: b.completedAt ? new Date(b.completedAt) : undefined,
    status: b.status || 'PENDING',
    ownerId: owner,
  } as Partial<IFollowUp>);
  await Interaction.create({
    customerId: customer._id,
    type: 'FOLLOWUP_CREATED',
    title: 'Follow-up added',
    content: b.content || '',
    sourceRef: { model: 'FollowUp', id: fu._id },
    ownerId: owner,
    occurredAt: fu.scheduledAt,
  } as Partial<IInteraction>);
  ok(res, fu.toObject());
});

// ========================================================================
//  6. FollowUps 真实 CRUD（带 today/upcoming/completed/overdue 筛选）
// ========================================================================
router.get('/followups', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<IFollowUp> = readScope(req);
  const q = req.query;
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const next7End = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const view = q.view as string | undefined;
  if (view === 'today')     { base.scheduledAt = { $gte: todayStart, $lt: todayEnd }; base.status = { $in: ['PENDING', 'OVERDUE'] }; }
  else if (view === 'upcoming') { base.scheduledAt = { $gte: todayEnd, $lt: next7End }; base.status = 'PENDING'; }
  else if (view === 'completed') { base.status = 'COMPLETED'; }
  else if (view === 'overdue')   { base.status = { $in: ['OVERDUE', 'PENDING'] }; base.scheduledAt = { $lt: todayStart }; }

  if (q.customerId) base.customerId = toId(q.customerId as string);
  if (q.leadId)     base.leadId = toId(q.leadId as string);
  if (q.status)     base.status = q.status as any;
  if (q.type)       base.type = q.type as any;

  ok(res, await paginate<IFollowUp>(FollowUp, base, page, pageSize, skip, { scheduledAt: 1 }));
});
router.get('/followups/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await FollowUp.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
  if (!doc) return fail(res, 404, 404, 'Not found');
  ok(res, doc);
});
router.post('/followups', async (req: AuthRequest, res) => {
  const b = req.body || {};
  try {
    const owner = toId(req.admin!.id)!;
    const doc = await FollowUp.create({
      ...b,
      customerId: toId(b.customerId),
      leadId: toId(b.leadId),
      contactId: toId(b.contactId),
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : new Date(),
      completedAt: b.completedAt ? new Date(b.completedAt) : undefined,
      ownerId: b.ownerId ?? owner,
    } as any);
    await Interaction.create({
      customerId: doc.customerId, leadId: doc.leadId, contactId: doc.contactId,
      type: 'FOLLOWUP_CREATED',
      title: 'Follow-up scheduled',
      content: b.content || '',
      sourceRef: { model: 'FollowUp', id: doc._id },
      ownerId: owner,
      occurredAt: doc.scheduledAt,
    } as Partial<IInteraction>);
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Create failed'); }
});
router.patch('/followups/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await FollowUp.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  const b = req.body || {};
  if (b.customerId) b.customerId = toId(b.customerId);
  if (b.leadId) b.leadId = toId(b.leadId);
  if (b.contactId) b.contactId = toId(b.contactId);
  if (b.scheduledAt) b.scheduledAt = new Date(b.scheduledAt);
  if (b.completedAt) b.completedAt = new Date(b.completedAt);
  try { Object.assign(doc, b); await doc.save(); ok(res, doc.toObject()); }
  catch (e: any) { fail(res, 400, 400, e?.message || 'Update failed'); }
});
router.delete('/followups/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await FollowUp.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  await doc.deleteOne();
  ok(res, { deleted: true, id: req.params.id });
});

// ========================================================================
//  7. Tasks 真实 CRUD（带 TODO / 完成 / 逾期 / 优先级 排序）
// ========================================================================
router.get('/tasks', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<ITask> = readScope(req);
  const q = req.query;
  const now = new Date();

  const view = q.view as string | undefined;
  if (view === 'todo')       base.status = { $in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] };
  else if (view === 'done')  base.status = 'COMPLETED';
  else if (view === 'overdue') {
    base.status = { $in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] };
    base.dueAt = { $lt: now };
  }

  if (q.customerId) base.customerId = toId(q.customerId as string);
  if (q.leadId)     base.leadId = toId(q.leadId as string);
  if (q.priority)   base.priority = q.priority as any;
  if (q.status)     base.status = q.status as any;

  // 默认按 优先级降序 URGENT>HIGH>MEDIUM>LOW + 截止日期升序
  const sort: any = {};
  sort._priorityOrder = 0; // 占位，会在下面用 project 重写；此处简化：用数字 priority 映射
  const priorityScore: any = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  // Mongoose 3.6+ 允许 aggregation 分页
  const items = await Task.aggregate([
    { $match: base },
    { $addFields: { _prio: { $switch: {
      branches: (Object.keys(priorityScore) as any[]).map((k: any) => ({ case: { $eq: ['$priority', k] }, then: priorityScore[k] })),
      default: 0,
    } } } },
    { $sort: { _prio: -1, dueAt: 1, createdAt: -1 } },
    { $skip: skip },
    { $limit: pageSize },
  ]);
  const total = await Task.countDocuments(base);
  ok(res, {
    items, total, page, pageSize,
    totalPages: Math.ceil(total / pageSize) || 0,
  });
});
router.get('/tasks/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Task.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
  if (!doc) return fail(res, 404, 404, 'Not found');
  ok(res, doc);
});
router.post('/tasks', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.title) return fail(res, 400, 400, 'title is required');
  try {
    const owner = toId(req.admin!.id)!;
    const doc = await Task.create({
      ...b,
      customerId: toId(b.customerId),
      leadId: toId(b.leadId),
      dueAt: b.dueAt ? new Date(b.dueAt) : undefined,
      completedAt: b.completedAt ? new Date(b.completedAt) : undefined,
      ownerId: b.ownerId ?? owner,
    } as any);
    await Interaction.create({
      customerId: doc.customerId, leadId: doc.leadId,
      type: 'TASK_CREATED',
      title: `Task created: ${doc.title}`,
      content: b.description || '',
      sourceRef: { model: 'Task', id: doc._id },
      ownerId: owner,
      occurredAt: new Date(),
    } as Partial<IInteraction>);
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Create failed'); }
});
router.patch('/tasks/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Task.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  const b = req.body || {};
  if (b.customerId) b.customerId = toId(b.customerId);
  if (b.leadId) b.leadId = toId(b.leadId);
  if (b.dueAt) b.dueAt = new Date(b.dueAt);
  const prevStatus = doc.status;
  try {
    Object.assign(doc, b);
    // 如果 status 变 COMPLETED，写 interaction
    if (prevStatus !== 'COMPLETED' && doc.status === 'COMPLETED' && !doc.completedAt) doc.completedAt = new Date();
    await doc.save();
    if (prevStatus !== 'COMPLETED' && doc.status === 'COMPLETED') {
      await Interaction.create({
        customerId: doc.customerId, leadId: doc.leadId,
        type: 'TASK_COMPLETED',
        title: `Task completed: ${doc.title}`,
        sourceRef: { model: 'Task', id: doc._id },
        ownerId: doc.ownerId,
        occurredAt: doc.completedAt || new Date(),
      } as Partial<IInteraction>);
    }
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Update failed'); }
});
router.delete('/tasks/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Task.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  await doc.deleteOne();
  ok(res, { deleted: true, id: req.params.id });
});

// ========================================================================
//  8. Interactions / Timeline (只读接口，供 Customer 详情使用)
// ========================================================================
router.get('/interactions', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<IInteraction> = {};
  const q = req.query;
  if (q.customerId) base.customerId = toId(q.customerId as string);
  if (q.leadId)     base.leadId = toId(q.leadId as string);
  if (q.companyId)  base.companyId = toId(q.companyId as string);
  if (q.type)       base.type = q.type as any;
  ok(res, await paginate<IInteraction>(Interaction, base, page, pageSize, skip, { occurredAt: -1 }));
});

// ========================================================================
//  9. Inquiries（Console 视角：复用现有集合，增加 stage/关联）
// ========================================================================
router.get('/inquiries', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<IInquiry> = readScope(req);
  const q = req.query;
  if (q.search) base.name = { $regex: q.search as string, $options: 'i' };
  if (q.stage) base.stage = q.stage as any;
  if (q.source) base.source = q.source as any;
  if (q.priority) base.priority = q.priority as any;
  if (q.customerId) base.customerId = toId(q.customerId as string);
  ok(res, await paginate<IInquiry>(Inquiry, base, page, pageSize, skip));
});
router.get('/inquiries/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Inquiry.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
  if (!doc) return fail(res, 404, 404, 'Not found');
  ok(res, doc);
});
router.post('/inquiries', async (req: AuthRequest, res) => {
  const b = req.body || {};
  if (!b.name || !b.email) return fail(res, 400, 400, 'name and email are required');
  const owner = toId(req.admin!.id)!;
  try {
    const inq = await Inquiry.create({
      ...b,
      leadId: toId(b.leadId),
      customerId: toId(b.customerId),
      companyId: toId(b.companyId),
      contactId: toId(b.contactId),
      ownerId: b.ownerId ?? owner,
      expectedCloseDate: b.expectedCloseDate ? new Date(b.expectedCloseDate) : undefined,
    } as any);
    await Interaction.create({
      customerId: inq.customerId, leadId: inq.leadId, companyId: inq.companyId,
      type: 'INQUIRY_CREATED',
      title: 'Inquiry created',
      content: (b.subject || b.message || '').slice(0, 200),
      sourceRef: { model: 'Inquiry', id: inq._id },
      ownerId: owner,
      occurredAt: new Date(),
    } as Partial<IInteraction>);
    ok(res, inq.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Create failed'); }
});
router.patch('/inquiries/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Inquiry.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  const b = req.body || {};
  for (const k of ['leadId','customerId','companyId','contactId','ownerId']) {
    if (b[k]) b[k] = toId(b[k]);
  }
  if (b.expectedCloseDate) b.expectedCloseDate = new Date(b.expectedCloseDate);
  try { Object.assign(doc, b); await doc.save(); ok(res, doc.toObject()); }
  catch (e: any) { fail(res, 400, 400, e?.message || 'Update failed'); }
});

// ========================================================================
//  10. Quotes 真实 CRUD（含生成 quoteNo + 计算金额）
// ========================================================================
function computeQuoteTotals(items: IQuoteItem[], extra?: { shippingFee?: number; discount?: number; tax?: number }) {
  let subtotal = 0;
  for (const it of items) subtotal += (it.amount ?? (it.unitPrice || 0) * (it.quantity || 0));
  const shippingFee = extra?.shippingFee ?? 0;
  const discount = extra?.discount ?? 0;
  const tax = extra?.tax ?? 0;
  const total = Math.max(0, subtotal + shippingFee - discount + tax);
  return { subtotal, shippingFee, discount, tax, total };
}

router.get('/quotes', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<IQuote> = readScope(req);
  const q = req.query;
  if (q.customerId) base.customerId = toId(q.customerId as string);
  if (q.inquiryId)  base.inquiryId = toId(q.inquiryId as string);
  if (q.status)     base.status = q.status as any;
  ok(res, await paginate<IQuote>(Quote, base, page, pageSize, skip));
});
router.get('/quotes/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Quote.findOne({ $and: [readScope(req), { _id: toId(req.params.id)! }] }).lean();
  if (!doc) return fail(res, 404, 404, 'Not found');
  ok(res, doc);
});
router.post('/quotes', async (req: AuthRequest, res) => {
  const b = req.body || {};
  const owner = toId(req.admin!.id)!;
  const items = (b.items || []).map((it: any) => ({
    ...it,
    productId: toId(it.productId),
    amount: it.amount ?? (it.unitPrice || 0) * (it.quantity || 0),
  }));
  const totals = computeQuoteTotals(items, { shippingFee: b.shippingFee, discount: b.discount, tax: b.tax });
  // quoteNo
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
  const seq = String(Math.floor(1000 + Math.random() * 9000));
  const quoteNo = b.quoteNo || `${CODE_PREFIXES.QUOTE}-${ymd}-${seq}`;
  try {
    const q = await Quote.create({
      ...b,
      quoteNo,
      customerId: toId(b.customerId),
      inquiryId: toId(b.inquiryId),
      items,
      ...totals,
      validUntil: b.validUntil ? new Date(b.validUntil) : undefined,
      createdBy: b.createdBy ?? owner,
    } as any);
    // Inquiry stage → QUOTED
    if (q.inquiryId) {
      await Inquiry.updateOne({ _id: q.inquiryId }, [
        { $set: { stage: { $cond: [{ $in: ['$stage', ['WON','LOST']] }, '$stage', 'QUOTED'] } } },
      ] as any);
    }
    await Interaction.create({
      customerId: q.customerId,
      type: 'QUOTE_CREATED',
      title: `Quote ${q.quoteNo} created`,
      content: `Quote total ${q.currency} ${q.total}`,
      sourceRef: { model: 'Quote', id: q._id },
      ownerId: owner,
      occurredAt: new Date(),
    } as Partial<IInteraction>);
    ok(res, q.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Create quote failed'); }
});
router.patch('/quotes/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const doc = await Quote.findById(req.params.id);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, { ownerId: doc.createdBy })) return fail(res, 403, 403, 'Permission denied');
  const b = req.body || {};
  if (b.customerId) b.customerId = toId(b.customerId);
  if (b.inquiryId) b.inquiryId = toId(b.inquiryId);
  if (b.validUntil) b.validUntil = new Date(b.validUntil);
  const prevStatus = doc.status;
  try {
    let items = doc.items;
    if (Array.isArray(b.items)) {
      items = b.items.map((it: any) => ({
        ...it,
        productId: toId(it.productId),
        amount: it.amount ?? (it.unitPrice || 0) * (it.quantity || 0),
      }));
      b.items = items;
      const totals = computeQuoteTotals(items, {
        shippingFee: b.shippingFee ?? doc.shippingFee,
        discount: b.discount ?? doc.discount,
        tax: b.tax ?? doc.tax,
      });
      b.subtotal = totals.subtotal;
      b.shippingFee = totals.shippingFee;
      b.discount = totals.discount;
      b.tax = totals.tax;
      b.total = totals.total;
    }
    Object.assign(doc, b);
    await doc.save();
    // 如果状态 SENT，写 interaction
    if (prevStatus !== 'SENT' && doc.status === 'SENT') {
      await Interaction.create({
        customerId: doc.customerId,
        type: 'QUOTE_SENT',
        title: `Quote ${doc.quoteNo} sent`,
        sourceRef: { model: 'Quote', id: doc._id },
        ownerId: doc.createdBy,
        occurredAt: new Date(),
      } as Partial<IInteraction>);
    }
    if (prevStatus !== 'ACCEPTED' && doc.status === 'ACCEPTED') {
      await Interaction.create({
        customerId: doc.customerId,
        type: 'QUOTE_ACCEPTED',
        title: `Quote ${doc.quoteNo} accepted`,
        sourceRef: { model: 'Quote', id: doc._id },
        ownerId: doc.createdBy,
        occurredAt: new Date(),
      } as Partial<IInteraction>);
      if (doc.inquiryId) await Inquiry.updateOne({ _id: doc.inquiryId }, { stage: 'WON' });
    }
    if (prevStatus !== 'REJECTED' && doc.status === 'REJECTED') {
      await Interaction.create({
        customerId: doc.customerId,
        type: 'QUOTE_REJECTED',
        title: `Quote ${doc.quoteNo} rejected`,
        sourceRef: { model: 'Quote', id: doc._id },
        ownerId: doc.createdBy,
        occurredAt: new Date(),
      } as Partial<IInteraction>);
      if (doc.inquiryId) await Inquiry.updateOne({ _id: doc.inquiryId }, { stage: 'LOST' });
    }
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Update failed'); }
});

/** Quote ACCEPTED → Order（生成 dealer 模式订单，无链上支付字段空壳；后续可再进入支付流程） */
router.post('/quotes/:id/convert-order', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return fail(res, 400, 400, 'Invalid id');
  const q = await Quote.findById(req.params.id);
  if (!q) return fail(res, 404, 404, 'Quote not found');
  if (!isWritable(req, { ownerId: q.createdBy })) return fail(res, 403, 403, 'Permission denied');
  if (q.status !== 'ACCEPTED') return fail(res, 400, 400, 'Quote must be ACCEPTED first');

  const owner = toId(req.admin!.id)!;
  // 拉取 customer + company 取 contactInfo
  const customer = q.customerId ? await Customer.findById(q.customerId) : null;
  const company = customer?.companyId ? await Company.findById(customer.companyId) : null;
  const primaryContact = customer ? await Contact.findOne({ customerId: customer._id }).sort({ isPrimary: -1 }) : null;

  const companyName = company?.name ?? 'Unknown';
  // 直接复用 backend Order 模型生成幂等 orderNo
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
  const orderNo = `SO-${ymd}-${String(Math.floor(100000 + Math.random() * 900000))}`;

  const items: any[] = q.items.map((qi) => ({
    productId: qi.productId ? String(qi.productId) : '',
    name: qi.name,
    price: qi.unitPrice,
    qty: qi.quantity,
  }));
  const totalAmount = q.total;
  const usdtAmount = q.total; // USD ≈ USDT 1:1
  const expireAt = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const order = await Order.create({
      orderNo,
      orderType: 'dealer',
      items,
      totalAmount,
      usdtAmount,
      usdtTolerance: 0.01,
      contactInfo: {
        name: primaryContact?.name || companyName,
        email: primaryContact?.email || '',
        whatsapp: primaryContact?.whatsapp || '',
        phone: primaryContact?.phone || '',
        country: company?.country || '',
        company: companyName,
        shippingCountry: company?.country || '',
      },
      dealerInfo: {
        company: companyName,
        whatsapp: primaryContact?.whatsapp || '',
        country: company?.country || '',
        website: company?.website || '',
        tags: customer?.tags || [],
      },
      customDemand: q.notes || '',
      paymentMethod: 'USDT-TRC20',
      orderExpireAt: expireAt,
      walletAddress: env.MERCHANT_WALLET_TRON || '',
      tronNetwork: env.TRON_NETWORK || 'nile',
      usdtContractAddress: env.usdtContract || '',
      paymentStatus: 'pending',
      // CRM 关联
      customerId: q.customerId,
      inquiryId: q.inquiryId,
      quoteId: q._id,
      ownerId: q.createdBy || owner,
    } as Partial<IOrder>);

    await Interaction.create({
      customerId: q.customerId,
      type: 'ORDER_CREATED',
      title: `Order ${order.orderNo} created from quote`,
      content: `From quote ${q.quoteNo}, total USD ${q.total}`,
      sourceRef: { model: 'Order', id: order._id },
      ownerId: owner,
      occurredAt: new Date(),
    } as Partial<IInteraction>);

    ok(res, order.toObject());
  } catch (e: any) {
    fail(res, 500, 500, e?.message || 'Convert order failed');
  }
});

// ========================================================================
//  11. Orders（Console 视角：只读 + status + setQuote/setCustomer）
// ========================================================================
router.get('/orders', async (req: AuthRequest, res) => {
  const { page, pageSize, skip } = parsePage(req.query);
  const base: FilterQuery<IOrder> = readScope(req);
  const q = req.query;
  if (q.customerId) base.customerId = toId(q.customerId as string);
  if (q.quoteId)    base.quoteId = toId(q.quoteId as string);
  if (q.inquiryId)  base.inquiryId = toId(q.inquiryId as string);
  if (q.orderNo)    base.orderNo = { $regex: q.orderNo as string, $options: 'i' };
  if (q.paymentStatus) base.paymentStatus = q.paymentStatus as any;
  if (q.search) {
    const s = (q.search as string).trim();
    if (s) {
      // 通用搜索：按 contactInfo 模糊匹配（email/phone/whatsapp/company/name）
      // 用 $and 合并，避免覆盖 readScope 的 $or（非超管权限过滤）
      const searchOr = { $or: [
        { 'contactInfo.email':    { $regex: s, $options: 'i' } },
        { 'contactInfo.phone':    { $regex: s, $options: 'i' } },
        { 'contactInfo.whatsapp': { $regex: s, $options: 'i' } },
        { 'contactInfo.company':  { $regex: s, $options: 'i' } },
        { 'contactInfo.name':     { $regex: s, $options: 'i' } },
      ]};
      base.$and = base.$and ? [...(base.$and as any[]), searchOr] : [searchOr];
    }
  }
  ok(res, await paginate<IOrder>(Order, base, page, pageSize, skip));
});
router.get('/orders/:id', async (req: AuthRequest, res) => {
  const idOrNo = req.params.id;
  let base: FilterQuery<IOrder>;
  if (isValidObjectId(idOrNo)) base = { $and: [readScope(req), { _id: toId(idOrNo)! }] } as any;
  else base = { $and: [readScope(req), { orderNo: idOrNo }] } as any;
  const doc = await Order.findOne(base).lean();
  if (!doc) return fail(res, 404, 404, 'Not found');
  ok(res, doc);
});
router.patch('/orders/:id', async (req: AuthRequest, res) => {
  const idOrNo = req.params.id;
  const base: FilterQuery<IOrder> = isValidObjectId(idOrNo)
    ? { _id: toId(idOrNo)! } as any
    : { orderNo: idOrNo };
  const doc = await Order.findOne(base);
  if (!doc) return fail(res, 404, 404, 'Not found');
  if (!isWritable(req, doc)) return fail(res, 403, 403, 'Permission denied');
  const b = req.body || {};
  for (const k of ['customerId','inquiryId','quoteId','ownerId']) if (b[k]) b[k] = toId(b[k]);
  const prevStatus = doc.paymentStatus;
  try {
    Object.assign(doc, b);
    await doc.save();
    if (prevStatus !== 'paid' && doc.paymentStatus === 'paid') {
      await Interaction.create({
        customerId: doc.customerId,
        type: 'ORDER_PAID',
        title: `Order ${doc.orderNo} paid`,
        sourceRef: { model: 'Order', id: doc._id },
        ownerId: doc.ownerId,
        occurredAt: doc.paidAt || new Date(),
      } as Partial<IInteraction>);
    }
    ok(res, doc.toObject());
  } catch (e: any) { fail(res, 400, 400, e?.message || 'Update failed'); }
});

/**
 * DELETE /console/orders/:id — 删除订单（仅 superadmin，拒绝 paid 订单）
 * 路由设计：与 GET/PATCH 一致，支持 _id 或 orderNo；付费订单保留审计链路，
 *   应改用 PATCH /:id status=refunded/cancelled 而非物理删除。
 */
router.delete('/orders/:id', async (req: AuthRequest, res) => {
  // 1. 仅 superadmin 可调用
  if (req.admin?.role !== 'superadmin') return fail(res, 403, 403, 'Superadmin role required');
  // 2. 解析 id 或 orderNo
  const idOrNo = req.params.id;
  const base: FilterQuery<IOrder> = isValidObjectId(idOrNo)
    ? { _id: toId(idOrNo)! } as any
    : { orderNo: idOrNo };
  const doc = await Order.findOne(base);
  if (!doc) return fail(res, 404, 404, 'Not found');
  // 3. 拒绝删除已支付订单（财务审计）
  if (doc.paymentStatus === 'paid') {
    return fail(res, 400, 400, 'Cannot delete paid order, use refunded/cancelled status instead');
  }
  // 4. 物理删除
  const orderNo = doc.orderNo;
  const oid = String(doc._id);
  await doc.deleteOne();
  ok(res, { deleted: true, _id: oid, orderNo });
});

// ========================================================================
//  12. Analytics overview（真实聚合，避免空数组占位以外的造假）
// ========================================================================
router.get('/analytics/overview', async (req: AuthRequest, res) => {
  const s = readScope(req);
  const withScope = (extra?: any): any => !Object.keys(s).length ? (extra ?? {}) : (extra ? { $and: [s, extra] } : s);
  const [totalLeads, totalInquiries, totalQuotes, totalOrders, bySource, byCountry] = await Promise.all([
    Lead.countDocuments(withScope()),
    Inquiry.countDocuments(withScope()),
    Quote.countDocuments(withScope()),
    Order.countDocuments(withScope({ paymentStatus: 'paid' })),
    Lead.aggregate([
      { $match: withScope() as any },
      { $group: { _id: '$source', leads: { $sum: 1 } } },
      { $project: { _id: 0, source: { $ifNull: ['$_id', 'unknown'] }, leads: 1, orders: 0, revenue: 0 } },
    ]),
    Lead.aggregate([
      { $match: withScope({ country: { $exists: true, $ne: '' } }) as any },
      { $group: { _id: '$country', leads: { $sum: 1 } } },
      { $project: { _id: 0, country: '$_id', leads: 1, orders: 0, revenue: 0 } },
    ]),
  ]);
  ok(res, {
    period: '30d',
    funnels: { leads: totalLeads, inquiries: totalInquiries, quotes: totalQuotes, orders: totalOrders },
    bySource, byCountry,
    byProduct: [],
    bySalesRep: [],
  });
});

export default router;

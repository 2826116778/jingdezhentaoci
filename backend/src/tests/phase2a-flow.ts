/**
 * PHASE 2-A 业务流程真实集成测试（Memory MongoDB，不污染正式 DB）
 * 运行：
 *   cd /workspace/backend && npx ts-node -T -r tsconfig-paths/register src/tests/phase2a-flow.ts
 *
 * 覆盖：
 *  1) Admin 创建（superadmin + editor 两个角色）
 *  2) Lead CRUD
 *  3) Lead -> Customer 转换（Company + Contact + Customer + Interaction）
 *  4) Company / Contact CRUD
 *  5) FollowUp CRUD + Customer FollowUp 快捷接口
 *  6) Task CRUD
 *  7) Customer -> Inquiry（真实 CRUD）
 *  8) Inquiry -> Quote（QuoteItem 计算）
 *  9) Quote ACCEPTED -> Order（关联 quoteId/inquiryId/customerId）
 *  10) Dashboard summary 真实聚合（不空数组了）
 *  11) 权限：editor 角色跨 owner DELETE 应 403，superadmin 成功
 *  12) Interaction Timeline 关键事件存在
 */
process.env.NODE_ENV = 'test';
// TRON 收款钱包地址（Order 模型 required 字段）— 测试环境使用 Nile testnet 占位地址
process.env.MERCHANT_WALLET_TRON = process.env.MERCHANT_WALLET_TRON || 'TXa123456789012345678901234567890ab';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { types } from 'util';
import { Request, Response, NextFunction } from 'express';

import Admin from '../models/Admin';
import Lead, { ILead } from '../models/Lead';
import Company from '../models/Company';
import Contact from '../models/Contact';
import Customer from '../models/Customer';
import FollowUp from '../models/FollowUp';
import Task from '../models/Task';
import Interaction from '../models/Interaction';
import Quote from '../models/Quote';
import Inquiry from '../models/Inquiry';
import Order from '../models/Order';

// 引入 console Router 后，通过 router.stack 查找 handler
import consoleRouter from '../routes/console';
import { AuthRequest } from '../middleware/authJWT';

type Resp = {
  status?: number;
  sent?: any;
  json?: any;
};
function makeRes(): Response & Resp {
  const r: any = {};
  r.status = (code: number) => { r.status = code; return r; };
  r.json = (body: any) => { r.sent = body; return r; };
  r.send = (body: any) => { r.sent = body; return r; };
  r.end = () => { if (r.sent === undefined) r.sent = null; return r; };
  return r as Response & Resp;
}

interface AdminUser {
  id: string;
  username: string;
  role: 'superadmin' | 'editor';
}

function req(user: AdminUser, params: any = {}, body: any = {}, query: any = {}): AuthRequest {
  return {
    params, body, query,
    headers: {},
    admin: { id: user.id, username: user.username, role: user.role },
  } as unknown as AuthRequest;
}

const results: Array<{ name: string; pass: boolean; detail?: any }> = [];
function test(name: string, fn: () => Promise<boolean> | boolean) {
  return (async () => {
    try {
      const ok = await fn();
      results.push({ name, pass: !!ok });
      return !!ok;
    } catch (e: any) {
      results.push({ name, pass: false, detail: e?.message || String(e) });
      return false;
    }
  })();
}
async function assert(cond: any, msg?: string) {
  if (!cond) throw new Error(msg || 'assert failed');
  return true;
}

/**
 * 从 consoleRouter 栈里找 handler（只需要 path+method 匹配的最后一个 middleware，即业务 handler；
 * 由于 authJWT 是全局挂载的，我们此处直接调第二个 layer 的 handle——更稳妥：按 layer.route.methods 匹配。）
 */
function findHandler(method: 'get' | 'post' | 'patch' | 'delete', pathPattern: string) {
  // pathPattern 形如 "/leads/:id/convert"；Express layer.route.path 是带 :param 的 regexp or string
  for (const layer of (consoleRouter as any).stack) {
    if (!layer?.route) continue;
    const routePath = String(layer.route.path);
    const methods = layer.route.methods || {};
    const m = method.toLowerCase();
    if (routePath === pathPattern && methods[m]) {
      // route.stack 多个 handler（authJWT 是第一个，业务 handler 是最后一个）
      const stack = layer.route.stack || [];
      // 由于单元测试直接调用不需要 authJWT，直接取最后一个 handler
      const last = stack[stack.length - 1];
      return last.handle as (req: Request, res: Response, next?: NextFunction) => any;
    }
  }
  throw new Error(`找不到路由 handler: ${method.toUpperCase()} ${pathPattern}`);
}
async function call(method: 'get' | 'post' | 'patch' | 'delete', pathPattern: string, user: AdminUser, params: any = {}, body: any = {}, query: any = {}) {
  const h = findHandler(method, pathPattern);
  const r = req(user, params, body, query);
  const res: any = makeRes();
  await new Promise<void>((resolve, reject) => {
    try {
      const ret = h(r, res, (err?: any) => {
        if (err) reject(err); else resolve();
      });
      if (ret && typeof ret.then === 'function') {
        ret.then(() => resolve()).catch(reject);
      } else {
        // handler 没有 next 调用也没有返回 promise，则同步完成
        setImmediate(resolve);
      }
    } catch (e) { reject(e); }
  });
  // 若 handler 未调用 res.status(...)（如本地 ok() 只调 json），视为 200
  const status = typeof res.status === 'number' ? res.status : 200;
  return { status, body: res.sent };
}

async function main() {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  try {
    // —— 1. Admin 种子用户
    const pwdHash = await bcrypt.hash('admin123', 4);
    const sa = await Admin.create({ username: 'phase2a_super', passwordHash: pwdHash, role: 'superadmin' });
    const ed1 = await Admin.create({ username: 'phase2a_ed1', passwordHash: pwdHash, role: 'editor' });
    const ed2 = await Admin.create({ username: 'phase2a_ed2', passwordHash: pwdHash, role: 'editor' });
    const superA: AdminUser = { id: String(sa._id), username: sa.username, role: 'superadmin' };
    const editorA: AdminUser = { id: String(ed1._id), username: ed1.username, role: 'editor' };
    const editorB: AdminUser = { id: String(ed2._id), username: ed2.username, role: 'editor' };

    // —— 2. Lead CRUD (POST / GET list / GET by id / PATCH / DELETE temp)
    let leadId = '';
    await test('Lead:POST 创建', async () => {
      const r = await call('post', '/leads', superA, {}, {
        companyName: 'Phoenix Ceramics Trading LLC',
        website: 'https://phoenixceramics.example',
        country: 'UAE',
        city: 'Dubai',
        industry: 'hospitality',
        companyType: 'wholesaler',
        contactName: 'Amira H.',
        jobTitle: 'Procurement Manager',
        email: 'amira@phoenixceramics.example',
        phone: '+971-50-0000001',
        whatsapp: '+971-50-0000001',
        linkedin: '',
        source: 'exhibition',
        status: 'NEW',
        score: 78,
        grade: 'A',
        tags: ['vip','dubai','hotel-project'],
        notes: 'Interested in custom tableware for a new 5-star hotel.',
      });
      await assert(r.body?.code === 0 || r.status === 200, JSON.stringify(r.body));
      leadId = String(r.body?.data?._id);
      return !!leadId;
    });

    await test('Lead:GET/:id 读取', async () => {
      const r = await call('get', '/leads/:id', superA, { id: leadId });
      return r.body?.data?._id && String(r.body.data._id) === leadId;
    });

    await test('Lead:GET 列表分页 items/total 含新Lead', async () => {
      const r = await call('get', '/leads', superA, {}, {}, { page: 1, pageSize: 10, country: 'UAE' });
      return r.body?.data?.total >= 1 && r.body.data.items.some((l: any) => String(l._id) === leadId);
    });

    await test('Lead:PATCH 改状态为 QUALIFIED + score=90', async () => {
      const r = await call('patch', '/leads/:id', superA, { id: leadId }, { status: 'QUALIFIED', score: 90 });
      await assert(r.body?.code === 0, `PATCH lead resp: ${JSON.stringify(r.body)}`);
      const doc = await Lead.findById(leadId).lean();
      await assert(doc?.status === 'QUALIFIED', `Expected status QUALIFIED, got ${doc?.status}`);
      await assert(doc?.score === 90, `Expected score 90, got ${doc?.score}`);
      return true;
    });

    await test('Lead:Interaction LEAD_CREATED 已写入', async () => {
      const n = await Interaction.countDocuments({ leadId: new mongoose.Types.ObjectId(leadId), type: 'LEAD_CREATED' });
      return n === 1;
    });

    // —— 3. Lead → Customer CONVERT
    let customerId = '', companyId = '', contactId = '';
    await test('Lead→Customer:POST /leads/:id/convert', async () => {
      const r = await call('post', '/leads/:id/convert', superA, { id: leadId }, { customerLevel: 'GOLD' });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      customerId = String(r.body.data?.customer?._id);
      companyId = String(r.body.data?.company?._id);
      contactId = String(r.body.data?.contact?._id);
      return !!customerId && !!companyId && !!contactId;
    });

    await test('Lead 转换后状态=CONVERTED + customerId', async () => {
      const doc = await Lead.findById(leadId).lean();
      return doc?.status === 'CONVERTED' && String(doc.customerId) === customerId;
    });

    await test('Company/Contact/Customer 三集合真实文档存在', async () => {
      const [c1, c2, c3] = await Promise.all([
        Company.findById(companyId).lean(),
        Contact.findById(contactId).lean(),
        Customer.findById(customerId).lean(),
      ]);
      return !!(c1 && c2 && c3) && c2.isPrimary === true;
    });

    await test('Interaction LEAD_CONVERTED 事件存在', async () => {
      const n = await Interaction.countDocuments({
        customerId: new mongoose.Types.ObjectId(customerId),
        leadId: new mongoose.Types.ObjectId(leadId),
        type: 'LEAD_CONVERTED',
      });
      return n === 1;
    });

    // —— 4. Company / Contact / Customer CRUD
    await test('Customer:GET/:id 基础详情 (customer+company+contacts 聚合)', async () => {
      const r = await call('get', '/customers/:id', superA, { id: customerId });
      await assert(r.body?.code === 0, JSON.stringify(r.body));
      const d = r.body.data;
      await assert(String(d?.customer?._id) === customerId, 'customer._id mismatch');
      await assert(String(d?.company?._id) === companyId, 'company._id mismatch');
      await assert(Array.isArray(d?.contacts) && d.contacts.length >= 1, 'contacts empty');
      await assert(Array.isArray(d?.timeline) && d.timeline.length >= 1, 'timeline empty');
      return true;
    });

    await test('Company:PATCH 修改 website/industry', async () => {
      const r = await call('patch', '/companies/:id', superA, { id: companyId }, { website: 'https://updated-phoenix.example', industry: 'luxury_goods' });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const c = await Company.findById(companyId).lean();
      return c?.industry === 'luxury_goods';
    });

    await test('Contact:POST 为 Company 加第二个联系人', async () => {
      const r = await call('post', '/contacts', superA, {}, {
        companyId, customerId,
        name: 'Khalid S.', jobTitle: 'CEO',
        email: 'khalid@phoenixceramics.example',
        phone: '+971-50-0000002', isPrimary: false,
      });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const n = await Contact.countDocuments({ companyId: new mongoose.Types.ObjectId(companyId) });
      return n === 2;
    });

    // —— 5. FollowUp CRUD
    let fuId = '';
    await test('FollowUp:POST 新建跟进(EMAIL PENDING)', async () => {
      const r = await call('post', '/followups', superA, {}, {
        customerId, leadId,
        type: 'EMAIL',
        content: 'Sent catalog + custom samples offer',
        scheduledAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
        status: 'PENDING',
      });
      await assert(r.status === 200 && r.body?.code === 0);
      fuId = String(r.body.data?._id);
      return !!fuId && await Interaction.countDocuments({ customerId: new mongoose.Types.ObjectId(customerId), type: 'FOLLOWUP_CREATED' }) >= 1;
    });

    await test('FollowUp:PATCH 标记完成', async () => {
      const r = await call('patch', '/followups/:id', superA, { id: fuId }, { status: 'COMPLETED', result: 'Replied, wants quote within 3 days', completedAt: new Date().toISOString() });
      await assert(r.status === 200 && r.body?.code === 0);
      const f = await FollowUp.findById(fuId).lean();
      return f?.status === 'COMPLETED';
    });

    // —— 6. Task CRUD
    let taskId = '';
    await test('Task:POST 创建 URGENT TODO', async () => {
      const r = await call('post', '/tasks', superA, {}, {
        title: 'Prepare Phoenix Ceramics quote draft',
        customerId,
        type: 'QUOTE_PREPARE',
        priority: 'URGENT',
        status: 'TODO',
        dueAt: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      });
      await assert(r.status === 200 && r.body?.code === 0);
      taskId = String(r.body.data?._id);
      return !!taskId;
    });
    await test('Task:PATCH 状态 IN_PROGRESS', async () => {
      const r = await call('patch', '/tasks/:id', superA, { id: taskId }, { status: 'IN_PROGRESS' });
      const t = await Task.findById(taskId).lean();
      return r.status === 200 && t?.status === 'IN_PROGRESS';
    });

    // —— 7. Customer → Inquiry
    let inqId = '';
    await test('Inquiry:POST 新建询盘关联 customerId', async () => {
      const r = await call('post', '/inquiries', superA, {}, {
        customerId, companyId,
        name: 'Amira H.', email: 'amira@phoenixceramics.example',
        message: 'Custom dinnerware for 250 tables, porcelain with gold rim.',
        priority: 'HIGH', source: 'exhibition', stage: 'QUALIFIED',
        estimatedValue: 48000,
      });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      inqId = String(r.body.data?._id);
      return !!inqId;
    });
    await test('Inquiry stage 已写入 QUALIFIED + 关联 customerId', async () => {
      const d = await Inquiry.findById(inqId).lean();
      return d?.stage === 'QUALIFIED' && String(d.customerId) === customerId;
    });

    // —— 8. Inquiry → Quote（含 items 小计）
    let quoteId = '';
    await test('Quote:POST 新建报价单 (含 2 items + 运费 + 折扣 + 税)', async () => {
      const r = await call('post', '/quotes', superA, {}, {
        customerId, inquiryId: inqId,
        currency: 'USD',
        items: [
          { name: 'Gold Rim Dinner Plate 28cm', sku: 'JZ-GDP-28', quantity: 400, unitPrice: 18 },
          { name: 'Gold Rim Soup Bowl 14cm', sku: 'JZ-GSB-14', quantity: 400, unitPrice: 12 },
        ],
        shippingFee: 600, discount: 200, tax: 150,
        incoterm: 'FOB', paymentTerms: '30% deposit, 70% against B/L copy',
        validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        status: 'DRAFT', notes: 'Customer requested 2 samples by courier.',
      });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      quoteId = String(r.body.data?._id);
      const q = await Quote.findById(quoteId).lean();
      // subtotal = 400*18 + 400*12 = 7200 + 4800 = 12000
      // total = 12000 + 600 - 200 + 150 = 12550
      return !!q && q.subtotal === 12000 && q.total === 12550;
    });

    await test('Quote:PATCH 状态 -> SENT', async () => {
      const r = await call('patch', '/quotes/:id', superA, { id: quoteId }, { status: 'SENT' });
      await assert(r.status === 200 && r.body?.code === 0);
      return !!await Interaction.countDocuments({
        customerId: new mongoose.Types.ObjectId(customerId),
        type: 'QUOTE_SENT',
        'sourceRef.id': new mongoose.Types.ObjectId(quoteId),
      });
    });

    await test('Quote:PATCH 状态 -> ACCEPTED 后 Inquiry.stage = WON', async () => {
      const r = await call('patch', '/quotes/:id', superA, { id: quoteId }, { status: 'ACCEPTED' });
      await assert(r.status === 200 && r.body?.code === 0);
      const inq = await Inquiry.findById(inqId).lean();
      const inter = await Interaction.countDocuments({ customerId: new mongoose.Types.ObjectId(customerId), type: 'QUOTE_ACCEPTED' });
      return inq?.stage === 'WON' && inter >= 1;
    });

    // —— 9. Quote ACCEPTED → Order
    let orderId = '';
    await test('Quote:convert-order 生成 Order (关联 customerId/inquiryId/quoteId)', async () => {
      const r = await call('post', '/quotes/:id/convert-order', superA, { id: quoteId });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      orderId = String(r.body.data?._id);
      const o = await Order.findById(orderId).lean();
      return !!o
        && String(o.customerId) === customerId
        && String(o.inquiryId) === inqId
        && String(o.quoteId) === quoteId
        && o.orderNo?.startsWith('SO-')
        && !!o.walletAddress
        && !!o.usdtContractAddress;
    });

    await test('Order: 金额 USD 来自 Quote total', async () => {
      const o = await Order.findById(orderId).lean();
      // 模型有 totalAmount 还是 amount？实际断言 totalAmount === quote total
      const o2 = o as any;
      const quote = await Quote.findById(quoteId).lean();
      return o2.totalAmount === quote?.total;
    });

    await test('Interaction ORDER_CREATED 已记录', async () => {
      return 1 === await Interaction.countDocuments({
        customerId: new mongoose.Types.ObjectId(customerId),
        type: 'ORDER_CREATED',
        'sourceRef.id': new mongoose.Types.ObjectId(orderId),
      });
    });

    await test('Customer:GET/:id 360 详情 (timeline+inquiries+quotes+orders+followups+tasks 全部非空)', async () => {
      const r = await call('get', '/customers/:id', superA, { id: customerId });
      await assert(r.body?.code === 0, JSON.stringify(r.body));
      const d = r.body.data;
      await assert(String(d?.customer?._id) === customerId, 'customer._id mismatch');
      await assert(d?.timeline?.length >= 7, `timeline length=${d?.timeline?.length}`);
      await assert(d?.inquiries?.length >= 1, 'inquiries empty');
      await assert(d?.quotes?.length >= 1, 'quotes empty');
      await assert(d?.orders?.length >= 1, 'orders empty');
      await assert(d?.followups?.length >= 1, 'followups empty');
      await assert(d?.tasks?.length >= 1, 'tasks empty');
      return true;
    });

    // —— 10. Dashboard summary 非 0 统计
    await test('Dashboard:/summary KPI 真实聚合 totalLeads>=1 totalCustomers>=1', async () => {
      const r = await call('get', '/dashboard/summary', superA);
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const d = r.body.data;
      return d.kpis.totalLeads >= 1
        && d.kpis.totalCustomers >= 1
        && d.kpis.totalInquiries >= 1
        && d.kpis.totalQuotes >= 1
        && d.kpis.totalOrders >= 1
        && d.kpis.totalOrderAmountUsd >= 12550
        && d.kpis.pendingTasks >= 1
        && d.kpis.conversionRate > 0;
    });

    await test('Dashboard:/summary 图表 leadsLast30Days 不为空', async () => {
      const r = await call('get', '/dashboard/summary', superA);
      const d = r.body.data;
      return Array.isArray(d.charts.leadsLast30Days)
        && Array.isArray(d.charts.ordersLast30Days)
        && Array.isArray(d.charts.inquiriesBySource)
        && d.charts.inquiriesBySource.some((x: any) => x.source === 'exhibition')
        && d.charts.topCountries.some((x: any) => x.country === 'UAE');
    });

    // —— 11. 权限：editorB 删除 editorA 独占 Lead => 403；superadmin 可删除
    //   先让 editorA 创建一个自己的 Lead
    let privateLeadId = '';
    await test('权限: editorA 创建 Lead (ownerId === editorA)', async () => {
      const r = await call('post', '/leads', editorA, {}, {
        companyName: 'Abu Dhabi Boutique Designs',
        country: 'UAE', status: 'NEW', source: 'manual',
      });
      privateLeadId = String(r.body.data?._id);
      const l = await Lead.findById(privateLeadId).lean();
      return !!privateLeadId && String(l?.ownerId) === editorA.id;
    });
    await test('权限: editorB 无权 DELETE editorA 的 Lead (403)', async () => {
      const r = await call('delete', '/leads/:id', editorB, { id: privateLeadId });
      return (r.status === 403 || r.body?.code === 403)
        && !!await Lead.exists({ _id: privateLeadId });
    });
    await test('权限: editorA 可以 PATCH 自己的 Lead', async () => {
      const r = await call('patch', '/leads/:id', editorA, { id: privateLeadId }, { status: 'CONTACTED' });
      return r.status === 200 && r.body?.code === 0;
    });
    await test('权限: editorB 列表看不到 editorA 独占 Lead (ownerId scope 过滤)', async () => {
      const r = await call('get', '/leads', editorB, {}, {}, { page: 1, pageSize: 100 });
      const ids: string[] = (r.body?.data?.items || []).map((x: any) => String(x._id));
      return !ids.includes(privateLeadId);
    });
    await test('权限: superadmin 可删除 editorA 的 Lead', async () => {
      const r = await call('delete', '/leads/:id', superA, { id: privateLeadId });
      return r.status === 200 && !(await Lead.exists({ _id: privateLeadId }));
    });

    // —— 12. Customer Timeline：至少包含关键事件序列
    await test('Timeline: Customer timeline 包含关键事件序列', async () => {
      const list = await Interaction.find({ customerId: new mongoose.Types.ObjectId(customerId) })
        .sort({ occurredAt: 1 }).lean();
      const types = list.map(x => x.type);
      const need = ['LEAD_CONVERTED','FOLLOWUP_CREATED','INQUIRY_CREATED','QUOTE_CREATED','QUOTE_SENT','QUOTE_ACCEPTED','ORDER_CREATED'];
      return need.every(t => types.includes(t as any));
    });

    // —— 清理：删除测试中所有以 phase2a_ 开头的用户（仅示例，MongoMemory 会丢弃，所以不强制）

  } finally {
    try { await mongoose.disconnect(); } catch {}
    try { await mongo.stop(); } catch {}
  }

  // 输出报告
  const pass = results.filter(r => r.pass).length;
  const total = results.length;
  console.log('\n================ PHASE 2-A FLOW TEST REPORT ================');
  console.log(`Total: ${total}, PASS: ${pass}, FAIL: ${total - pass}`);
  for (const r of results) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? '  → ' + String(r.detail).slice(0, 160) : ''}`);
  }
  console.log('================ END REPORT ================\n');
  process.exit(total - pass === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });

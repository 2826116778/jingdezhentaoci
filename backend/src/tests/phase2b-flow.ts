/**
 * PHASE 2-B 海外客户开发中心 业务流程真实集成测试（Memory MongoDB，不污染正式 DB）
 * 运行：
 *   cd /workspace/backend && npx ts-node -T -r tsconfig-paths/register src/tests/phase2b-flow.ts
 *
 * 覆盖规范 §1-45：
 *  1)  MarketConfig：创建 UAE 市场（priority 100 + cities）→ GET /markets
 *  2)  Campaign：POST /campaigns 创建 "Dubai Hotel Ceramic Buyers"
 *  3)  Import 上传：POST /imports/upload（rawData 数组）→ 返回 importId + preview
 *  4)  Import 字段映射：POST /imports/:id/map
 *  5)  Import 校验+去重：POST /imports/:id/validate → valid/invalid/duplicate 计数
 *  6)  Import 提交：POST /imports/:id/commit → 创建 Lead + LEAD_IMPORTED 互动 + importId/campaignId 可追溯
 *  7)  重复检测：第二次导入相同 email → validate 标记 DUPLICATE；SKIP 策略跳过；UPDATE 策略合并
 *  8)  Lead 评分：POST /scoring/score/:leadId → 0-100 + grade A/B/C/D + reasons
 *  9)  批量评分：POST /scoring/batch
 * 10)  Lead 批量操作：POST /leads/batch assignOwner / changeStatus / changeGrade / addTags / createDevTask / delete
 * 11)  Message Template：POST /templates + POST /templates/:id/preview 变量渲染
 * 12)  Development Task：POST /tasks + GET /tasks/:id 漏斗
 * 13)  Analytics：GET /analytics → funnel + byCampaign + bySource + byCountry
 * 14)  Overview：GET /overview → 真实聚合计数
 * 15)  权限：editorB 不能操作 editorA 独占的 Import (403)；列表 scope 过滤
 */
process.env.NODE_ENV = 'test';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

import Admin from '../models/Admin';
import Lead from '../models/Lead';
import LeadCampaign from '../models/LeadCampaign';
import LeadImport from '../models/LeadImport';
import LeadImportRow from '../models/LeadImportRow';
import MessageTemplate from '../models/MessageTemplate';
import DevelopmentTask from '../models/DevelopmentTask';
import MarketConfig from '../models/MarketConfig';
import Interaction from '../models/Interaction';

// 引入 development 子路由（含其自身 router.use(authJWT())，但测试直接调业务 handler）
import devRouter from '../routes/development';
import { AuthRequest } from '../middleware/authJWT';

type Resp = {
  status?: number;
  sent?: any;
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
 * 在 development 子路由栈里按 path + method 找业务 handler。
 * development router 顶部执行了 router.use(authJWT())，它是一个不带 layer.route 的中间件层；
 * 每个 router.get/post/... 才有 layer.route，其 route.stack 只含业务 handler（authJWT 不在每条 route 内）。
 */
function findHandler(method: 'get' | 'post' | 'patch' | 'delete', pathPattern: string) {
  for (const layer of (devRouter as any).stack) {
    if (!layer?.route) continue;
    const routePath = String(layer.route.path);
    const methods = layer.route.methods || {};
    const m = method.toLowerCase();
    if (routePath === pathPattern && methods[m]) {
      const stack = layer.route.stack || [];
      return stack[stack.length - 1].handle as (req: Request, res: Response, next?: NextFunction) => any;
    }
  }
  throw new Error(`找不到 development 路由 handler: ${method.toUpperCase()} ${pathPattern}`);
}
async function call(method: 'get' | 'post' | 'patch' | 'delete', pathPattern: string, user: AdminUser, params: any = {}, body: any = {}, query: any = {}) {
  const h = findHandler(method, pathPattern);
  const r = req(user, params, body, query);
  const res: any = makeRes();
  await new Promise<void>((resolve, reject) => {
    try {
      const ret = h(r, res, (err?: any) => { if (err) reject(err); else resolve(); });
      if (ret && typeof ret.then === 'function') ret.then(() => resolve()).catch(reject);
      else setImmediate(resolve);
    } catch (e) { reject(e); }
  });
  const status = typeof res.status === 'number' ? res.status : 200;
  return { status, body: res.sent };
}

async function main() {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  try {
    // —— 0. Admin 种子
    const pwdHash = await bcrypt.hash('admin123', 4);
    const sa = await Admin.create({ username: 'p2b_super', passwordHash: pwdHash, role: 'superadmin' });
    const ed1 = await Admin.create({ username: 'p2b_ed1', passwordHash: pwdHash, role: 'editor' });
    const ed2 = await Admin.create({ username: 'p2b_ed2', passwordHash: pwdHash, role: 'editor' });
    const superA: AdminUser = { id: String(sa._id), username: sa.username, role: 'superadmin' };
    const editorA: AdminUser = { id: String(ed1._id), username: ed1.username, role: 'editor' };
    const editorB: AdminUser = { id: String(ed2._id), username: ed2.username, role: 'editor' };

    // —— 1. MarketConfig（§6/§22 国家优先级进 DB，不硬编码）
    let uaeMarketId = '';
    await test('Market:POST /markets 创建 UAE (priority=100 + cities)', async () => {
      const r = await call('post', '/markets', superA, {}, {
        countryCode: 'AE', countryName: 'UAE',
        priority: 100, isActive: true,
        cities: ['Dubai', 'Abu Dhabi', 'Sharjah'],
        defaultProductInterests: ['Hotelware', 'Dinnerware', 'Coffee Set', 'Tea Set', 'Custom Ceramics'],
        notes: 'Top priority market — Dubai hospitality projects',
      });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      uaeMarketId = String(r.body.data?._id);
      return !!uaeMarketId;
    });
    await test('Market:GET /markets 返回 UAE 且 priority=100', async () => {
      const r = await call('get', '/markets', superA);
      await assert(r.body?.code === 0, JSON.stringify(r.body));
      const list = r.body.data || [];
      const uae = list.find((m: any) => m.countryCode === 'AE');
      return !!uae && uae.priority === 100 && uae.cities.includes('Dubai');
    });

    // —— 2. Campaign（§5 创建开发活动）
    let campaignId = '';
    await test('Campaign:POST /campaigns 创建 "Dubai Hotel Ceramic Buyers"', async () => {
      const r = await call('post', '/campaigns', superA, {}, {
        name: 'Dubai Hotel Ceramic Buyers',
        description: '5-star hotel tableware procurement in UAE',
        countries: ['UAE'],
        cities: ['Dubai', 'Abu Dhabi'],
        industries: ['Hotel', 'Hospitality'],
        companyTypes: ['Hotel', 'Importer', 'Wholesaler'],
        productInterests: ['Hotelware', 'Dinnerware', 'Coffee Set', 'Tea Set', 'Custom Ceramics'],
        targetLeadCount: 100,
        status: 'ACTIVE',
        startDate: new Date().toISOString(),
      });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      campaignId = String(r.body.data?._id);
      return !!campaignId;
    });
    await test('Campaign:GET /campaigns/:id 含 funnel 字段', async () => {
      const r = await call('get', '/campaigns/:id', superA, { id: campaignId });
      await assert(r.body?.code === 0, JSON.stringify(r.body));
      return r.body.data?.funnel && Array.isArray(r.body.data.countries) && r.body.data.countries.includes('UAE');
    });

    // —— 3-6. Import 流程：Upload → Map → Validate → Commit（§12-18）
    //   Row1: 有效 Dubai hotel（email a@dubaihotel.example）
    //   Row2: 无效（缺 companyName）
    //   Row3: 有效 Riyadh wholesaler（不同 email，避免与 Row1 互相去重）
    let importAId = '';
    const colsA = ['Company Name', 'Country', 'City', 'Industry', 'Company Type', 'Contact Name', 'Email', 'WhatsApp', 'Website'];
    const rowsA = [
      { 'Company Name': 'Burj Luxury Hotels LLC', Country: 'UAE', City: 'Dubai', Industry: 'Hotel', 'Company Type': 'Hotel', 'Contact Name': 'Amira Hassan', Email: 'amira@burjluxury.example', WhatsApp: '+971-50-1112223', Website: 'https://burjluxury.example' },
      { 'Company Name': '', Country: 'UAE', City: 'Sharjah', Industry: 'Retailer', 'Company Type': 'Retailer', 'Contact Name': '', Email: 'bad-email', WhatsApp: '', Website: '' },
      { 'Company Name': 'Riyadh Ceramics Trading', Country: 'Saudi Arabia', City: 'Riyadh', Industry: 'Ceramic Wholesaler', 'Company Type': 'Wholesaler', 'Contact Name': 'Faisal Al-Otaibi', Email: 'faisal@riyadhceramics.example', WhatsApp: '+966-50-2223344', Website: 'https://riyadhceramics.example' },
    ];
    const mappingA: Record<string, string> = {
      'Company Name': 'companyName', 'Country': 'country', 'City': 'city', 'Industry': 'industry',
      'Company Type': 'companyType', 'Contact Name': 'contactName', 'Email': 'email',
      'WhatsApp': 'whatsapp', 'Website': 'website',
    };

    await test('Import:POST /imports/upload 接收 rawData 数组 (§13)', async () => {
      const r = await call('post', '/imports/upload', superA, {}, {
        fileName: 'uae_hotel_buyers.csv', fileType: 'csv', fileSize: 1024,
        rawData: rowsA, campaignId, duplicateStrategy: 'SKIP',
      });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      importAId = String(r.body.data?.importId);
      return !!importAId && r.body.data?.totalRows === 3 && Array.isArray(r.body.data?.preview);
    });

    await test('Import:POST /imports/:id/map 字段映射 (§15)', async () => {
      const r = await call('post', '/imports/:id/map', superA, { id: importAId }, { fieldMapping: mappingA });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      // 预览应反映映射后的字段
      const preview = r.body.data?.preview || [];
      return preview.length > 0 && preview[0].companyName === 'Burj Luxury Hotels LLC';
    });

    await test('Import:POST /imports/:id/validate 校验+去重 (§16-17) → valid=2 invalid=1', async () => {
      const r = await call('post', '/imports/:id/validate', superA, { id: importAId }, {});
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const d = r.body.data;
      // 首次导入：DB 无 Lead，故无重复；有效 2 条，无效 1 条（缺 companyName + 邮箱格式错）
      return d.validRows === 2 && d.invalidRows === 1 && d.duplicateRows === 0;
    });

    await test('Import:POST /imports/:id/commit 写入 Lead + LEAD_IMPORTED + 可追溯 importId/campaignId (§44)', async () => {
      const r = await call('post', '/imports/:id/commit', superA, { id: importAId }, {});
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const d = r.body.data;
      if (!(d.imported === 2 && d.skipped === 1)) return false;
      // 校验：Lead 带 importId + campaignId + researchType=IMPORTED_DATA
      const leads = await Lead.find({ importId: importAId }).lean();
      if (leads.length !== 2) return false;
      const burj = leads.find((l: any) => l.companyName === 'Burj Luxury Hotels LLC');
      if (!burj || String(burj.campaignId) !== campaignId || burj.researchType !== 'IMPORTED_DATA') return false;
      // LEAD_IMPORTED 互动
      const inter = await Interaction.countDocuments({ type: 'LEAD_IMPORTED', leadId: burj._id });
      return inter === 1;
    });

    // —— 7. 重复检测：第二次导入 Burj 同 email → DUPLICATE；SKIP 跳过；UPDATE 合并
    let importBId = '';
    const rowsB = [
      { 'Company Name': 'Burj Luxury Hotels LLC', Country: 'UAE', City: 'Dubai', Industry: 'Hotel', 'Company Type': 'Hotel', 'Contact Name': 'Amira Hassan', Email: 'amira@burjluxury.example', WhatsApp: '+971-50-1112223', Website: 'https://burjluxury.example' },
      { 'Company Name': 'Doha Hospitality Group', Country: 'Qatar', City: 'Doha', Industry: 'Hotel', 'Company Type': 'Hotel', 'Contact Name': 'Nasser Al-Kuwari', Email: 'nasser@dohahospitality.example', WhatsApp: '+974-33-4445556', Website: 'https://dohahospitality.example' },
    ];
    await test('Dedup: 第二次导入相同 email → validate 标记 DUPLICATE (§17)', async () => {
      const up = await call('post', '/imports/upload', superA, {}, {
        fileName: 'duplicates.csv', fileType: 'csv', rawData: rowsB, campaignId, duplicateStrategy: 'SKIP',
      });
      importBId = String(up.body.data?.importId);
      await call('post', '/imports/:id/map', superA, { id: importBId }, { fieldMapping: mappingA });
      const r = await call('post', '/imports/:id/validate', superA, { id: importBId }, {});
      const d = r.body.data;
      return d.validRows === 1 && d.duplicateRows === 1 && d.invalidRows === 0;
    });
    await test('Dedup: commit SKIP 策略跳过重复 (§18 默认 Skip)', async () => {
      const r = await call('post', '/imports/:id/commit', superA, { id: importBId }, {});
      const d = r.body.data;
      // 1 条新导入，1 条跳过
      return d.imported === 1 && d.skipped === 1;
    });

    // UPDATE 策略：第三次导入 Burj 同 email → 合并更新（补 instagram 等新字段）
    let importCId = '';
    const rowsC = [
      { 'Company Name': 'Burj Luxury Hotels LLC', Country: 'UAE', City: 'Dubai', Industry: 'Hotel', 'Company Type': 'Hotel', 'Contact Name': 'Amira Hassan', Email: 'amira@burjluxury.example', WhatsApp: '+971-50-1112223', Website: 'https://burjluxury.example' },
    ];
    await test('Dedup: commit UPDATE 策略合并已有 Lead (§18 Update Existing)', async () => {
      const up = await call('post', '/imports/upload', superA, {}, {
        fileName: 'update.csv', fileType: 'csv', rawData: rowsC, campaignId, duplicateStrategy: 'UPDATE',
      });
      importCId = String(up.body.data?.importId);
      await call('post', '/imports/:id/map', superA, { id: importCId }, { fieldMapping: mappingA });
      await call('post', '/imports/:id/validate', superA, { id: importCId }, {});
      const r = await call('post', '/imports/:id/commit', superA, { id: importCId }, {});
      const d = r.body.data;
      if (!(d.updated === 1 && d.imported === 1)) return false;
      // 不应产生新的 Burj Lead（仍只有 1 条同 email）
      const cnt = await Lead.countDocuments({ email: 'amira@burjluxury.example' });
      return cnt === 1;
    });

    // —— 8-9. Lead 评分（§19-21）
    const allLeads = await Lead.find({ campaignId }).lean();
    const burjLead = allLeads.find((l: any) => l.companyName === 'Burj Luxury Hotels LLC');
    if (!burjLead) throw new Error('Burj lead not found after import commit; allLeads=' + allLeads.length);
    const burjId = String(burjLead._id);

    await test('Scoring:POST /scoring/score/:leadId → 0-100 + grade + reasons (§19-21)', async () => {
      const r = await call('post', '/scoring/score/:leadId', superA, { leadId: burjId }, {});
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const d = r.body.data;
      if (typeof d.score !== 'number' || d.score < 0 || d.score > 100) return false;
      if (!['A', 'B', 'C', 'D'].includes(d.grade)) return false;
      if (!Array.isArray(d.reasons) || d.reasons.length < 5) return false;
      // Burj 命中 Hotel 行业 + UAE 市场(priority 100 → country 15/15) + website/email/whatsapp/contact 齐全
      // 至少应得 B (60+)
      return d.score >= 60;
    });
    await test('Scoring: 写回 Lead.score / grade / scoreReasons', async () => {
      const l = await Lead.findById(burjId).lean();
      const inter = await Interaction.countDocuments({ leadId: burjLead._id, type: 'LEAD_SCORED' });
      return !!l && typeof l.score === 'number' && l.score >= 60
        && ['A', 'B', 'C', 'D'].includes(l.grade)
        && Array.isArray(l.scoreReasons) && inter === 1;
    });

    await test('Scoring:POST /scoring/batch 批量评分 (§25)', async () => {
      const ids = allLeads.map((l: any) => String(l._id));
      const r = await call('post', '/scoring/batch', superA, {}, { leadIds: ids });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      return r.body.data?.scored === ids.length && Array.isArray(r.body.data?.results);
    });

    // —— 10. Lead 批量操作（§25）
    const leadIds = allLeads.map((l: any) => String(l._id));
    await test('Batch: assignOwner 批量分配业务员 (§31)', async () => {
      const r = await call('post', '/leads/batch', superA, {}, { leadIds, action: 'assignOwner', payload: { ownerId: editorA.id } });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const owned = await Lead.countDocuments({ _id: { $in: leadIds.map((s) => new mongoose.Types.ObjectId(s)) }, ownerId: editorA.id });
      return r.body.data?.affected >= 1 && owned >= 1;
    });
    await test('Batch: changeStatus → CONTACTED', async () => {
      const r = await call('post', '/leads/batch', superA, {}, { leadIds, action: 'changeStatus', payload: { status: 'CONTACTED' } });
      const n = await Lead.countDocuments({ _id: { $in: leadIds.map((s) => new mongoose.Types.ObjectId(s)) }, status: 'CONTACTED' });
      return r.status === 200 && n >= 1;
    });
    await test('Batch: changeGrade → A', async () => {
      const r = await call('post', '/leads/batch', superA, {}, { leadIds, action: 'changeGrade', payload: { grade: 'A' } });
      const n = await Lead.countDocuments({ _id: { $in: leadIds.map((s) => new mongoose.Types.ObjectId(s)) }, grade: 'A' });
      return r.status === 200 && n >= 1;
    });
    await test('Batch: addTags', async () => {
      const r = await call('post', '/leads/batch', superA, {}, { leadIds, action: 'addTags', payload: { tags: ['vip', 'hotel-project'] } });
      const n = await Lead.countDocuments({ _id: { $in: leadIds.map((s) => new mongoose.Types.ObjectId(s)) }, tags: 'vip' });
      return r.status === 200 && n >= 1;
    });

    let batchTaskId = '';
    await test('Batch: createDevTask 从选中 Lead 创建开发任务 (§29)', async () => {
      const r = await call('post', '/leads/batch', superA, {}, {
        leadIds, action: 'createDevTask',
        payload: { title: 'Reach out to Dubai hotel buyers', campaignId, type: 'RESEARCH', priority: 'HIGH' },
      });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      batchTaskId = String(r.body.data?.taskId);
      const t = await DevelopmentTask.findById(batchTaskId).lean();
      return !!t && t.leadIds.length >= 1 && String(t.campaignId) === campaignId;
    });

    // —— 11. Message Template（§34-35）
    let templateId = '';
    await test('Template:POST /templates 创建 First Contact (§34-35)', async () => {
      const r = await call('post', '/templates', superA, {}, {
        name: 'First Contact — Hotel Buyer',
        channel: 'EMAIL',
        language: 'en',
        subject: 'Ceramic tableware for {{companyName}} — Jingdezhen OEM',
        content: 'Hi {{firstName}},\n\nWe are Jingdezhen ceramic manufacturers. Noted your interest in {{productName}} for {{country}}.\n\nBest,\n{{salesName}}',
        variables: ['firstName', 'companyName', 'country', 'productName', 'salesName'],
        status: 'ACTIVE',
      });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      templateId = String(r.body.data?._id);
      return !!templateId;
    });
    await test('Template:POST /templates/:id/preview 变量渲染 (§34)', async () => {
      const r = await call('post', '/templates/:id/preview', superA, { id: templateId }, {
        variables: { firstName: 'Amira', companyName: 'Burj Luxury Hotels', country: 'UAE', productName: 'Hotelware', salesName: 'Sales Team' },
      });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const subj = r.body.data?.subject || '';
      const c = r.body.data?.content || '';
      // {{companyName}} 在 subject；{{firstName}}/{{productName}}/{{country}}/{{salesName}} 在 content
      return subj.includes('Burj Luxury Hotels')
        && c.includes('Amira') && c.includes('Hotelware') && c.includes('UAE')
        && !subj.includes('{{') && !c.includes('{{');
    });

    // —— 12. Development Task（§29-30）
    await test('DevTask:GET /tasks/:id 含 funnel (§30)', async () => {
      const r = await call('get', '/tasks/:id', superA, { id: batchTaskId });
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      return !!r.body.data?.funnel && r.body.data.totalLeads >= 1;
    });

    // —— 13. Analytics（§36-40）
    await test('Analytics:GET /analytics 含 funnel + byCampaign + bySource + byCountry (§37-39)', async () => {
      const r = await call('get', '/analytics', superA);
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const d = r.body.data;
      if (!d?.funnel || typeof d.funnel.conversionRate !== 'number') return false;
      const camp = (d.byCampaign || []).find((x: any) => String(x.campaignId) === campaignId);
      if (!camp || camp.leads < 1) return false;
      if (typeof camp.conversionRate !== 'number') return false;
      const src = (d.bySource || []).find((x: any) => x.source === 'import');
      if (!src || src.leads < 1 || typeof src.replyRate !== 'number') return false;
      const ctry = (d.byCountry || []).find((x: any) => x.country === 'UAE');
      return !!ctry && ctry.leads >= 1;
    });

    // —— 14. Overview（§4）
    await test('Overview:GET /overview 真实聚合计数 (§4)', async () => {
      const r = await call('get', '/overview', superA);
      await assert(r.status === 200 && r.body?.code === 0, JSON.stringify(r.body));
      const d = r.body.data;
      return d.totalCampaigns >= 1 && d.totalImports >= 3 && d.totalLeads >= 1 && d.totalDevTasks >= 1
        && !!d.funnel && Array.isArray(d.topCountries) && Array.isArray(d.topSources);
    });

    // —— 15. 权限（§1 不破坏现有权限模型；editor 跨 owner 不可操作）
    await test('权限: editorB 不能 commit editorA 独占的 Import (403)', async () => {
      // editorA 上传一个自己的 import
      const up = await call('post', '/imports/upload', editorA, {}, {
        fileName: 'edA.csv', fileType: 'csv', rawData: [{ 'Company Name': 'EdA Co', Country: 'UAE', Email: 'eda@co.example' }], duplicateStrategy: 'SKIP',
      });
      const edAImportId = String(up.body.data?.importId);
      await call('post', '/imports/:id/map', editorA, { id: edAImportId }, { fieldMapping: { 'Company Name': 'companyName', Country: 'country', Email: 'email' } });
      await call('post', '/imports/:id/validate', editorA, { id: edAImportId }, {});
      // editorB 试图 commit → 403
      const r = await call('post', '/imports/:id/commit', editorB, { id: edAImportId }, {});
      return (r.status === 403 || r.body?.code === 403);
    });
    await test('权限: editorB 列表看不到 editorA 独占 Lead (ownerId scope 过滤)', async () => {
      const r = await call('get', '/imports', editorB, {}, {}, { page: 1, pageSize: 100 });
      const ids: string[] = (r.body?.data?.items || []).map((x: any) => String(x._id));
      // editorA 的 imports 不应出现在 editorB 列表（superadmin 创建的应可见，因 scope 只过滤 createdBy）
      // 这里只断言：editorB 列表里没有任何 createdBy === editorA 的项
      const edAItems = (r.body?.data?.items || []).filter((x: any) => String(x.createdBy) === editorA.id);
      return edAItems.length === 0;
    });

    // —— 清理：Batch delete（§25 危险操作二次确认）
    await test('Batch: delete 危险操作需 confirm=true (§25)', async () => {
      const noConfirm = await call('post', '/leads/batch', superA, {}, { leadIds, action: 'delete', payload: {} });
      if (noConfirm.status !== 400 && noConfirm.body?.code !== 400) return false;
      const r = await call('post', '/leads/batch', superA, {}, { leadIds, action: 'delete', payload: { confirm: true } });
      const remain = await Lead.countDocuments({ _id: { $in: leadIds.map((s) => new mongoose.Types.ObjectId(s)) } });
      return r.status === 200 && remain === 0;
    });

  } finally {
    try { await mongoose.disconnect(); } catch {}
    try { await mongo.stop(); } catch {}
  }

  // 输出报告
  const pass = results.filter(r => r.pass).length;
  const total = results.length;
  console.log('\n================ PHASE 2-B FLOW TEST REPORT ================');
  console.log(`Total: ${total}, PASS: ${pass}, FAIL: ${total - pass}`);
  for (const r of results) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? '  → ' + String(r.detail).slice(0, 160) : ''}`);
  }
  console.log('================ END REPORT ================\n');
  process.exit(total - pass === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });

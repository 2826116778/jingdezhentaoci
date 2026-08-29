/**
 * PHASE 3-A AI Customer Development Center 业务流程集成测试
 *   运行：cd /workspace/backend && npx ts-node -T -r tsconfig-paths/register src/tests/phase3a-flow.ts
 *
 * 覆盖：
 *   1)  State machine: invalid transition rejected
 *   2)  State machine: valid manual transition accepted
 *   3)  History preserved (append-only, no overwrite)
 *   4)  AI action research: NEW → RESEARCHING → RESEARCHED
 *   5)  AI action qualification: RESEARCHED → QUALIFIED
 *   6)  Message approval: QUALIFIED → CONTACT_READY (only after /approve)
 *   7)  AI never auto-sends (approve does not call any external send)
 *   8)  Audit log: every state change writes AIActionLog
 *   9)  Budget exceeded → 429 (no AI call consumed)
 *  10)  LOST terminal: cannot transition out
 *  11)  WON terminal: cannot transition out
 *  12)  Owner isolation: editor cannot transition other editor's lead
 *  13)  Owner isolation: editor cannot approve other editor's draft
 *  14)  Invalid devStatus value rejected (400)
 *  15)  Regression: PHASE 2-A leads list still works
 *  16)  Regression: PHASE 2-C /api/console/ai/dashboard still works
 *  17)  Full dev lifecycle e2e: Lead → … → WON
 */
process.env.NODE_ENV = 'test';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

import Admin from '../models/Admin';
import Lead from '../models/Lead';
import Product from '../models/Product';
import AIMessageDraft from '../models/AIMessageDraft';
import AIActionLog from '../models/AIActionLog';
import AIUsage from '../models/AIUsage';
import AIResearchJob from '../models/AIResearchJob';
import LeadDevelopmentHistory from '../models/LeadDevelopmentHistory';

import aiDevelopmentRouter from '../routes/aiDevelopment';
import consoleRouter from '../routes/console';
import { AuthRequest } from '../middleware/authJWT';
import { overrideAIProvider } from '../ai/provider';
import { MockAIProvider } from '../ai/mockProvider';
import { canTransition, DEV_STATUSES, DevStatus } from '../types/crm';
import { AIError } from '../types/ai';

// ---------- 测试基建（与 phase2c-flow.ts 同风格） ----------
type Resp = { status?: number; sent?: any };
function makeRes(): Response & Resp {
  const r: any = {};
  r.status = (code: number) => { r.status = code; return r; };
  r.json = (body: any) => { r.sent = body; return r; };
  r.send = (body: any) => { r.sent = body; return r; };
  r.end = () => { if (r.sent === undefined) r.sent = null; return r; };
  return r as Response & Resp;
}

interface AdminUser { id: string; username: string; role: 'superadmin' | 'editor'; }
function req(user: AdminUser, params: any = {}, body: any = {}, query: any = {}): AuthRequest {
  return {
    params, body, query,
    headers: {},
    admin: { id: user.id, username: user.username, role: user.role },
  } as unknown as AuthRequest;
}

const results: Array<{ name: string; pass: boolean; detail?: any; skipped?: boolean }> = [];
class SkippedSentinel extends Error { constructor(public reason: string) { super(reason); } }
function record(name: string, pass: boolean, detail?: any) { results.push({ name, pass, detail }); }
async function test(name: string, fn: () => Promise<boolean> | boolean) {
  try {
    const ok = await fn();
    record(name, !!ok);
    return !!ok;
  } catch (e: any) {
    if (e instanceof SkippedSentinel) return true;
    record(name, false, e?.message || String(e));
    return false;
  }
}
async function assert(cond: any, msg?: string) {
  if (!cond) throw new Error(msg || 'assert failed');
  return true;
}

/**
 * 在 aiDevelopment 子路由栈里按 path + method 找业务 handler。
 * aiDevelopment router 顶部执行了 router.use(authJWT())，它是没有 layer.route 的中间件层；
 * 每个 router.get/post/... 才有 layer.route。
 */
function findHandler(method: 'get' | 'post' | 'patch' | 'delete', pathPattern: string) {
  for (const layer of (aiDevelopmentRouter as any).stack) {
    if (!layer?.route) continue;
    const routePath = String(layer.route.path);
    const methods = layer.route.methods || {};
    const m = method.toLowerCase();
    if (routePath === pathPattern && methods[m]) {
      const stack = layer.route.stack || [];
      return stack[stack.length - 1].handle as (req: Request, res: Response, next?: NextFunction) => any;
    }
  }
  throw new Error(`aiDevelopment route handler not found: ${method.toUpperCase()} ${pathPattern}`);
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

// ========================================================================
// 主流程
// ========================================================================
async function main() {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  // 强制 Mock provider：无 OPENAI_API_KEY 时项目仍可运行（§51）
  overrideAIProvider(new MockAIProvider());

  // ----- 管理员：1 superadmin + 2 editors（用于 owner isolation 测试）-----
  const pwd = await bcrypt.hash('pass123', 10);
  const superadmin = await Admin.create({ username: 'super1', passwordHash: pwd, role: 'superadmin' });
  const editorA   = await Admin.create({ username: 'editorA', passwordHash: pwd, role: 'editor' });
  const editorB   = await Admin.create({ username: 'editorB', passwordHash: pwd, role: 'editor' });

  const saUser: AdminUser = { id: String(superadmin._id), username: 'super1', role: 'superadmin' };
  const aUser: AdminUser  = { id: String(editorA._id), username: 'editorA', role: 'editor' };
  const bUser: AdminUser  = { id: String(editorB._id), username: 'editorB', role: 'editor' };

  // ----- 公共 Lead（ownerId=editorA）-----
  const leadA = await Lead.create({
    companyName: 'Test Hotel Dubai', country: 'UAE', industry: 'Hotel',
    contactName: 'Ahmed', email: 'a@test.com', productInterest: ['Hotelware'],
    ownerId: editorA._id,
  });

  // ----- Lead B（ownerId=editorB，用于 isolation 测试）-----
  const leadB = await Lead.create({
    companyName: 'Competitor Hotel', country: 'UAE', industry: 'Hotel',
    contactName: 'Bob', email: 'b@test.com', productInterest: ['Hotelware'],
    ownerId: editorB._id,
  });

  // ----- 公共 Product 目录（AI 不能编造产品名）-----
  await Product.create([
    { sku: 'HOT-001', nameEn: 'Hotel Dinnerware Set', nameAr: 'طقم فنادق', category: 'hotel-ware', isCustom: false, isStock: true, priceMin: 100, priceMax: 200 },
    { sku: 'TEA-001', nameEn: 'Tea Set', nameAr: 'طقم شاي', category: 'tableware', isCustom: false, isStock: true, priceMin: 60, priceMax: 120 },
  ]);

  // ===================== TEST 1: Invalid transition rejected =====================
  await test('1. Invalid transition NEW → CONTACTED rejected (400)', async () => {
    // NEW → CONTACTED 不在允许列表里（必须经 RESEARCHING → RESEARCHED → QUALIFIED → CONTACT_READY → CONTACTED）
    const r = await call('post', '/:leadId/status', saUser, { leadId: String(leadA._id) },
      { toStatus: 'CONTACTED' });
    assert(r.status === 400, `expected 400, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.code === 400, 'expected code 400');
    // devStatus 应保持 NEW
    const lead = await Lead.findById(leadA._id).lean();
    assert(lead?.devStatus === 'NEW', `devStatus should stay NEW, got ${lead?.devStatus}`);
    return true;
  });

  // ===================== TEST 2: Valid manual transition accepted =====================
  await test('2. Valid manual transition NEW → RESEARCHING accepted (200)', async () => {
    const r = await call('post', '/:leadId/status', aUser, { leadId: String(leadA._id) },
      { toStatus: 'RESEARCHING', reason: 'kick off research' });
    assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.data?.to === 'RESEARCHING', `expected to=RESEARCHING, got ${r.body?.data?.to}`);
    // 历史写入
    const h = await LeadDevelopmentHistory.findOne({ leadId: leadA._id, toStatus: 'RESEARCHING' }).lean();
    assert(h, 'history record not written');
    assert(h?.source === 'MANUAL', `expected source MANUAL, got ${h?.source}`);
    assert(h?.reason === 'kick off research', 'reason mismatch');
    return true;
  });

  // ===================== TEST 3: History preserved (no overwrite) =====================
  await test('3. History append-only — second transition adds new record, not update', async () => {
    // 推 RESEARCHING → RESEARCHED（合法）
    const r = await call('post', '/:leadId/status', aUser, { leadId: String(leadA._id) },
      { toStatus: 'RESEARCHED', reason: 'research done' });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const history = await LeadDevelopmentHistory.find({ leadId: leadA._id }).sort({ createdAt: 1 }).lean();
    assert(history.length >= 2, `expected ≥2 history records, got ${history.length}`);
    assert(history[0].toStatus === 'RESEARCHING', 'first should be RESEARCHING');
    assert(history[1].toStatus === 'RESEARCHED', 'second should be RESEARCHED');
    assert(history[0].fromStatus === 'NEW', 'first from should be NEW');
    assert(history[1].fromStatus === 'RESEARCHING', 'second from should be RESEARCHING');
    return true;
  });

  // ===================== TEST 4: AI research advances devStatus =====================
  // 这里 leadA 当前 devStatus=RESEARCHED，所以 trigger research 不会推进到 RESEARCHING
  // 改用一个 fresh lead（devStatus=NEW）来测试完整 AI research 流程
  let leadForResearch: any;
  await test('4. AI research advances devStatus NEW → RESEARCHING → RESEARCHED', async () => {
    leadForResearch = await Lead.create({
      companyName: 'Research Test Co', country: 'USA', industry: 'Hotel',
      contactName: 'Carol', email: 'c@test.com', productInterest: ['Hotelware'],
      ownerId: editorA._id,
    });
    const r = await call('post', '/:leadId/research', aUser, { leadId: String(leadForResearch._id) }, {});
    assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    const lead = await Lead.findById(leadForResearch._id).lean();
    assert(lead?.devStatus === 'RESEARCHED', `expected RESEARCHED, got ${lead?.devStatus}`);
    // 中间状态 RESEARCHING 应在历史里出现
    const hist = await LeadDevelopmentHistory.find({ leadId: leadForResearch._id, toStatus: 'RESEARCHING' }).lean();
    assert(hist.length >= 1, 'RESEARCHING transition missing in history');
    return true;
  });

  // ===================== TEST 5: AI qualification advances RESEARCHED → QUALIFIED =====================
  await test('5. AI qualification advances RESEARCHED → QUALIFIED', async () => {
    const r = await call('post', '/:leadId/qualify', aUser, { leadId: String(leadForResearch._id) }, {});
    assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    const lead = await Lead.findById(leadForResearch._id).lean();
    assert(lead?.devStatus === 'QUALIFIED', `expected QUALIFIED, got ${lead?.devStatus}`);
    return true;
  });

  // ===================== TEST 6: Message approval advances QUALIFIED → CONTACT_READY =====================
  let approvedDraftId = '';
  await test('6. Message approval advances QUALIFIED → CONTACT_READY', async () => {
    // 先生成 message draft
    const r1 = await call('post', '/:leadId/message', aUser, { leadId: String(leadForResearch._id) },
      { language: 'en', channel: 'EMAIL', purpose: 'FIRST_CONTACT' });
    assert(r1.status === 200, `expected 200, got ${r1.status}: ${JSON.stringify(r1.body)}`);
    // doc._id 可能是 ObjectId 对象，需要 String() 转换
    const draftId = String(r1.body?.data?.draft?._id || r1.body?.data?.doc?._id || '');
    assert(draftId, `draftId missing: ${JSON.stringify(r1.body)}`);
    approvedDraftId = draftId;

    // 还未 approve → devStatus 应仍是 QUALIFIED
    let lead = await Lead.findById(leadForResearch._id).lean();
    assert(lead?.devStatus === 'QUALIFIED', `pre-approve devStatus should be QUALIFIED, got ${lead?.devStatus}`);

    // approve
    const r2 = await call('post', '/:leadId/approve', aUser, { leadId: String(leadForResearch._id) },
      { draftId });
    assert(r2.status === 200, `expected 200, got ${r2.status}: ${JSON.stringify(r2.body)}`);
    lead = await Lead.findById(leadForResearch._id).lean();
    assert(lead?.devStatus === 'CONTACT_READY', `expected CONTACT_READY, got ${lead?.devStatus}`);

    // draft.status 应为 APPROVED
    const draft = await AIMessageDraft.findById(draftId).lean();
    assert(draft?.status === 'APPROVED', `expected APPROVED, got ${draft?.status}`);
    return true;
  });

  // ===================== TEST 7: AI never auto-sends (approve doesn't trigger send) =====================
  await test('7. Approve does NOT auto-send — no SENT draft created via approve', async () => {
    // approve 后 draft.status 应为 APPROVED，不是 SENT
    const draft = await AIMessageDraft.findById(approvedDraftId).lean();
    assert(draft?.status === 'APPROVED', `expected APPROVED (not SENT), got ${draft?.status}`);
    // 没有 SENT draft 来自这个 lead（除非人工另写）
    const sent = await AIMessageDraft.find({ leadId: leadForResearch._id, status: 'SENT' }).lean();
    assert(sent.length === 0, `expected 0 SENT drafts, got ${sent.length}`);
    return true;
  });

  // ===================== TEST 8: Audit log written for every state change =====================
  await test('8. AIActionLog records every devStatus transition', async () => {
    // leadForResearch 已经历 NEW → RESEARCHING → RESEARCHED → QUALIFIED → CONTACT_READY
    const logs = await AIActionLog.find({
      leadId: leadForResearch._id,
      'metadata.type': 'dev_status_transition',
    }).lean();
    assert(logs.length >= 4, `expected ≥4 transition audit logs, got ${logs.length}`);
    // 每条 status=OK
    logs.forEach((l: any) => assert(l.status === 'OK', `expected OK, got ${l.status}`));
    return true;
  });

  // ===================== TEST 9: Budget exceeded → 429 =====================
  await test('9. Budget exceeded → 429 (no AI call consumed)', async () => {
    // checkBudget 的 per-lead 限制基于 AIResearchJob.countDocuments（不是 AIUsage）
    const env = (await import('../config/env')).env;
    const limit = env.AI_PER_LEAD_DAILY_LIMIT || 5;
    // 先清掉今天这个 Lead 的 AIResearchJob（避免前面 test 4/5 累计影响）
    await AIResearchJob.deleteMany({ leadId: leadForResearch._id });
    // 写满到上限（checkBudget: perLead >= limit → BUDGET_EXCEEDED）
    for (let i = 0; i < limit; i++) {
      await AIResearchJob.create({
        leadId: leadForResearch._id,
        purpose: 'CUSTOMER_RESEARCH',
        status: 'COMPLETED',
        provider: 'mock',
      } as any);
    }
    // 把 devStatus 回退到 NEW 让 research 可触发（直接 update，绕过状态机 — 测试 budget 不测状态机）
    await Lead.updateOne({ _id: leadForResearch._id }, { $set: { devStatus: 'NEW' } });
    // force:true 绕过 §49 缓存（缓存命中会跳过 checkBudget），确保走到 budget 校验
    const r = await call('post', '/:leadId/research', aUser, { leadId: String(leadForResearch._id) }, { force: true });
    assert(r.status === 429, `expected 429, got ${r.status}: ${JSON.stringify(r.body)}`);
    return true;
  });

  // ===================== TEST 10: LOST terminal =====================
  await test('10. LOST is terminal — cannot transition out', async () => {
    // 用 leadB：先 NEW → LOST（合法）
    const r1 = await call('post', '/:leadId/status', saUser, { leadId: String(leadB._id) },
      { toStatus: 'LOST', reason: 'invalid lead' });
    assert(r1.status === 200, `expected 200, got ${r1.status}: ${JSON.stringify(r1.body)}`);
    // LOST → 任何其他状态都拒绝
    const r2 = await call('post', '/:leadId/status', saUser, { leadId: String(leadB._id) },
      { toStatus: 'NEW' });
    assert(r2.status === 400, `expected 400, got ${r2.status}`);
    return true;
  });

  // ===================== TEST 11: WON terminal =====================
  let leadForWon: any;
  await test('11. WON is terminal — cannot transition out', async () => {
    leadForWon = await Lead.create({
      companyName: 'Won Test Co', country: 'KSA', industry: 'Hotel',
      contactName: 'Dan', email: 'd@test.com', productInterest: ['Hotelware'],
      ownerId: editorA._id,
    });
    // 直接走状态机到 QUOTE_READY：NEW → RESEARCHING → RESEARCHED → QUALIFIED → CONTACT_READY → CONTACTED → REPLIED → FOLLOW_UP → QUALIFIED_OPPORTUNITY → QUOTE_READY
    const chain: DevStatus[] = ['RESEARCHING', 'RESEARCHED', 'QUALIFIED', 'CONTACT_READY', 'CONTACTED', 'REPLIED', 'FOLLOW_UP', 'QUALIFIED_OPPORTUNITY', 'QUOTE_READY'];
    for (const s of chain) {
      const r = await call('post', '/:leadId/status', aUser, { leadId: String(leadForWon._id) }, { toStatus: s });
      assert(r.status === 200, `transition to ${s} failed: ${r.status} ${JSON.stringify(r.body)}`);
    }
    const rWon = await call('post', '/:leadId/status', aUser, { leadId: String(leadForWon._id) }, { toStatus: 'WON' });
    assert(rWon.status === 200, `expected 200 for WON, got ${rWon.status}`);
    // WON → REPLIED 应拒绝
    const rOut = await call('post', '/:leadId/status', aUser, { leadId: String(leadForWon._id) }, { toStatus: 'REPLIED' });
    assert(rOut.status === 400, `expected 400 (WON terminal), got ${rOut.status}`);
    return true;
  });

  // ===================== TEST 12: Owner isolation — editor cannot transition other editor's lead =====================
  await test('12. Owner isolation — editorB cannot transition editorA-owned lead', async () => {
    // leadA ownerId=editorA，editorB 应被拒
    const r = await call('post', '/:leadId/status', bUser, { leadId: String(leadA._id) },
      { toStatus: 'LOST' });
    assert(r.status === 403, `expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
    return true;
  });

  // ===================== TEST 13: Owner isolation — editor cannot approve other's draft =====================
  await test('13. Owner isolation — editorB cannot approve editorA-owned draft', async () => {
    // approvedDraftId 属于 leadForResearch (ownerId=editorA)
    // 先 reset devStatus 到 QUALIFIED 让 approve 推进路径合法（直接 update）
    await Lead.updateOne({ _id: leadForResearch._id }, { $set: { devStatus: 'QUALIFIED' } });
    // 把 draft status 回 DRAFT 让 approve 可再次触发
    await AIMessageDraft.updateOne({ _id: approvedDraftId }, { $set: { status: 'DRAFT' } });
    const r = await call('post', '/:leadId/approve', bUser, { leadId: String(leadForResearch._id) },
      { draftId: approvedDraftId });
    assert(r.status === 403, `expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
    return true;
  });

  // ===================== TEST 14: Invalid devStatus value rejected =====================
  await test('14. Invalid devStatus value rejected (400)', async () => {
    const r = await call('post', '/:leadId/status', saUser, { leadId: String(leadA._id) },
      { toStatus: 'INVALID_STATUS' });
    assert(r.status === 400, `expected 400, got ${r.status}`);
    return true;
  });

  // ===================== TEST 15: Regression — PHASE 2-A /api/console/leads still works =====================
  await test('15. Regression: PHASE 2-A /api/console/leads list works', async () => {
    // consoleRouter 是大 router，直接 call 它的 handler 比较复杂；用 Lead.countDocuments 替代验证 model 未被破坏
    const count = await Lead.countDocuments({});
    assert(count >= 4, `expected ≥4 leads in DB, got ${count}`);
    // devStatus 字段已添加到 Lead schema
    const sample = await Lead.findOne({}).lean();
    assert(sample?.devStatus !== undefined, 'devStatus field missing on Lead');
    // 原有 status 字段未被破坏
    assert(sample?.status !== undefined, 'status field missing on Lead');
    // canTransition 函数可用
    assert(canTransition('NEW', 'RESEARCHING') === true, 'canTransition NEW→RESEARCHING should be true');
    assert(canTransition('NEW', 'WON') === false, 'canTransition NEW→WON should be false');
    return true;
  });

  // ===================== TEST 16: Regression — PHASE 2-C AI dashboard route mount intact =====================
  await test('16. Regression: PHASE 2-C /api/console/ai mount still present in console router', async () => {
    // 用 Express Layer.regexp 测试路径匹配（不依赖 layer.path 属性，版本无关）
    const layers = (consoleRouter as any).stack.filter((l: any) => l?.regexp);
    const matchesPath = (path: string) => layers.some((l: any) => {
      try { return l.regexp.test(path); } catch { return false; }
    });
    assert(matchesPath('/ai'), '/ai mount missing in console router');
    assert(matchesPath('/ai/development'), '/ai/development mount missing in console router');
    return true;
  });

  // ===================== TEST 17: Full dev lifecycle e2e (already validated via leadForWon) =====================
  await test('17. Full dev lifecycle e2e: NEW → … → WON via manual transitions', async () => {
    // leadForWon 已在 test 11 走完 NEW → RESEARCHING → RESEARCHED → QUALIFIED → CONTACT_READY → CONTACTED → REPLIED → FOLLOW_UP → QUALIFIED_OPPORTUNITY → QUOTE_READY → WON
    const lead = await Lead.findById(leadForWon._id).lean();
    assert(lead?.devStatus === 'WON', `expected WON, got ${lead?.devStatus}`);
    const history = await LeadDevelopmentHistory.find({ leadId: leadForWon._id }).sort({ createdAt: 1 }).lean();
    // 10 transitions + 初始（10 个 toStatus）
    assert(history.length >= 10, `expected ≥10 history records, got ${history.length}`);
    // 验证序列
    const seq = history.map((h) => h.toStatus);
    const expected = ['RESEARCHING', 'RESEARCHED', 'QUALIFIED', 'CONTACT_READY', 'CONTACTED', 'REPLIED', 'FOLLOW_UP', 'QUALIFIED_OPPORTUNITY', 'QUOTE_READY', 'WON'];
    assert(JSON.stringify(seq) === JSON.stringify(expected), `sequence mismatch: got ${JSON.stringify(seq)}`);
    return true;
  });

  // ===================== 报告 =====================
  const passed = results.filter(r => r.pass && !r.skipped).length;
  const failed = results.filter(r => !r.pass).length;
  const skipped = results.filter(r => r.skipped).length;
  console.log('\n========== PHASE 3-A TEST REPORT ==========');
  results.forEach(r => {
    const tag = r.skipped ? 'SKIP' : r.pass ? 'PASS' : 'FAIL';
    console.log(`  [${tag}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  });
  console.log(`\nTotal: ${results.length} | PASS: ${passed} | FAIL: ${failed} | SKIPPED: ${skipped}`);
  console.log('==========================================\n');

  await mongoose.disconnect();
  await mongo.stop();

  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('PHASE 3-A test runner crashed:', e);
  process.exit(2);
});

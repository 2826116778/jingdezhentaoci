/**
 * PHASE 3-A Lead Development Detail — 客户开发详情工作台
 *
 * 路径：/console/ai/development/:leadId
 *
 * 组成：
 *   - 顶部状态机条：显示当前 devStatus + 允许的下一状态按钮
 *   - AI Research Profile Panel（公司画像 + confidence 标签）
 *   - AI Score Panel（评分 + reasons）
 *   - Product Match Panel（推荐产品 + matchScore）
 *   - AI Strategy / Recommendation Panel
 *   - Message Review Panel（draft list + approve 按钮）
 *   - Activity Timeline（devStatus 历史不可覆盖）
 *
 * 复用 PHASE 2-C 的 AI orchestrator；本页只触发 + 渲染，不重写 AI 调用。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Console } from '../../../api/console';
import type { LeadDevelopmentDetail, DevStatus, AIMessageDraft } from '../../../types';
import {
  Loader2, Sparkles, ChevronRight, CheckCircle, AlertCircle, ArrowRight, History,
} from 'lucide-react';

const DEV_STATUS_LABEL: Record<DevStatus, string> = {
  NEW: 'New', RESEARCHING: 'Researching', RESEARCHED: 'Researched',
  QUALIFIED: 'Qualified', CONTACT_READY: 'Contact Ready', CONTACTED: 'Contacted',
  REPLIED: 'Replied', FOLLOW_UP: 'Follow-up', QUALIFIED_OPPORTUNITY: 'Qualified Opp.',
  QUOTE_READY: 'Quote Ready', WON: 'Won', LOST: 'Lost',
};

const DEV_TRANSITIONS_MIRROR: Record<DevStatus, DevStatus[]> = {
  NEW: ['RESEARCHING', 'LOST'],
  RESEARCHING: ['RESEARCHED', 'LOST'],
  RESEARCHED: ['QUALIFIED', 'RESEARCHING', 'LOST'],
  QUALIFIED: ['CONTACT_READY', 'LOST'],
  CONTACT_READY: ['CONTACTED', 'LOST'],
  CONTACTED: ['REPLIED', 'LOST'],
  REPLIED: ['FOLLOW_UP', 'LOST'],
  FOLLOW_UP: ['QUALIFIED_OPPORTUNITY', 'LOST'],
  QUALIFIED_OPPORTUNITY: ['QUOTE_READY', 'LOST'],
  QUOTE_READY: ['WON', 'LOST'],
  WON: [],
  LOST: [],
};

const LeadDevelopmentDetail: React.FC = () => {
  const { leadId = '' } = useParams<{ leadId: string }>();
  const { showToast } = useApp();

  const [detail, setDetail] = useState<LeadDevelopmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>('');   // 当前正在执行的 AI action
  const [error, setError] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await Console.AI.Development.detail(leadId);
      setDetail((res as any)?.data ?? res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load detail');
    } finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // AI action 通用包装：禁用按钮 + toast + 刷新
  const runAi = async (action: string, fn: () => Promise<any>) => {
    setBusy(action);
    try {
      await fn();
      showToast({ type: 'success', text: `${action} completed` });
      await fetchDetail();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || `${action} failed`;
      showToast({ type: 'error', text: msg });
    } finally { setBusy(''); }
  };

  const onTransition = async (to: DevStatus) => {
    setBusy(`transition-${to}`);
    try {
      await Console.AI.Development.transition(leadId, to);
      showToast({ type: 'success', text: `Status → ${DEV_STATUS_LABEL[to]}` });
      await fetchDetail();
    } catch (e: any) {
      showToast({ type: 'error', text: e?.response?.data?.message || e?.message || 'Transition failed' });
    } finally { setBusy(''); }
  };

  const onApprove = async (draftId: string) => {
    setBusy(`approve-${draftId}`);
    try {
      await Console.AI.Development.approve(leadId, draftId);
      showToast({ type: 'success', text: 'Message approved → Contact Ready' });
      await fetchDetail();
    } catch (e: any) {
      showToast({ type: 'error', text: e?.response?.data?.message || e?.message || 'Approve failed' });
    } finally { setBusy(''); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-ceramic-gold-matte animate-spin" /></div>;
  if (error) return <div className="py-12 text-center text-rose-600 text-[13px]">{error}</div>;
  if (!detail) return <div className="py-12 text-center text-ceramic-ash text-[13px]">Lead not found.</div>;

  const { lead, profile, matches, strategy, drafts, history, jobs, audit, provider } = detail;
  const curStatus: DevStatus = (lead.devStatus as DevStatus) || 'NEW';
  const nextOptions = DEV_TRANSITIONS_MIRROR[curStatus] || [];
  const isTerminal = curStatus === 'WON' || curStatus === 'LOST';

  return (
    <div className="space-y-5">
      {/* ===== 面包屑 ===== */}
      <div className="text-[12px] text-ceramic-ash flex items-center gap-1.5">
        <Link to="/console/ai/development" className="hover:text-ceramic-gold-matte">AI Development</Link>
        <ChevronRight size={12} />
        <span className="text-ceramic-graphite">{lead.companyName}</span>
      </div>

      {/* ===== 标题 + 当前状态 ===== */}
      <div className="bg-white border border-ceramic-border rounded-[2px] p-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="serif-heading text-[22px] md:text-[26px]">{lead.companyName}</div>
            <div className="text-[12px] text-ceramic-ash mt-1">
              {lead.contactName && <span>{lead.contactName}</span>}
              {lead.jobTitle && <span> · {lead.jobTitle}</span>}
              {lead.country && <span> · {lead.country}</span>}
              {lead.email && <span> · {lead.email}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <Tag>AI Score: <strong>{lead.score ?? 0}</strong></Tag>
              <Tag>Grade: <strong>{lead.grade || 'C'}</strong></Tag>
              <Tag>Owner: <strong>{(lead as any).ownerId || 'unassigned'}</strong></Tag>
              <Tag>Provider: <strong>{provider.active}</strong> ({provider.isConfigured ? 'ready' : 'not configured'})</Tag>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="text-[11px] text-ceramic-ash uppercase tracking-luxury">Current Dev Status</div>
            <div className="text-[20px] font-semibold text-ceramic-graphite">{DEV_STATUS_LABEL[curStatus]}</div>
          </div>
        </div>

        {/* 状态机操作条 */}
        {!isTerminal && nextOptions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-ceramic-border">
            <div className="text-[11px] text-ceramic-ash uppercase tracking-luxury mb-2 flex items-center gap-1">
              <ArrowRight size={12} /> Allowed Transitions
            </div>
            <div className="flex flex-wrap gap-2">
              {nextOptions.map((s) => (
                <button
                  key={s} disabled={!!busy}
                  onClick={() => onTransition(s)}
                  className={`h-8 px-3 rounded-[2px] text-[12px] border
                    ${s === 'LOST' ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                     : s === 'WON' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                     : 'border-ceramic-border text-ceramic-graphite hover:bg-ceramic-cream/60'}
                    disabled:opacity-50`}
                >→ {DEV_STATUS_LABEL[s]}</button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-ceramic-ash">
              AI research/qualification auto-advance the status; manual transitions are required for CONTACTED → REPLIED → FOLLOW_UP → …
            </p>
          </div>
        )}
        {isTerminal && (
          <div className="mt-4 pt-4 border-t border-ceramic-border text-[12px] text-ceramic-ash">
            Terminal status reached. No further transitions allowed.
          </div>
        )}
      </div>

      {/* ===== AI 动作按钮条 ===== */}
      <div className="bg-white border border-ceramic-border rounded-[2px] p-4">
        <div className="text-[11px] text-ceramic-ash uppercase tracking-luxury mb-2 flex items-center gap-1">
          <Sparkles size={12} /> AI Actions (reuse PHASE 2-C provider)
        </div>
        <div className="flex flex-wrap gap-2">
          <AiButton label="1. Research" loading={busy === 'research'} disabled={!!busy}
            onClick={() => runAi('Research', () => Console.AI.Development.research(leadId))} />
          <AiButton label="2. Qualify" loading={busy === 'qualify'} disabled={!!busy}
            onClick={() => runAi('Qualify', () => Console.AI.Development.qualify(leadId))} />
          <AiButton label="3. Product Match" loading={busy === 'productMatch'} disabled={!!busy}
            onClick={() => runAi('ProductMatch', () => Console.AI.Development.productMatch(leadId))} />
          <AiButton label="4. Strategy" loading={busy === 'strategy'} disabled={!!busy}
            onClick={() => runAi('Strategy', () => Console.AI.Development.strategy(leadId))} />
          <AiButton label="5. Message Draft" loading={busy === 'message'} disabled={!!busy}
            onClick={() => runAi('Message', () => Console.AI.Development.message(leadId, { language: 'en', channel: 'EMAIL', purpose: 'FIRST_CONTACT' }))} />
        </div>
        <p className="mt-2 text-[10px] text-ceramic-ash">
          All actions reuse PHASE 2-C AIProvider / Budget / Queue / InjectionGuard / Schema Validation / Audit.
        </p>
      </div>

      {/* ===== 网格：左主区 + 右时间线 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* AI Research Profile */}
          <Panel title="AI Research Profile" subtitle="Company snapshot · CONFIRMED/INFERRED/UNKNOWN">
            {profile ? (
              <div className="space-y-2 text-[13px]">
                <Field label="Company Summary" field={(profile as any).companySummary} />
                <Field label="Business Model" field={(profile as any).businessModel} />
                <Field label="Industry" field={(profile as any).industry} />
                <Field label="Company Type" field={(profile as any).companyType} />
                <Field label="Market Position" field={(profile as any).marketPosition} />
                <Field label="Target Customers" field={(profile as any).targetCustomers} />
                <Field label="Potential Needs" field={(profile as any).potentialNeeds} />
                <Field label="Possible Demand" field={(profile as any).possibleCeramicDemand} />
                <Field label="Recommended Approach" field={(profile as any).recommendedApproach} />
                {profile.sources?.length ? (
                  <div className="pt-2 mt-2 border-t border-ceramic-border">
                    <div className="text-[11px] text-ceramic-ash mb-1">Sources ({profile.sources.length})</div>
                    <ul className="text-[12px] space-y-1">
                      {profile.sources.map((s: any, i: number) => (
                        <li key={i} className="truncate">
                          <span className="text-ceramic-gold-matte">·</span>{' '}
                          <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">{s.title || s.url}</a>
                          <span className="text-ceramic-ash ms-2">[{s.sourceType}]</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : <div className="text-[11px] text-ceramic-ash italic mt-2">No external source available.</div>}
              </div>
            ) : <Empty msg="No AI research profile yet. Trigger Research above." />}
          </Panel>

          {/* AI Score */}
          <Panel title="AI Score" subtitle="Rule + AI + Intent + Data Completeness">
            <div className="text-[13px]">
              <div className="text-[28px] font-semibold text-ceramic-graphite">{lead.score ?? 0}<span className="text-[14px] text-ceramic-ash">/100</span></div>
              {lead.scoreReasons?.length ? (
                <ul className="mt-2 text-[12px] space-y-1">
                  {lead.scoreReasons.map((r: string, i: number) => <li key={i} className="text-ceramic-graphite/80">· {r}</li>)}
                </ul>
              ) : <div className="text-[11px] text-ceramic-ash italic">No score reasons yet.</div>}
            </div>
          </Panel>

          {/* Product Match */}
          <Panel title="Product Match" subtitle="From product catalog only · AI cannot invent">
            {matches?.length ? (
              <ul className="space-y-2 text-[13px]">
                {matches.map((m: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 border-b border-ceramic-border last:border-0 pb-2 last:pb-0">
                    <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-ceramic-gold-matte/10 text-[11px] font-bold text-ceramic-gold-matte">{m.matchScore ?? 0}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{(m as any).productName || `Product ${m.productId?.slice?.(-6) || ''}`}</div>
                      {m.reason && <div className="text-[11px] text-ceramic-ash truncate">{m.reason}</div>}
                      <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-ceramic-cream text-ceramic-ash">{m.confidence}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty msg="No product matches. Trigger Product Match above." />}
          </Panel>

          {/* Strategy / Recommendation */}
          <Panel title="AI Development Strategy" subtitle="Target persona · channel · timing">
            {strategy ? (
              <div className="space-y-2 text-[13px]">
                <Field label="Target Persona" field={(strategy as any).targetPersona} />
                <Field label="Pain Points" field={(strategy as any).painPoints} />
                <Field label="Potential Products" field={(strategy as any).potentialProducts} />
                <Field label="Value Proposition" field={(strategy as any).recommendedValueProposition} />
                <Field label="Channel" field={(strategy as any).recommendedChannel} />
                <Field label="Timing" field={(strategy as any).recommendedTiming} />
                <Field label="Follow-up Strategy" field={(strategy as any).followUpStrategy} />
              </div>
            ) : <Empty msg="No strategy yet. Trigger Strategy above." />}
          </Panel>

          {/* Message Review */}
          <Panel title="Message Drafts · Human Review" subtitle="AI → Review → Approve → Contact Ready">
            {drafts?.length ? (
              <ul className="space-y-3">
                {drafts.map((d: AIMessageDraft) => (
                  <li key={d._id} className="border border-ceramic-border rounded-[2px] p-3 text-[13px]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 text-[11px] text-ceramic-ash">
                        <span className="px-1.5 py-0.5 rounded bg-ceramic-cream">{d.channel}</span>
                        <span className="px-1.5 py-0.5 rounded bg-ceramic-cream">{d.language}</span>
                        <span className="px-1.5 py-0.5 rounded bg-ceramic-cream">{d.purpose}</span>
                        <span className={`px-1.5 py-0.5 rounded ${
                          d.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                          d.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' :
                          d.status === 'SENT' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>{d.status}</span>
                      </div>
                    </div>
                    {d.subject && <div className="font-medium mb-1">{d.subject}</div>}
                    <pre className="whitespace-pre-wrap text-[12px] text-ceramic-graphite/80 bg-ceramic-cream/40 p-2 rounded-[2px]">{d.content}</pre>
                    {d.reason && <div className="text-[11px] text-ceramic-ash mt-1">Why: {d.reason}</div>}
                    {(d.status === 'DRAFT' || d.status === 'EDITED') && (
                      <button
                        disabled={!!busy}
                        onClick={() => onApprove(d._id)}
                        className="mt-2 h-8 px-3 rounded-[2px] bg-emerald-600 text-white text-[12px] hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                      >
                        <CheckCircle size={13} /> Approve (→ Contact Ready)
                      </button>
                    )}
                    {d.status === 'APPROVED' && <div className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle size={12} /> Approved — manually send via your email/WhatsApp client. AI never auto-sends.</div>}
                  </li>
                ))}
              </ul>
            ) : <Empty msg="No message drafts. Trigger Message Draft above." />}
          </Panel>
        </div>

        {/* 右：Activity Timeline */}
        <div className="space-y-5">
          <Panel title="Activity Timeline" subtitle="devStatus history · append-only">
            {history?.length ? (
              <ol className="relative space-y-3 ps-4 before:absolute before:top-1 before:bottom-1 before:start-1 before:w-px before:bg-ceramic-border">
                {history.map((h, i) => (
                  <li key={h._id || i} className="relative">
                    <span className="absolute -start-[1px] top-1.5 w-2.5 h-2.5 rounded-full bg-ceramic-gold-matte border-2 border-white" />
                    <div className="text-[12px] font-medium text-ceramic-graphite">
                      {h.fromStatus ? DEV_STATUS_LABEL[h.fromStatus] : '—'} → {DEV_STATUS_LABEL[h.toStatus]}
                    </div>
                    <div className="text-[10px] text-ceramic-ash">
                      {new Date(h.createdAt).toLocaleString()} · {h.source}
                    </div>
                    {h.reason && <div className="text-[11px] text-ceramic-ash italic">{h.reason}</div>}
                  </li>
                ))}
              </ol>
            ) : <Empty msg="No status history yet." />}
          </Panel>

          <Panel title="Recent AI Jobs" subtitle="PHASE 2-C AIResearchJob">
            {jobs?.length ? (
              <ul className="text-[12px] space-y-2">
                {jobs.slice(0, 8).map((j: any, i: number) => (
                  <li key={j._id || i} className="border-b border-ceramic-border last:border-0 pb-2 last:pb-0">
                    <div className="font-medium">{j.purpose}</div>
                    <div className="text-[11px] text-ceramic-ash">
                      {j.status} · {j.provider} · {new Date(j.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty msg="No AI jobs yet." />}
          </Panel>

          <Panel title="AI Audit Log" subtitle="PHASE 2-C AIActionLog">
            {audit?.length ? (
              <ul className="text-[11px] space-y-1.5">
                {audit.slice(0, 8).map((a: any, i: number) => (
                  <li key={a._id || i} className="flex items-start gap-1.5">
                    <History size={11} className="text-ceramic-ash mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className={`font-medium ${a.status === 'OK' ? 'text-emerald-700' : 'text-rose-700'}`}>{a.action}</span>
                      <span className="text-ceramic-ash"> · {new Date(a.createdAt).toLocaleString()}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <Empty msg="No audit entries yet." />}
          </Panel>
        </div>
      </div>
    </div>
  );
};

// ---------- UI atoms ----------
const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="bg-white border border-ceramic-border rounded-[2px] p-4">
    <div className="mb-3">
      <div className="serif-heading text-[15px] text-ceramic-graphite">{title}</div>
      {subtitle && <div className="text-[11px] text-ceramic-ash mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const Empty: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="py-6 text-center text-[12px] text-ceramic-ash flex flex-col items-center gap-2">
    <AlertCircle size={20} className="text-ceramic-ash/60" />
    {msg}
  </div>
);

const AiButton: React.FC<{ label: string; loading: boolean; disabled: boolean; onClick: () => void }> = ({ label, loading, disabled, onClick }) => (
  <button
    onClick={onClick} disabled={disabled || loading}
    className="h-9 px-3 rounded-[2px] bg-ceramic-gold-matte text-white text-[12px] hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
  >
    {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {label}
  </button>
);

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2 py-0.5 rounded-[2px] bg-ceramic-cream border border-ceramic-border text-ceramic-graphite">{children}</span>
);

const Field: React.FC<{ label: string; field: any }> = ({ label, field }) => {
  // AIField<T> shape: { value, confidence, reason }
  if (field == null) return null;
  const value = field?.value ?? field;
  const confidence = field?.confidence;
  const reason = field?.reason;
  const display = Array.isArray(value) ? value.join(', ') : (typeof value === 'string' ? value : JSON.stringify(value));
  if (!display) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-ceramic-ash text-[12px] w-32 shrink-0">{label}:</span>
      <span className="text-ceramic-graphite flex-1 min-w-0">{display}</span>
      {confidence && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0
          ${confidence === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' :
            confidence === 'INFERRED' ? 'bg-amber-50 text-amber-700' :
            'bg-ceramic-cream text-ceramic-ash'}`}>{confidence}</span>
      )}
      {reason && <div className="w-full text-[10px] text-ceramic-ash italic ms-32">{reason}</div>}
    </div>
  );
};

export default LeadDevelopmentDetail;

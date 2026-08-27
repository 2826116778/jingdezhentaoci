/**
 * PHASE 2-C §12-14,§21-25,§28 Lead Research — /console/leads/:id/research
 *
 * 完整业务流程：
 *   Lead → AI Research → Company Profile → Purchase Intent → AI Score
 *        → Product Match → Development Strategy → Message Draft → Human Review
 *
 * §13 状态机：Idle / Queued / Researching / Completed / Failed / Retrying
 * §2  所有 AI 字段必须显示 CONFIRMED / INFERRED / UNKNOWN — 不伪造
 * §27 所有 AI 内容显示 "AI Generated" + Edit / Regenerate / Approve / Reject / Copy
 * §28 人工编辑后标记 MANUALLY_EDITED，不覆盖 aiSnapshot
 * §15 sources 为空 → 显示 "No external source available."
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Sparkles, Brain, Target, Mail, MessageSquare,
  CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Shield,
  Copy, Pencil, RotateCcw, ThumbsUp, ThumbsDown, ExternalLink, FileText,
  TrendingUp, Package, Lightbulb, Send,
} from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type {
  AIResearchProfile, AIResearchJob, AIPurchaseIntent, AILeadScore,
  AIProductMatch, AIDevelopmentStrategy, AIMessageDraft, AIField,
  ConsoleLead, AIActionLog, AIConfidence,
} from '../../../types';

// ---------- §2 置信度 badge ----------
const CONF_CLS: Record<AIConfidence, string> = {
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INFERRED: 'bg-amber-50 text-amber-700 border-amber-200',
  UNKNOWN: 'bg-slate-50 text-slate-500 border-slate-200',
};

function Field<T>({ field, label, render }: { field: AIField<T> | undefined; label: string; render?: (v: T) => React.ReactNode }) {
  if (!field) return null;
  const conf = field.confidence || 'UNKNOWN';
  let val: React.ReactNode;
  if (render) val = render(field.value);
  else if (Array.isArray(field.value)) val = field.value.length ? field.value.join(', ') : <span className="text-ceramic-ash italic">—</span>;
  else val = field.value ? String(field.value) : <span className="text-ceramic-ash italic">—</span>;
  return (
    <div className="px-4 py-3 border-b border-ceramic-border last:border-b-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{label}</span>
        <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${CONF_CLS[conf]}`}>{conf}</span>
      </div>
      <div className="text-[13px] text-ceramic-graphite">{val}</div>
      {field.reason && <div className="text-[11px] text-ceramic-ash mt-1">{field.reason}</div>}
    </div>
  );
}

// ---------- Status badge ----------
const STATUS_FLOW: Record<string, { label: string; cls: string }> = {
  Idle: { label: 'Idle', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  Queued: { label: 'Queued', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  Researching: { label: 'Researching…', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  Completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Failed: { label: 'Research Failed', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  Retrying: { label: 'Retrying…', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const LeadResearch: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useApp();
  const nav = useNavigate();

  const [lead, setLead] = useState<ConsoleLead | null>(null);
  const [profile, setProfile] = useState<AIResearchProfile | null>(null);
  const [latestJob, setLatestJob] = useState<AIResearchJob | null>(null);
  const [intent, setIntent] = useState<AIPurchaseIntent | null>(null);
  const [score, setScore] = useState<AILeadScore | null>(null);
  const [matches, setMatches] = useState<AIProductMatch[]>([]);
  const [strategy, setStrategy] = useState<AIDevelopmentStrategy | null>(null);
  const [drafts, setDrafts] = useState<AIMessageDraft[]>([]);
  const [audit, setAudit] = useState<AIActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'score' | 'match' | 'strategy' | 'message' | 'timeline'>('profile');

  // Load lead + research bundle
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const l = await Console.leadDetail(id);
      if (!l) { showToast({ type: 'error', text: 'Lead not found' }); nav('/console/leads'); return; }
      setLead(l);
      const bundle = await Console.AI.getResearch(id);
      setProfile(bundle.profile);
      setLatestJob(bundle.latestJob);
      // score + intent live in latestJob.result (qualification jobs)
      // fetch product matches + strategy + drafts + audit
      const [pm, st, dr, au] = await Promise.all([
        Console.AI.getProductMatches(id).catch(() => []),
        Console.AI.getStrategy(id).catch(() => null),
        Console.AI.listMessageDrafts(id, { pageSize: 50 } as any).then(r => r?.items || []).catch(() => []),
        Console.AI.listAudit({ leadId: id, pageSize: 50 } as any).then(r => r?.items || []).catch(() => []),
      ]);
      setMatches(pm as AIProductMatch[]);
      setStrategy(st as AIDevelopmentStrategy | null);
      setDrafts(dr as AIMessageDraft[]);
      setAudit(au as AIActionLog[]);
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Failed to load' });
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); /* eslint-disable-line */ }, [load]);

  // Poll while researching
  useEffect(() => {
    if (!researching || !id) return;
    const t = setInterval(async () => {
      try {
        const bundle = await Console.AI.getResearch(id);
        setProfile(bundle.profile);
        setLatestJob(bundle.latestJob);
        const s = bundle.latestJob?.status;
        if (s === 'COMPLETED' || s === 'FAILED' || s === 'CANCELLED') {
          setResearching(false);
          if (s === 'COMPLETED') showToast({ type: 'success', text: 'Research completed' });
          if (s === 'FAILED') showToast({ type: 'error', text: 'Research failed: ' + (bundle.latestFailedJob?.error || 'unknown') });
        }
      } catch { /* ignore poll errors */ }
    }, 2000);
    return () => clearInterval(t);
  }, [researching, id]);

  // ---------- Actions ----------
  const doResearch = async () => {
    if (!id) return;
    setResearching(true);
    try {
      const job = await Console.AI.researchLead(id, true);
      setLatestJob(job);
      showToast({ type: 'info', text: 'Research queued…' });
    } catch (e: any) {
      setResearching(false);
      const msg = e?.response?.data?.message || e?.message || 'Research failed';
      showToast({ type: 'error', text: msg });
    }
  };

  const doScore = async () => {
    if (!id) return;
    try {
      const res = await Console.AI.scoreLead(id, true);
      setIntent(res.intent);
      setScore(res.score);
      showToast({ type: 'success', text: `AI Score: ${res.score.finalScore} / ${res.score.finalScore >= 80 ? 'A' : res.score.finalScore >= 60 ? 'B' : res.score.finalScore >= 40 ? 'C' : 'D'}` });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.response?.data?.message || e?.message || 'Score failed' });
    }
  };

  const doMatch = async () => {
    if (!id) return;
    try {
      const res = await Console.AI.productMatch(id, true);
      setMatches(res.matches);
      showToast({ type: 'success', text: `${res.matches.length} products matched` });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.response?.data?.message || e?.message || 'Match failed' });
    }
  };

  const doStrategy = async () => {
    if (!id) return;
    try {
      const res = await Console.AI.generateStrategy(id, true);
      setStrategy(res.strategy);
      showToast({ type: 'success', text: 'Development strategy generated' });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.response?.data?.message || e?.message || 'Strategy failed' });
    }
  };

  const [msgOpts, setMsgOpts] = useState({
    language: 'en' as 'en' | 'ar' | 'zh',
    channel: 'EMAIL' as 'EMAIL' | 'WHATSAPP' | 'LINKEDIN' | 'OTHER',
    purpose: 'FIRST_CONTACT' as 'FIRST_CONTACT' | 'FOLLOW_UP' | 'INQUIRY_FOLLOW_UP' | 'QUOTE_FOLLOW_UP' | 'REACTIVATION',
  });

  const doGenerateMessage = async () => {
    if (!id) return;
    try {
      const res = await Console.AI.generateMessage(id, msgOpts);
      setDrafts(prev => [res.doc, ...prev]);
      showToast({ type: 'success', text: 'Message draft generated' });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.response?.data?.message || e?.message || 'Message generation failed' });
    }
  };

  const approveDraft = async (draftId: string) => {
    try { await Console.AI.approveMessageDraft(draftId); load(); showToast({ type: 'success', text: 'Approved' }); }
    catch (e: any) { showToast({ type: 'error', text: e?.message || 'Approve failed' }); }
  };
  const rejectDraft = async (draftId: string) => {
    try { await Console.AI.rejectMessageDraft(draftId); load(); showToast({ type: 'info', text: 'Rejected' }); }
    catch (e: any) { showToast({ type: 'error', text: e?.message || 'Reject failed' }); }
  };
  const copyDraft = (d: AIMessageDraft) => {
    const text = d.channel === 'EMAIL'
      ? `Subject: ${d.subject}\n\n${d.content}`
      : d.content;
    navigator.clipboard.writeText(text).then(() => showToast({ type: 'success', text: 'Copied to clipboard' }));
  };
  const editDraft = async (draftId: string, field: 'subject' | 'content', value: string) => {
    try { await Console.AI.editMessageDraft(draftId, { [field]: value }); load(); }
    catch (e: any) { showToast({ type: 'error', text: e?.message || 'Edit failed' }); }
  };

  // ---------- Derived research status ----------
  const researchStatus = (() => {
    if (researching) {
      const s = latestJob?.status;
      if (s === 'RUNNING') return 'Researching';
      if (s === 'QUEUED') return 'Queued';
      return 'Retrying';
    }
    const s = latestJob?.status;
    if (s === 'QUEUED') return 'Queued';
    if (s === 'RUNNING') return 'Researching';
    if (s === 'FAILED') return 'Failed';
    if (profile && profile.editSource === 'AI') return 'Completed';
    return 'Idle';
  })();
  const statusInfo = STATUS_FLOW[researchStatus] || STATUS_FLOW.Idle;

  if (loading) return <div className="px-8 py-12 text-center text-ceramic-ash text-[13px]">Loading lead research…</div>;
  if (!lead) return null;

  const tabs: Array<[string, typeof activeTab, React.ReactNode]> = [
    ['Profile', 'profile', <Brain size={14} key="b" />],
    ['Score', 'score', <TrendingUp size={14} key="s" />],
    ['Match', 'match', <Package size={14} key="m" />],
    ['Strategy', 'strategy', <Lightbulb size={14} key="st" />],
    ['Message', 'message', <Mail size={14} key="msg" />],
    ['Timeline', 'timeline', <Clock size={14} key="t" />],
  ];

  return (
    <div className="space-y-6" data-testid="lead-research">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link to={`/console/leads/${id}`} className="inline-flex items-center gap-2 text-[13px] text-ceramic-ash hover:text-ceramic-gold-matte">
          <ArrowLeft size={15} /> Back to Lead
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 mb-2">
              <Sparkles size={12} className="text-purple-600" />
              <span className="text-[11px] tracking-luxury uppercase text-purple-700">AI Research</span>
            </div>
            <h1 className="serif-heading text-[24px] md:text-[28px] leading-tight">{lead.companyName || 'Unknown Company'}</h1>
            <p className="text-[12px] text-ceramic-ash mt-1">
              {lead.country || '—'} · {lead.industry || '—'} · {lead.companyType || '—'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full border text-[12px] font-medium ${statusInfo.cls}`}>
              {researchStatus === 'Researching' || researchStatus === 'Retrying' ? <Loader2 size={13} className="inline mr-1 animate-spin" /> : null}
              {statusInfo.label}
            </span>
            <button onClick={doResearch} disabled={researching}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-[2px] bg-ceramic-gold-matte text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50">
              <Brain size={15} /> {profile ? 'Refresh Research' : 'Research Customer'}
            </button>
          </div>
        </div>
      </div>

      {/* Latest job info */}
      {latestJob && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-[2px] bg-white border border-ceramic-border text-[12px]">
          <span className="text-ceramic-ash">Job:</span>
          <code className="px-1.5 py-0.5 rounded bg-ceramic-cream/60 border border-ceramic-border">{latestJob._id.slice(-8)}</code>
          <span className="text-ceramic-ash">Provider:</span> <span className="font-medium">{latestJob.provider}</span>
          {latestJob.aiModel && <><span className="text-ceramic-ash">Model:</span> <code className="px-1.5 py-0.5 rounded bg-ceramic-cream/60 border border-ceramic-border">{latestJob.aiModel}</code></>}
          {latestJob.promptVersion && <><span className="text-ceramic-ash">Prompt:</span> <span>{latestJob.promptVersion}</span></>}
          {latestJob.confidence != null && <><span className="text-ceramic-ash">Confidence:</span> <span className="font-medium">{latestJob.confidence}</span></>}
          {latestJob.error && <span className="text-rose-600 flex items-center gap-1"><AlertTriangle size={12} /> {latestJob.error}</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-ceramic-border overflow-x-auto">
        {tabs.map(([label, key, icon]) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] border-b-2 transition whitespace-nowrap ${
              activeTab === key
                ? 'border-ceramic-gold-matte text-ceramic-gold-matte font-medium'
                : 'border-transparent text-ceramic-ash hover:text-ceramic-graphite'
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ===== Profile Tab ===== */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          {!profile ? (
            <EmptyState icon={<Brain size={32} />} title="No AI research yet"
              text="Click 'Research Customer' to generate a company profile. AI will only use existing Lead data — no fabrication." />
          ) : (
            <>
              {profile.editSource === 'MANUALLY_EDITED' && (
                <div className="px-4 py-2 rounded-[2px] bg-blue-50 border border-blue-200 text-[12px] text-blue-700 flex items-center gap-2">
                  <Pencil size={13} /> Manually edited — original AI snapshot preserved.
                </div>
              )}
              {/* §6 Company Profile */}
              <Card title="Company Overview" icon={<Brain size={15} />}>
                <Field field={profile.companySummary} label="Company Summary" />
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <Field field={profile.businessModel} label="Business Model" />
                  <Field field={profile.industry} label="Industry" />
                  <Field field={profile.companyType} label="Company Type" />
                  <Field field={profile.marketPosition} label="Market Position" />
                </div>
                <Field field={profile.targetCustomers} label="Target Customers" />
                <Field field={profile.productCategories} label="Product Categories" />
                <Field field={profile.potentialNeeds} label="Potential Needs" />
                <Field field={profile.possibleCeramicDemand} label="Ceramic Demand" />
              </Card>

              {/* §14 Research results */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="Purchase Signals" icon={<TrendingUp size={15} />}>
                  <Field field={profile.purchaseSignals} label="Signals" render={(v: string[]) => v.length ? <ul className="list-disc list-inside space-y-1">{v.map((s, i) => <li key={i}>{s}</li>)}</ul> : <span className="text-ceramic-ash italic">No signals</span>} />
                </Card>
                <Card title="Risk Signals" icon={<AlertTriangle size={15} />}>
                  <Field field={profile.riskSignals} label="Risks" render={(v: string[]) => v.length ? <ul className="list-disc list-inside space-y-1">{v.map((s, i) => <li key={i}>{s}</li>)}</ul> : <span className="text-ceramic-ash italic">No risks</span>} />
                </Card>
              </div>

              <Card title="Recommended Products" icon={<Package size={15} />}>
                <Field field={profile.recommendedProducts} label="Products"
                  render={(v: string[]) => v.length ? <div className="flex flex-wrap gap-2">{v.map((p, i) => <span key={i} className="px-2 py-1 rounded-full bg-ceramic-cream/60 border border-ceramic-border text-[12px]">{p}</span>)}</div> : <span className="text-ceramic-ash italic">No recommendations</span>} />
              </Card>

              <Card title="Recommended Approach" icon={<Lightbulb size={15} />}>
                <Field field={profile.recommendedApproach} label="Approach" />
              </Card>

              {/* §15 Sources */}
              <Card title="Sources" icon={<ExternalLink size={15} />}>
                {profile.sources && profile.sources.length ? (
                  <ul className="space-y-2 px-4 py-3">
                    {profile.sources.map((s, i) => (
                      <li key={i} className="text-[13px]">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-ceramic-gold-matte hover:underline flex items-center gap-1">
                          <ExternalLink size={12} /> {s.title || s.url}
                        </a>
                        <span className="text-[11px] text-ceramic-ash ml-1">({s.sourceType})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-[13px] text-ceramic-ash italic">No external source available.</div>
                )}
              </Card>

              {/* Confidence */}
              <div className="px-4 py-3 rounded-[2px] bg-white border border-ceramic-border text-[13px] flex items-center gap-3">
                <Shield size={15} className="text-ceramic-gold-matte" />
                <span className="text-ceramic-ash">Research Confidence:</span>
                <span className="serif-heading text-[20px]">{profile.confidence}</span>
                <span className="text-ceramic-ash text-[12px]">/ 100</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== Score Tab ===== */}
      {activeTab === 'score' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium">Purchase Intent & AI Lead Score</h2>
            <button onClick={doScore} className="inline-flex items-center gap-2 px-4 h-9 rounded-[2px] border border-ceramic-border hover:bg-ceramic-cream/40 text-[13px]">
              <RefreshCw size={14} /> {score ? 'Re-score' : 'Run AI Score'}
            </button>
          </div>
          {!intent && !score ? (
            <EmptyState icon={<TrendingUp size={32} />} title="No AI score yet"
              text="Run AI qualification to get purchase intent + composite lead score (rule + AI + intent + completeness)." />
          ) : (
            <>
              {/* §7 Purchase Intent */}
              {intent && (
                <Card title="Purchase Intent" icon={<Target size={15} />}>
                  <div className="px-4 py-3 border-b border-ceramic-border flex items-baseline gap-3">
                    <span className="serif-heading text-[36px]">{intent.score}</span>
                    <span className="text-ceramic-ash">/ 100</span>
                    <span className={`ms-auto px-3 py-1 rounded-full border text-[12px] font-medium ${
                      intent.grade === 'HIGH' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : intent.grade === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : intent.grade === 'LOW' ? 'bg-slate-50 text-slate-600 border-slate-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>{intent.grade}</span>
                  </div>
                  {intent.reasons.length > 0 && (
                    <div className="px-4 py-3 border-b border-ceramic-border">
                      <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-2">Reasons</div>
                      <ul className="space-y-1 text-[13px]">
                        {intent.reasons.map((r, i) => <li key={i} className="flex gap-2"><CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" /> {r}</li>)}
                      </ul>
                    </div>
                  )}
                  {intent.risks.length > 0 && (
                    <div className="px-4 py-3">
                      <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-2">Risks</div>
                      <ul className="space-y-1 text-[13px]">
                        {intent.risks.map((r, i) => <li key={i} className="flex gap-2"><AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" /> {r}</li>)}
                      </ul>
                    </div>
                  )}
                  {intent.grade === 'UNKNOWN' && (
                    <div className="px-4 py-3 text-[12px] text-ceramic-ash italic">
                      No reliable basis for intent score — marked UNKNOWN per §2 (no fabrication).
                    </div>
                  )}
                </Card>
              )}

              {/* §8-9 Lead Score breakdown */}
              {score && (
                <Card title="Lead Score Breakdown" icon={<TrendingUp size={15} />}>
                  <div className="px-4 py-4 border-b border-ceramic-border">
                    <div className="flex items-baseline gap-3">
                      <span className="serif-heading text-[40px]">{score.finalScore}</span>
                      <span className="text-ceramic-ash">/ 100</span>
                      <span className="ms-auto px-3 py-1 rounded-full bg-ceramic-gold-matte/10 border border-ceramic-gold-matte/20 text-[12px] font-medium text-ceramic-gold-matte">
                        Grade {score.finalScore >= 80 ? 'A' : score.finalScore >= 60 ? 'B' : score.finalScore >= 40 ? 'C' : 'D'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ceramic-border">
                    <ScoreBox label="Rule Score" value={score.ruleScore} />
                    <ScoreBox label="AI Score" value={score.aiScore} />
                    <ScoreBox label="Purchase Intent" value={score.purchaseIntent} />
                    <ScoreBox label="Data Completeness" value={score.dataCompleteness} suffix="%" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="px-4 py-3 border-b md:border-b-0 md:border-e border-ceramic-border">
                      <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-2">Reasons</div>
                      <ul className="space-y-1 text-[13px]">
                        {score.reasons.map((r, i) => <li key={i} className="flex gap-2"><CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" /> {r}</li>)}
                      </ul>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-2">Risks</div>
                      <ul className="space-y-1 text-[13px]">
                        {score.risks.map((r, i) => <li key={i} className="flex gap-2"><AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" /> {r}</li>)}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ===== Match Tab ===== */}
      {activeTab === 'match' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium">Product Matching</h2>
            <button onClick={doMatch} className="inline-flex items-center gap-2 px-4 h-9 rounded-[2px] border border-ceramic-border hover:bg-ceramic-cream/40 text-[13px]">
              <RefreshCw size={14} /> {matches.length ? 'Re-match' : 'Match Products'}
            </button>
          </div>
          {matches.length === 0 ? (
            <EmptyState icon={<Package size={32} />} title="No product matches"
              text="AI matches the Lead against your Product catalog (MongoDB). No fabricated products." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((m, i) => (
                <div key={i} className="px-4 py-3 rounded-[2px] bg-white border border-ceramic-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium truncate">{m.productId.slice(-8)}</span>
                    <span className="serif-heading text-[20px]">{m.matchScore}</span>
                  </div>
                  <div className="text-[12px] text-ceramic-ash mb-2">{m.reason}</div>
                  <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${CONF_CLS[m.confidence]}`}>{m.confidence}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Strategy Tab ===== */}
      {activeTab === 'strategy' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium">Development Strategy</h2>
            <button onClick={doStrategy} className="inline-flex items-center gap-2 px-4 h-9 rounded-[2px] border border-ceramic-border hover:bg-ceramic-cream/40 text-[13px]">
              <RefreshCw size={14} /> {strategy ? 'Regenerate' : 'Generate Strategy'}
            </button>
          </div>
          {!strategy ? (
            <EmptyState icon={<Lightbulb size={32} />} title="No strategy yet"
              text="AI generates target persona, pain points, value proposition, channel, timing, and follow-up plan." />
          ) : (
            <>
              <div className="px-4 py-2 rounded-[2px] bg-amber-50 border border-amber-200 text-[12px] text-amber-700 flex items-center gap-2">
                <Sparkles size={13} /> AI Generated — requires human confirmation before use.
              </div>
              <Card title="Target Persona" icon={<Target size={15} />}>
                <Field field={strategy.targetPersona} label="Persona" />
              </Card>
              <Card title="Pain Points" icon={<AlertTriangle size={15} />}>
                <Field field={strategy.painPoints} label="Pain Points" render={(v: string[]) => v.length ? <ul className="list-disc list-inside space-y-1">{v.map((p, i) => <li key={i}>{p}</li>)}</ul> : <span className="text-ceramic-ash italic">None</span>} />
              </Card>
              <Card title="Potential Products" icon={<Package size={15} />}>
                <Field field={strategy.potentialProducts} label="Products" render={(v: string[]) => v.length ? <div className="flex flex-wrap gap-2">{v.map((p, i) => <span key={i} className="px-2 py-1 rounded-full bg-ceramic-cream/60 border border-ceramic-border text-[12px]">{p}</span>)}</div> : <span className="text-ceramic-ash italic">None</span>} />
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card title="Value Proposition" icon={<Lightbulb size={15} />}><Field field={strategy.recommendedValueProposition} label="Value Prop" /></Card>
                <Card title="Channel" icon={<Send size={15} />}><Field field={strategy.recommendedChannel} label="Channel" /></Card>
                <Card title="Timing" icon={<Clock size={15} />}><Field field={strategy.recommendedTiming} label="Timing" /></Card>
              </div>
              <Card title="Follow-Up Strategy" icon={<MessageSquare size={15} />}>
                <Field field={strategy.followUpStrategy} label="Strategy" />
              </Card>
            </>
          )}
        </div>
      )}

      {/* ===== Message Tab ===== */}
      {activeTab === 'message' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium">Message Drafts</h2>
          </div>

          {/* §25 Generate options */}
          <div className="px-4 py-4 rounded-[2px] bg-white border border-ceramic-border">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-3">Generate Message</div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[11px] text-ceramic-ash block mb-1">Language</label>
                <select value={msgOpts.language} onChange={(e) => setMsgOpts({ ...msgOpts, language: e.target.value as any })}
                  className="h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-3 text-[13px]">
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-ceramic-ash block mb-1">Channel</label>
                <select value={msgOpts.channel} onChange={(e) => setMsgOpts({ ...msgOpts, channel: e.target.value as any })}
                  className="h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-3 text-[13px]">
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-ceramic-ash block mb-1">Purpose</label>
                <select value={msgOpts.purpose} onChange={(e) => setMsgOpts({ ...msgOpts, purpose: e.target.value as any })}
                  className="h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-3 text-[13px]">
                  <option value="FIRST_CONTACT">First Contact</option>
                  <option value="FOLLOW_UP">Follow Up</option>
                  <option value="INQUIRY_FOLLOW_UP">Inquiry Follow Up</option>
                  <option value="QUOTE_FOLLOW_UP">Quote Follow Up</option>
                  <option value="REACTIVATION">Reactivation</option>
                </select>
              </div>
              <button onClick={doGenerateMessage}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-[2px] bg-ceramic-gold-matte text-white text-[13px] font-medium hover:opacity-90">
                <Sparkles size={14} /> Generate
              </button>
            </div>
          </div>

          {/* §26 No auto-send notice */}
          <div className="px-4 py-2 rounded-[2px] bg-amber-50 border border-amber-200 text-[12px] text-amber-700 flex items-center gap-2">
            <Shield size={13} /> Drafts only — no auto-send. Review → Edit → Approve → Manual send.
          </div>

          {/* Drafts list */}
          {drafts.length === 0 ? (
            <EmptyState icon={<Mail size={32} />} title="No message drafts"
              text="Generate a draft above. AI creates subject + content + personalization + reason." />
          ) : (
            <div className="space-y-4">
              {drafts.map((d) => (
                <DraftCard key={d._id} draft={d}
                  onApprove={() => approveDraft(d._id)}
                  onReject={() => rejectDraft(d._id)}
                  onCopy={() => copyDraft(d)}
                  onEdit={(field, val) => editDraft(d._id, field, val)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Timeline Tab ===== */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <h2 className="text-[16px] font-medium">AI Action Timeline</h2>
          {audit.length === 0 ? (
            <EmptyState icon={<Clock size={32} />} title="No AI actions yet" text="All AI operations on this Lead are logged here." />
          ) : (
            <div className="rounded-[2px] bg-white border border-ceramic-border divide-y divide-ceramic-border">
              {audit.map((a) => (
                <div key={a._id} className="px-4 py-3 flex items-center gap-4 text-[13px]">
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] ${
                    a.status === 'OK' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : a.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>{a.status}</span>
                  <span className="font-medium">{a.action}</span>
                  <span className="text-ceramic-ash">{a.provider}</span>
                  {a.aiModel && <span className="text-ceramic-ash text-[12px]">{a.aiModel}</span>}
                  {a.promptVersion && <span className="text-ceramic-ash text-[12px]">{a.promptVersion}</span>}
                  <span className="ms-auto text-ceramic-ash text-[11px]">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Sub-components ----------
const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-[2px] bg-white border border-ceramic-border overflow-hidden">
    <div className="px-4 py-3 border-b border-ceramic-border flex items-center gap-2">
      {icon}
      <h3 className="text-[14px] font-medium">{title}</h3>
    </div>
    {children}
  </div>
);

const ScoreBox: React.FC<{ label: string; value: number; suffix?: string }> = ({ label, value, suffix }) => (
  <div className="px-4 py-3 bg-white">
    <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-1">{label}</div>
    <div className="serif-heading text-[22px] tabular-nums">{value}{suffix || ''}</div>
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="px-8 py-12 text-center">
    <div className="inline-flex p-4 rounded-full bg-ceramic-cream/40 mb-4 text-ceramic-ash">{icon}</div>
    <h3 className="text-[15px] font-medium mb-1">{title}</h3>
    <p className="text-[13px] text-ceramic-ash max-w-md mx-auto">{text}</p>
  </div>
);

const DraftCard: React.FC<{
  draft: AIMessageDraft;
  onApprove: () => void;
  onReject: () => void;
  onCopy: () => void;
  onEdit: (field: 'subject' | 'content', value: string) => void;
}> = ({ draft, onApprove, onReject, onCopy, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [content, setContent] = useState(draft.content);
  const statusCls: Record<string, string> = {
    DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
    EDITED: 'bg-blue-50 text-blue-700 border-blue-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
    SENT: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className="rounded-[2px] bg-white border border-ceramic-border overflow-hidden">
      <div className="px-4 py-3 border-b border-ceramic-border flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded-full border text-[11px] ${statusCls[draft.status]}`}>{draft.status}</span>
        <span className="text-[12px] text-ceramic-ash">{draft.language.toUpperCase()} · {draft.channel} · {draft.purpose.replace(/_/g, ' ')}</span>
        <span className="ms-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[11px] text-purple-700">
          <Sparkles size={10} /> AI Generated
        </span>
      </div>
      <div className="px-4 py-3 space-y-3">
        {editing ? (
          <>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-3 text-[13px]" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="w-full rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-3 py-2 text-[13px] font-mono" />
          </>
        ) : (
          <>
            <div className="text-[13px] font-medium">{draft.subject}</div>
            <pre className="text-[13px] whitespace-pre-wrap font-sans text-ceramic-graphite">{draft.content}</pre>
          </>
        )}
        {draft.personalization.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draft.personalization.map((p, i) => <span key={i} className="px-2 py-0.5 rounded-full bg-ceramic-cream/60 border border-ceramic-border text-[11px] text-ceramic-ash">{p}</span>)}
          </div>
        )}
        {draft.reason && <div className="text-[11px] text-ceramic-ash italic">{draft.reason}</div>}
      </div>
      <div className="px-4 py-3 border-t border-ceramic-border flex items-center gap-2">
        {editing ? (
          <>
            <button onClick={() => { onEdit('subject', subject); onEdit('content', content); setEditing(false); }}
              className="px-3 h-8 rounded-[2px] bg-ceramic-gold-matte text-white text-[12px] font-medium hover:opacity-90">Save</button>
            <button onClick={() => { setSubject(draft.subject); setContent(draft.content); setEditing(false); }}
              className="px-3 h-8 rounded-[2px] border border-ceramic-border text-[12px]">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 px-3 h-8 rounded-[2px] border border-ceramic-border text-[12px] hover:bg-ceramic-cream/40"><Pencil size={12} /> Edit</button>
            <button onClick={onCopy} className="inline-flex items-center gap-1 px-3 h-8 rounded-[2px] border border-ceramic-border text-[12px] hover:bg-ceramic-cream/40"><Copy size={12} /> Copy</button>
            {draft.status !== 'APPROVED' && draft.status !== 'REJECTED' && (
              <>
                <button onClick={onApprove} className="inline-flex items-center gap-1 px-3 h-8 rounded-[2px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] hover:bg-emerald-100"><ThumbsUp size={12} /> Approve</button>
                <button onClick={onReject} className="inline-flex items-center gap-1 px-3 h-8 rounded-[2px] bg-rose-50 border border-rose-200 text-rose-700 text-[12px] hover:bg-rose-100"><ThumbsDown size={12} /> Reject</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LeadResearch;

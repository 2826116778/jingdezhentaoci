/**
 * PHASE 2-C §41 AI Dashboard — /console/ai
 *
 * 显示：
 *   Research Jobs (total/completed/failed/queued/running)
 *   AI Leads / High Intent Leads / Message Drafts
 *   AI Usage (today/week/month/total: requests, tokens, cost, failed)
 *   Provider 信息 (active / model / configured)
 *   Recent Jobs（最近 10 条）
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, RefreshCw, Brain, CheckCircle2, XCircle, Clock, Loader2,
  Mail, Target, TrendingUp, DollarSign, Zap, AlertTriangle, Cpu,
} from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { AIDashboardSummary } from '../../../types';

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n || 0);
const fmtCost = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(n || 0);

const PURPOSE_LABEL: Record<string, string> = {
  CUSTOMER_RESEARCH: 'Research',
  LEAD_QUALIFICATION: 'Score',
  PRODUCT_MATCHING: 'Match',
  DEVELOPMENT_STRATEGY: 'Strategy',
  MESSAGE_DRAFT: 'Message',
};

const STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  QUEUED: 'bg-amber-50 text-amber-700 border-amber-200',
  RUNNING: 'bg-blue-50 text-blue-700 border-blue-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border-slate-200',
};

const AIDashboard: React.FC = () => {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AIDashboardSummary | null>(null);

  const load = async () => {
    setLoading(true);
    try { setData(await Console.AI.dashboard()); }
    catch (e: any) { showToast({ type: 'error', text: e?.message || 'Failed to load AI dashboard' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  if (loading) {
    return <div className="px-8 py-12 text-center text-ceramic-ash text-[13px]">Loading AI dashboard…</div>;
  }
  if (!data) return null;

  const kpis = [
    { label: 'Research Jobs', value: fmt(data.jobs.total), Icon: Brain, sub: `${data.jobs.completed} completed` },
    { label: 'Completed', value: fmt(data.jobs.completed), Icon: CheckCircle2, cls: 'text-emerald-600' },
    { label: 'Failed', value: fmt(data.jobs.failed), Icon: XCircle, cls: 'text-rose-600' },
    { label: 'Queued', value: fmt(data.jobs.queued), Icon: Clock, cls: 'text-amber-600' },
    { label: 'Running', value: fmt(data.jobs.running), Icon: Loader2, cls: 'text-blue-600' },
    { label: 'AI Leads', value: fmt(data.aiLeads), Icon: Target },
    { label: 'High Intent', value: fmt(data.highIntentLeads), Icon: TrendingUp, cls: 'text-ceramic-gold-matte' },
    { label: 'Message Drafts', value: fmt(data.messageDrafts.total), Icon: Mail, sub: `${data.messageDrafts.approved} approved` },
  ];

  const usageRows: Array<[string, any]> = [
    ['Today', data.usage.today],
    ['This Week', data.usage.thisWeek],
    ['This Month', data.usage.thisMonth],
    ['Total', data.usage.total],
  ];

  return (
    <div className="space-y-8" data-testid="ai-dashboard">
      {/* Hero */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 mb-3">
            <Sparkles size={13} className="text-purple-600" />
            <span className="text-[11px] tracking-luxury uppercase text-purple-700">Phase 2-C · AI Customer Research</span>
          </div>
          <h1 className="serif-heading text-[28px] md:text-[36px] leading-tight">AI Customer Research & Development</h1>
          <p className="text-[13px] md:text-[14px] text-ceramic-ash max-w-2xl mt-2">
            Lead → AI Research → Company Profile → Purchase Intent → Product Match → Development Strategy → Message Draft → Human Review.
            All AI results clearly distinguish CONFIRMED / INFERRED / UNKNOWN — never fabricated.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-[2px] border border-ceramic-border hover:bg-ceramic-cream/40 text-[13px]"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Provider banner */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-4 rounded-[2px] bg-white border border-ceramic-border">
        <Cpu size={18} className="text-ceramic-gold-matte" />
        <div className="text-[13px]">
          <span className="text-ceramic-ash">Active Provider:</span>{' '}
          <span className="font-medium uppercase">{data.provider.active}</span>
          {' · '}
          <span className="text-ceramic-ash">Model:</span> <code className="px-1.5 py-0.5 rounded bg-ceramic-cream/60 border border-ceramic-border">{data.provider.model}</code>
        </div>
        {data.provider.isConfigured
          ? <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] border border-emerald-200">Configured</span>
          : <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] border border-amber-200">Using Mock (no API key)</span>
        }
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="px-5 py-4 rounded-[2px] bg-white border border-ceramic-border">
            <div className="flex items-center justify-between mb-2">
              <k.Icon size={16} className={`text-ceramic-ash ${k.cls || ''}`} />
            </div>
            <div className="serif-heading text-[26px] leading-none">{k.value}</div>
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mt-2">{k.label}</div>
            {k.sub && <div className="text-[11px] text-ceramic-ash mt-1">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Usage table */}
      <div className="rounded-[2px] bg-white border border-ceramic-border overflow-hidden">
        <div className="px-5 py-4 border-b border-ceramic-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-ceramic-gold-matte" />
            <h2 className="text-[15px] font-medium">AI Usage & Cost</h2>
          </div>
          <Link to="/console/ai/usage" className="text-[12px] text-ceramic-gold-matte hover:underline">View details →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-ceramic-cream/40 text-ceramic-ash text-[11px] tracking-luxury uppercase">
              <tr>
                <th className="text-start px-5 py-3 font-medium">Period</th>
                <th className="text-end px-5 py-3 font-medium">Requests</th>
                <th className="text-end px-5 py-3 font-medium">Tokens</th>
                <th className="text-end px-5 py-3 font-medium">Est. Cost</th>
                <th className="text-end px-5 py-3 font-medium">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ceramic-border">
              {usageRows.map(([label, u]) => (
                <tr key={label as string}>
                  <td className="px-5 py-3 font-medium">{label as string}</td>
                  <td className="px-5 py-3 text-end tabular-nums">{fmt(u.requests)}</td>
                  <td className="px-5 py-3 text-end tabular-nums">{fmt(u.tokens)}</td>
                  <td className="px-5 py-3 text-end tabular-nums">{fmtCost(u.cost)}</td>
                  <td className="px-5 py-3 text-end tabular-nums">
                    {u.failed > 0 ? <span className="text-rose-600">{fmt(u.failed)}</span> : <span className="text-ceramic-ash">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="rounded-[2px] bg-white border border-ceramic-border overflow-hidden">
        <div className="px-5 py-4 border-b border-ceramic-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-ceramic-gold-matte" />
            <h2 className="text-[15px] font-medium">Recent Jobs</h2>
          </div>
          <Link to="/console/ai/jobs" className="text-[12px] text-ceramic-gold-matte hover:underline">View all →</Link>
        </div>
        {data.recentJobs.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-ceramic-ash">
            No AI jobs yet. Go to a Lead and click "Research Customer" to start.
          </div>
        ) : (
          <div className="divide-y divide-ceramic-border">
            {data.recentJobs.map((j) => (
              <div key={j._id} className="px-5 py-3 flex items-center gap-4 text-[13px]">
                <span className={`px-2 py-0.5 rounded-full border text-[11px] ${STATUS_CLS[j.status] || ''}`}>{j.status}</span>
                <span className="text-ceramic-ash">{PURPOSE_LABEL[j.purpose] || j.purpose}</span>
                <Link to={`/console/leads/${j.leadId}/research`} className="text-ceramic-gold-matte hover:underline truncate">
                  Lead {j.leadId.slice(-6)}
                </Link>
                <span className="text-ceramic-ash text-[12px] hidden sm:inline">{j.provider}</span>
                {j.confidence != null && <span className="text-ceramic-ash text-[12px]">conf {j.confidence}</span>}
                {j.error && (
                  <span className="text-rose-600 text-[12px] flex items-center gap-1">
                    <AlertTriangle size={12} /> {j.errorKind}
                  </span>
                )}
                <span className="ms-auto text-ceramic-ash text-[11px]">{new Date(j.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/console/ai/jobs" className="px-5 py-4 rounded-[2px] bg-white border border-ceramic-border hover:border-ceramic-gold-matte/40 transition">
          <Brain size={18} className="text-ceramic-gold-matte mb-2" />
          <div className="text-[14px] font-medium">AI Jobs</div>
          <div className="text-[12px] text-ceramic-ash mt-1">Search, retry failed, cancel queued</div>
        </Link>
        <Link to="/console/ai/usage" className="px-5 py-4 rounded-[2px] bg-white border border-ceramic-border hover:border-ceramic-gold-matte/40 transition">
          <DollarSign size={18} className="text-ceramic-gold-matte mb-2" />
          <div className="text-[14px] font-medium">AI Usage</div>
          <div className="text-[12px] text-ceramic-ash mt-1">Tokens, cost, failed requests</div>
        </Link>
        <Link to="/console/leads" className="px-5 py-4 rounded-[2px] bg-white border border-ceramic-border hover:border-ceramic-gold-matte/40 transition">
          <Target size={18} className="text-ceramic-gold-matte mb-2" />
          <div className="text-[14px] font-medium">Leads</div>
          <div className="text-[12px] text-ceramic-ash mt-1">Select a lead to run AI research</div>
        </Link>
      </div>
    </div>
  );
};

export default AIDashboard;

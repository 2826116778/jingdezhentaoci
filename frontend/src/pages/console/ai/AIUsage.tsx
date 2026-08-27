/**
 * PHASE 2-C §43 AI Usage — /console/ai/usage
 *
 * 显示：Today / This Week / This Month / Total
 *   Requests / Tokens / Estimated Cost / Failed Requests
 * + Budget status (daily / monthly / per-lead limits)
 * + Provider info
 */
import React, { useEffect, useState } from 'react';
import {
  RefreshCw, Zap, DollarSign, AlertTriangle, Cpu, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Activity,
} from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { AIUsageSummary, AIBudget, AIProviderInfo } from '../../../types';

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n || 0);
const fmtCost = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(n || 0);

const AIUsage: React.FC = () => {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<AIUsageSummary | null>(null);
  const [budget, setBudget] = useState<AIBudget | null>(null);
  const [provider, setProvider] = useState<AIProviderInfo | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [u, b, p] = await Promise.all([
        Console.AI.getUsage(),
        Console.AI.getBudget(),
        Console.AI.getProvider(),
      ]);
      setUsage(u);
      setBudget(b);
      setProvider(p);
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Failed to load AI usage' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  if (loading) {
    return <div className="px-8 py-12 text-center text-ceramic-ash text-[13px]">Loading AI usage…</div>;
  }

  const periods: Array<[string, AIUsageSummary['today']]> = [
    ['Today', usage?.today || { requests: 0, tokens: 0, cost: 0, failed: 0 }],
    ['This Week', usage?.thisWeek || { requests: 0, tokens: 0, cost: 0, failed: 0 }],
    ['This Month', usage?.thisMonth || { requests: 0, tokens: 0, cost: 0, failed: 0 }],
    ['Total', usage?.total || { requests: 0, tokens: 0, cost: 0, failed: 0 }],
  ];

  return (
    <div className="space-y-8" data-testid="ai-usage">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="serif-heading text-[24px] md:text-[28px]">AI Usage & Cost</h1>
          <p className="text-[12px] text-ceramic-ash mt-1">Token usage, estimated cost, and budget limits</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 h-10 rounded-[2px] border border-ceramic-border hover:bg-ceramic-cream/40 text-[13px]">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Provider */}
      {provider && (
        <div className="flex flex-wrap items-center gap-4 px-5 py-4 rounded-[2px] bg-white border border-ceramic-border">
          <Cpu size={18} className="text-ceramic-gold-matte" />
          <div className="text-[13px]">
            <span className="text-ceramic-ash">Provider:</span> <span className="font-medium uppercase">{provider.active}</span>
            {' · '}
            <span className="text-ceramic-ash">Model:</span> <code className="px-1.5 py-0.5 rounded bg-ceramic-cream/60 border border-ceramic-border">{provider.model}</code>
            {' · '}
            <span className="text-ceramic-ash">Timeout:</span> {provider.timeoutMs}ms
            {' · '}
            <span className="text-ceramic-ash">Concurrency:</span> {provider.concurrency}
          </div>
        </div>
      )}

      {/* Usage cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {periods.map(([label, u]) => (
          <div key={label} className="px-5 py-5 rounded-[2px] bg-white border border-ceramic-border">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-3">{label}</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ceramic-ash flex items-center gap-1.5"><Activity size={13} /> Requests</span>
                <span className="serif-heading text-[20px] tabular-nums">{fmt(u.requests)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ceramic-ash flex items-center gap-1.5"><Zap size={13} /> Tokens</span>
                <span className="text-[15px] tabular-nums">{fmt(u.tokens)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ceramic-ash flex items-center gap-1.5"><DollarSign size={13} /> Cost</span>
                <span className="text-[15px] tabular-nums">{fmtCost(u.cost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ceramic-ash flex items-center gap-1.5">
                  {u.failed > 0 ? <XCircle size={13} className="text-rose-500" /> : <CheckCircle2 size={13} className="text-emerald-500" />}
                  Failed
                </span>
                <span className={`text-[15px] tabular-nums ${u.failed > 0 ? 'text-rose-600' : 'text-ceramic-ash'}`}>{fmt(u.failed)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget */}
      {budget && (
        <div className="rounded-[2px] bg-white border border-ceramic-border overflow-hidden">
          <div className="px-5 py-4 border-b border-ceramic-border flex items-center gap-2">
            <AlertTriangle size={16} className="text-ceramic-gold-matte" />
            <h2 className="text-[15px] font-medium">Budget Limits</h2>
            {budget.blocked && (
              <span className="ms-auto px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] border border-rose-200">Blocked</span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {budget.message && (
              <div className="px-3 py-2 rounded-[2px] bg-rose-50 border border-rose-200 text-[13px] text-rose-700">
                {budget.message}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Daily */}
              <div>
                <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-1">Daily</div>
                <div className="flex items-baseline gap-2">
                  <span className="serif-heading text-[22px]">{budget.daily}</span>
                  <span className="text-ceramic-ash text-[13px]">/ {budget.limits.daily}</span>
                </div>
                <BudgetBar used={budget.daily} limit={budget.limits.daily} />
              </div>
              {/* Monthly */}
              <div>
                <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-1">Monthly</div>
                <div className="flex items-baseline gap-2">
                  <span className="serif-heading text-[22px]">{budget.monthly}</span>
                  <span className="text-ceramic-ash text-[13px]">/ {budget.limits.monthly}</span>
                </div>
                <BudgetBar used={budget.monthly} limit={budget.limits.monthly} />
              </div>
              {/* Per-Lead */}
              <div>
                <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-1">Per-Lead Daily</div>
                <div className="flex items-baseline gap-2">
                  <span className="serif-heading text-[22px]">{budget.perLead}</span>
                  <span className="text-ceramic-ash text-[13px]">/ {budget.limits.perLead}</span>
                </div>
                <BudgetBar used={budget.perLead} limit={budget.limits.perLead} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      <div className="px-5 py-4 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border text-[12px] text-ceramic-ash">
        <strong className="text-ceramic-graphite">§38/§39 Note:</strong> When <code className="px-1 py-0.5 rounded bg-white border border-ceramic-border">OPENAI_API_KEY</code> is not configured, the system uses the Mock provider (zero cost, deterministic, no external calls). Production can switch to OpenAI by setting <code className="px-1 py-0.5 rounded bg-white border border-ceramic-border">AI_PROVIDER=openai</code> + <code className="px-1 py-0.5 rounded bg-white border border-ceramic-border">OPENAI_API_KEY</code>.
      </div>
    </div>
  );
};

const BudgetBar: React.FC<{ used: number; limit: number }> = ({ used, limit }) => {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const cls = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-1.5 rounded-full bg-ceramic-border overflow-hidden mt-2">
      <div className={`h-full ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export default AIUsage;

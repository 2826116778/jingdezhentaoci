/**
 * Analytics Overview（PHASE 1 基础框架）。
 * - 严格真实 /api/console/analytics/overview 返回。
 * - 所有 0 值 / 空数组都原样显示。
 * - 任何图表/表格都不造假数字。空 → EmptyState；非空 → Phase 2 图表。
 */
import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, ArrowRightLeft, Users, ShoppingBag, Globe2, Package, UserCog } from 'lucide-react';
import ConsoleEmptyState from '../../components/console/ConsoleEmptyState';
import { Console } from '../../api/console';
import type { ConsoleAnalyticsOverview } from '../../types';

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConsoleAnalyticsOverview | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await Console.analyticsOverview()); }
    catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const period = data?.period ?? '30d';
  const funnels = data?.funnels;

  return (
    <div className="space-y-6" data-testid="console-analytics">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="serif-heading text-[28px] md:text-[32px] leading-none">Analytics</h2>
          <p className="text-[13px] text-ceramic-ash mt-2 max-w-2xl">
            Performance overview for the current period (Backend returned <code>{period}</code>).
            All numbers are from the real backend — no mock data.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-gold !px-4 flex items-center gap-2">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Funnel 4 指标（真实 data，全 0 就显 0） */}
      <section
        data-testid="analytics-funnel"
        className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5"
      >
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={`sk-f${i}`} className="bg-white border border-ceramic-border rounded-[2px] p-5 animate-pulse space-y-3">
            <div className="h-3 w-16 bg-ceramic-cream rounded" />
            <div className="h-8 w-24 bg-ceramic-cream rounded" />
          </div>
        ))}
        {!loading && !error && funnels && (
          <>
            {[
              { k: 'leads',     label: 'Leads',       Icon: Users },
              { k: 'inquiries', label: 'Inquiries',   Icon: ArrowRightLeft },
              { k: 'quotes',    label: 'Quotes',      Icon: Package },
              { k: 'orders',    label: 'Orders',      Icon: ShoppingBag },
            ].map(({ k, label, Icon }) => (
              <div key={k} className="bg-white border border-ceramic-border rounded-[2px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{label}</span>
                  <Icon size={15} className="text-ceramic-ash" />
                </div>
                <div className="serif-heading text-[28px] leading-none text-ceramic-graphite" data-funnel={k} data-value={(funnels as any)[k]}>
                  {new Intl.NumberFormat('en-US').format((funnels as any)[k] ?? 0)}
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      {/* 4 个 Attribution / Drill-down EmptyStates（严格按真实 length） */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">By source</h3>
            <ArrowRightLeft size={17} className="text-ceramic-ash" />
          </div>
          {loading ? <div className="h-56 animate-pulse bg-ceramic-cream rounded-[2px]" />
            : data?.bySource.length === 0
            ? <ConsoleEmptyState icon={ArrowRightLeft} title="No source attribution yet" description="Phase 2 will show lead, orders & revenue by channel (website / LinkedIn / Google ads / WhatsApp / referrals)." />
            : <div className="h-56 bg-ceramic-cream rounded-[2px] p-3 text-[11px] text-ceramic-ash">Phase 2 · Drill-down renderer</div>}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">By country</h3>
            <Globe2 size={17} className="text-ceramic-ash" />
          </div>
          {loading ? <div className="h-56 animate-pulse bg-ceramic-cream rounded-[2px]" />
            : data?.byCountry.length === 0
            ? <ConsoleEmptyState icon={Globe2} title="No country breakdown yet" description="Geographic funnel appears once leads & orders are linked to regions." />
            : <div className="h-56 bg-ceramic-cream rounded-[2px] p-3 text-[11px] text-ceramic-ash">Phase 2 · World map + table</div>}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">By product</h3>
            <Package size={17} className="text-ceramic-ash" />
          </div>
          {loading ? <div className="h-56 animate-pulse bg-ceramic-cream rounded-[2px]" />
            : data?.byProduct.length === 0
            ? <ConsoleEmptyState icon={Package} title="No product performance yet" description="Top product SKUs will appear once order data is integrated." />
            : <div className="h-56 bg-ceramic-cream rounded-[2px] p-3 text-[11px] text-ceramic-ash">Phase 2 · Product ranking renderer</div>}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">By sales rep</h3>
            <UserCog size={17} className="text-ceramic-ash" />
          </div>
          {loading ? <div className="h-56 animate-pulse bg-ceramic-cream rounded-[2px]" />
            : data?.bySalesRep.length === 0
            ? <ConsoleEmptyState icon={UserCog} title="No sales team data yet" description="Sales rep attribution and rankings will unlock once role-based assignments ship in Phase 2." />
            : <div className="h-56 bg-ceramic-cream rounded-[2px] p-3 text-[11px] text-ceramic-ash">Phase 2 · Team ranking renderer</div>}
        </div>
      </section>

      {/* 错误兜底 */}
      {error && (
        <div>
          <ConsoleEmptyState
            icon={BarChart3}
            title="Unable to load analytics"
            description={error}
            action={{ label: 'Retry', onClick: load }}
            error={error}
            testId="analytics-error"
          />
        </div>
      )}
    </div>
  );
};

export default Analytics;

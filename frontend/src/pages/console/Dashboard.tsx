/**
 * Console Dashboard (PHASE 1)
 *
 * 严格不造假数据：
 *  - KPIs 全部读取 /api/console/dashboard/summary → 返回 {kpis: 全0, charts: 全空数组, recent: {...}}
 *  - 任何字段为 0 / [] 都原样渲染。
 *  - 用户可见 9 张 0 KPI 卡 + 4 个图表空状态（EmptyState）+ 3 条 recent 空状态
 *    —— 这是 Phase 1 "建立正确架构" 的刻意设计。
 *  - 绝不出现"硬编码数字"，任何显示的 number 必须来源于 Console.dashboardSummary()。
 */
import React, { useEffect, useState } from 'react';
import {
  Users2, UserCheck, MessageSquare, FileText, ShoppingCart, DollarSign,
  ListTodo, MessageCircle, TrendingUp, RefreshCw, Sparkles,
  LineChart, PieChart, Globe2, Inbox, Package2, ClipboardList,
} from 'lucide-react';
import ConsoleEmptyState from '../../components/console/ConsoleEmptyState';
import { Console } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleDashboardKPIs, ConsoleDashboardSummary } from '../../types';

const KPI_LIST: Array<{
  key: keyof ConsoleDashboardKPIs;
  label: string;
  Icon: any;
  currency?: boolean;
  percent?: boolean;
}> = [
  { key: 'totalLeads',             label: 'Total Leads',       Icon: Users2 },
  { key: 'totalCustomers',         label: 'Customers',         Icon: UserCheck },
  { key: 'totalInquiries',         label: 'Inquiries',         Icon: MessageSquare },
  { key: 'totalQuotes',            label: 'Quotes',            Icon: FileText },
  { key: 'totalOrders',            label: 'Orders',            Icon: ShoppingCart },
  { key: 'totalOrderAmountUsd',    label: 'Revenue (USD)',     Icon: DollarSign, currency: true },
  { key: 'pendingTasks',           label: 'Pending Tasks',     Icon: ListTodo },
  { key: 'upcomingFollowups',      label: 'Upcoming Followups', Icon: MessageCircle },
  { key: 'conversionRate',         label: 'Conversion Rate %', Icon: TrendingUp, percent: true },
];

const fmt = (n: number, opts?: { currency?: boolean; percent?: boolean }) => {
  if (opts?.percent) return `${(Number.isFinite(n) ? n : 0).toFixed(2)}%`;
  if (opts?.currency) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
  }
  return new Intl.NumberFormat('en-US').format(n || 0);
};

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConsoleDashboardSummary | null>(null);
  const { showToast } = useApp();

  const load = async () => {
    setLoading(true); setError(null);
    try { setSummary(await Console.dashboardSummary()); }
    catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const kpis = summary?.kpis;
  const charts = summary?.charts;

  return (
    <div className="space-y-8" data-testid="console-dashboard">
      {/* Hero 头 */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ceramic-gold-matte/10 border border-ceramic-gold-matte/20 mb-3">
            <Sparkles size={13} className="text-ceramic-gold-matte" />
            <span className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte">
              Phase 1 Foundation · Real API · No Mock Data
            </span>
          </div>
          <h1 className="serif-heading text-[28px] md:text-[36px] leading-tight">
            Welcome back to your overseas sales workbench.
          </h1>
          <p className="text-[13px] md:text-[14px] text-ceramic-ash max-w-2xl mt-2">
            KPIs below are fetched live from <code className="px-1.5 py-0.5 rounded bg-ceramic-cream/60 border border-ceramic-border">/api/console/dashboard/summary</code>
            {' '}and rendered as-is (0s, empty arrays). Phase 2 will plug in lead crawlers, sales automation & AI analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast({ type: 'info', text: 'Automation pipelines ship in Phase 2.' })}
            className="btn-gold-outline !px-4 text-[13px]"
          >
            Set Up Pipelines
          </button>
          <button onClick={load} disabled={loading} className="btn-gold !px-4 text-[13px] flex items-center gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* 9 KPI 卡 */}
      <section data-testid="kpi-grid" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5">
        {loading && Array.from({ length: 9 }).map((_, i) => (
          <div key={`sk-${i}`} className="bg-white border border-ceramic-border rounded-[2px] p-5 animate-pulse">
            <div className="h-4 w-20 bg-ceramic-cream rounded mb-4" />
            <div className="h-8 w-24 bg-ceramic-cream rounded mb-2" />
            <div className="h-3 w-16 bg-ceramic-cream rounded" />
          </div>
        ))}
        {!loading && !error && KPI_LIST.map(({ key, label, Icon, ...opts }) => (
          <div key={String(key)} className="bg-white border border-ceramic-border rounded-[2px] p-5 hover:shadow-gold-sm transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{label}</span>
              <div className="w-8 h-8 rounded-[2px] bg-ceramic-cream border border-ceramic-border flex items-center justify-center">
                <Icon size={15} className="text-ceramic-ash" />
              </div>
            </div>
            <div
              className={`serif-heading leading-none ${opts.currency ? 'text-[22px]' : 'text-[30px]'} text-ceramic-graphite`}
              data-kpi-key={key}
              data-kpi-value={kpis ? (kpis as any)[key] : 'loading'}
            >
              {fmt((kpis as any)?.[key] ?? 0, opts as any)}
            </div>
            <div className="mt-3 text-[11px] text-ceramic-ash flex items-center gap-1">
              <TrendingUp size={12} />
              <span>
                {(kpis as any)?.[key] === 0
                  ? 'Empty (Phase 1 base)'
                  : 'Auto refreshed'}
              </span>
            </div>
          </div>
        ))}
        {error && (
          <div className="col-span-full">
            <ConsoleEmptyState
              icon={TrendingUp}
              title="Unable to load KPIs"
              description={error}
              action={{ label: 'Retry', onClick: load }}
              loading={loading}
              error={error}
              testId="dashboard-kpi-error"
            />
          </div>
        )}
      </section>

      {/* 4 Charts Empty State 卡（严格来自后端，数组空则显示 empty） */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="serif-heading text-[18px]">Leads · Last 30 days</h3>
              <p className="text-[12px] text-ceramic-ash mt-1">
                Data points loaded: {charts?.leadsLast30Days.length ?? '…'} (from backend)
              </p>
            </div>
            <LineChart size={18} className="text-ceramic-ash" />
          </div>
          {loading || !charts
            ? <div className="h-48 animate-pulse bg-ceramic-cream rounded-[2px]" />
            : charts.leadsLast30Days.length === 0
            ? <ConsoleEmptyState icon={LineChart} title="No lead data yet" description="Once lead discovery runs in Phase 2, this chart will show daily lead creation." />
            : <div className="h-48 bg-ceramic-cream rounded-[2px] p-3 text-[11px] text-ceramic-ash">Chart renderer · Phase 2 (ECharts / Recharts)</div>}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="serif-heading text-[18px]">Orders & Revenue · Last 30 days</h3>
              <p className="text-[12px] text-ceramic-ash mt-1">
                Data points loaded: {charts?.ordersLast30Days.length ?? '…'}
              </p>
            </div>
            <DollarSign size={18} className="text-ceramic-ash" />
          </div>
          {loading || !charts
            ? <div className="h-48 animate-pulse bg-ceramic-cream rounded-[2px]" />
            : charts.ordersLast30Days.length === 0
            ? <ConsoleEmptyState icon={DollarSign} title="No orders yet" description="Paid orders from the shop & future direct sales will land here." />
            : <div className="h-48 bg-ceramic-cream rounded-[2px] p-3 text-[11px] text-ceramic-ash">Chart renderer · Phase 2</div>}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="serif-heading text-[18px]">Inquiries by source</h3>
              <p className="text-[12px] text-ceramic-ash mt-1">
                Sources loaded: {charts?.inquiriesBySource.length ?? '…'}
              </p>
            </div>
            <PieChart size={18} className="text-ceramic-ash" />
          </div>
          {loading || !charts
            ? <div className="h-48 animate-pulse bg-ceramic-cream rounded-[2px]" />
            : charts.inquiriesBySource.length === 0
            ? <ConsoleEmptyState icon={PieChart} title="No inquiry sources yet" description="Slices will appear once Contact / OEM / Product detail forms receive traffic." />
            : <div className="h-48 bg-ceramic-cream rounded-[2px] p-3 text-[11px] text-ceramic-ash">Chart renderer · Phase 2</div>}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="serif-heading text-[18px]">Top countries</h3>
              <p className="text-[12px] text-ceramic-ash mt-1">
                Countries loaded: {charts?.topCountries.length ?? '…'}
              </p>
            </div>
            <Globe2 size={18} className="text-ceramic-ash" />
          </div>
          {loading || !charts
            ? <div className="h-48 animate-pulse bg-ceramic-cream rounded-[2px]" />
            : charts.topCountries.length === 0
            ? <ConsoleEmptyState icon={Globe2} title="No geographic data yet" description="Country breakdown appears once we start linking leads & orders to regions." />
            : <div className="h-48 bg-ceramic-cream rounded-[2px] p-3 text-[11px] text-ceramic-ash">Chart renderer · Phase 2</div>}
        </div>
      </section>

      {/* Recent 3 列：Inquiries / Orders / Tasks */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">Recent Inquiries</h3>
            <Inbox size={17} className="text-ceramic-ash" />
          </div>
          {!summary || summary.recent.inquiries.length === 0
            ? <ConsoleEmptyState icon={MessageSquare} title="No recent inquiries" description="Phase 2 will highlight unread & priority inquiries here." />
            : <div className="text-[13px] text-ceramic-ash">Phase 2 · Render list rows</div>}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">Recent Orders</h3>
            <Package2 size={17} className="text-ceramic-ash" />
          </div>
          {!summary || summary.recent.orders.length === 0
            ? <ConsoleEmptyState icon={ShoppingCart} title="No recent orders" description="Paid, pending & recently shipped orders will appear here." />
            : <div className="text-[13px] text-ceramic-ash">Phase 2 · Render list rows</div>}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">My Tasks</h3>
            <ClipboardList size={17} className="text-ceramic-ash" />
          </div>
          {!summary || summary.recent.tasks.length === 0
            ? <ConsoleEmptyState icon={ListTodo} title="No pending tasks" description="Create tasks against leads, customers, quotes or orders in Phase 2." />
            : <div className="text-[13px] text-ceramic-ash">Phase 2 · Render list rows</div>}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;

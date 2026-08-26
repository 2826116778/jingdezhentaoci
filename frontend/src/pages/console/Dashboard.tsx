/**
 * Console Dashboard (PHASE 2-A 真实统计 + 原生 HTML/CSS Charts)
 *
 * - KPIs: 真实 MongoDB 聚合
 * - 4 Charts: 后端返回空数组则 EmptyState，有数据则原生 HTML/CSS 渲染
 * - 不造假数据：所有数值严格来自 Console.dashboardSummary()
 */
import React, { useEffect, useState } from 'react';
import {
  Users2, UserCheck, MessageSquare, FileText, ShoppingCart, DollarSign,
  ListTodo, MessageCircle, TrendingUp, RefreshCw, Sparkles,
  LineChart, PieChart, Globe2, Inbox, Package2, ClipboardList, BarChart3,
} from 'lucide-react';
import ConsoleEmptyState from '../../components/console/ConsoleEmptyState';
import { Console } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleDashboardKPIs, ConsoleDashboardSummary, TimeSeriesPoint, RevenuePoint, BySourcePoint, ByCountryPoint } from '../../types';

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
  { key: 'upcomingFollowups',      label: 'Upcoming Followups',Icon: MessageCircle },
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
              Phase 2-A · Live MongoDB · No Mock
            </span>
          </div>
          <h1 className="serif-heading text-[28px] md:text-[36px] leading-tight">
            Welcome back to your overseas sales workbench.
          </h1>
          <p className="text-[13px] md:text-[14px] text-ceramic-ash max-w-2xl mt-2">
            KPIs & charts below are fetched live from <code className="px-1.5 py-0.5 rounded bg-ceramic-cream/60 border border-ceramic-border">/api/console/dashboard/summary</code>
            {' '}and rendered as-is — real MongoDB aggregation, zero hardcoded numbers.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                  ? 'Empty DB · zero records'
                  : 'Live from MongoDB'}
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

      {/* 4 Charts — 有数据则原生 HTML/CSS 渲染 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Leads · Last 30 days" subtitle={`Data points: ${charts?.leadsLast30Days.length ?? '…'}`} Icon={LineChart}>
          {loading || !charts
            ? <Skeleton />
            : charts.leadsLast30Days.length === 0
            ? <ConsoleEmptyState icon={LineChart} title="No lead data yet" description="Create leads via the Leads page and they will begin appearing here." />
            : <BarsTimeSeries data={charts.leadsLast30Days} color="bg-ceramic-gold-matte" valueLabel="Leads" />}
        </ChartCard>

        <ChartCard title="Orders & Revenue · Last 30 days" subtitle={`Data points: ${charts?.ordersLast30Days.length ?? '…'}`} Icon={DollarSign}>
          {loading || !charts
            ? <Skeleton />
            : charts.ordersLast30Days.length === 0
            ? <ConsoleEmptyState icon={DollarSign} title="No orders yet" description="Paid orders from the shop or direct Quote conversions will appear here." />
            : <RevenueBars data={charts.ordersLast30Days} />}
        </ChartCard>

        <ChartCard title="Inquiries by source" subtitle={`Sources: ${charts?.inquiriesBySource.length ?? '…'}`} Icon={PieChart}>
          {loading || !charts
            ? <Skeleton />
            : charts.inquiriesBySource.length === 0
            ? <ConsoleEmptyState icon={PieChart} title="No inquiry sources yet" description="Traffic from Contact / OEM / Product detail forms will create slices." />
            : <HBarPercent data={charts.inquiriesBySource.map(s => ({ label: s.source, value: s.count }))} />}
        </ChartCard>

        <ChartCard title="Top countries" subtitle={`Countries: ${charts?.topCountries.length ?? '…'}`} Icon={Globe2}>
          {loading || !charts
            ? <Skeleton />
            : charts.topCountries.length === 0
            ? <ConsoleEmptyState icon={Globe2} title="No geographic data yet" description="Once Leads / Customers / Orders specify countries, the breakdown appears here." />
            : <HBarPercent data={charts.topCountries.map(c => ({ label: c.country, value: c.count }))} paletteCountry />}
        </ChartCard>
      </section>

      {/* Recent 3 列：Inquiries / Orders / Tasks */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">Recent Inquiries</h3>
            <Inbox size={17} className="text-ceramic-ash" />
          </div>
          {!summary || !summary.recent || (summary.recent.inquiries as any[]).length === 0
            ? <ConsoleEmptyState icon={MessageSquare} title="No recent inquiries" description="Inquiries created via Console or public forms will appear here." />
            : <RecentRows rows={(summary.recent.inquiries as any[]).slice(0, 5)} titleKey={['subject','productName','company','name']} subKey="message" dateKey="createdAt" />}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">Recent Orders</h3>
            <Package2 size={17} className="text-ceramic-ash" />
          </div>
          {!summary || !summary.recent || (summary.recent.orders as any[]).length === 0
            ? <ConsoleEmptyState icon={ShoppingCart} title="No recent orders" description="New orders (shop + CRM) will be highlighted here." />
            : <RecentRows rows={(summary.recent.orders as any[]).slice(0, 5)} titleKey={['orderNo']} subKey={(r: any) => `USD ${(r.totalAmount || r.usdtAmount || 0).toLocaleString()} · ${r.paymentStatus}`} dateKey="createdAt" />}
        </div>

        <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif-heading text-[18px]">My Tasks</h3>
            <ClipboardList size={17} className="text-ceramic-ash" />
          </div>
          {!summary || !summary.recent || (summary.recent.tasks as any[]).length === 0
            ? <ConsoleEmptyState icon={ListTodo} title="No pending tasks" description="Create tasks on the Tasks page to track priorities here." />
            : <RecentRows
                rows={(summary.recent.tasks as any[]).slice(0, 5)}
                titleKey={['title']}
                subKey={(r: any) => `${r.priority} · ${r.status}${r.dueAt ? ' · Due ' + new Date(r.dueAt).toLocaleDateString() : ''}`}
                dateKey="createdAt"
              />}
        </div>
      </section>
    </div>
  );
};

/* =====================================================================
 *  可复用 Dashboard 小组件（纯 HTML/CSS，无额外依赖）
 * ===================================================================== */
function ChartCard({ title, subtitle, Icon, children }: {
  title: string; subtitle: string; Icon: any; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-ceramic-border rounded-[2px] p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="serif-heading text-[18px]">{title}</h3>
          <p className="text-[12px] text-ceramic-ash mt-1">{subtitle}</p>
        </div>
        <Icon size={18} className="text-ceramic-ash" />
      </div>
      {children}
    </div>
  );
}
function Skeleton() { return <div className="h-48 animate-pulse bg-ceramic-cream rounded-[2px]" />; }

/** 时间序列柱状图（垂直） */
function BarsTimeSeries({ data, color, valueLabel }: { data: TimeSeriesPoint[]; color: string; valueLabel: string }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div>
      <div className="h-48 flex items-end gap-[2px] overflow-x-auto pb-2">
        {data.map((d, i) => {
          const h = (d.count / max) * 100;
          return (
            <div key={i} className="relative flex flex-col items-center shrink-0 group min-w-[18px] flex-1">
              <div
                className={`w-full rounded-t ${color} transition-all`}
                style={{ height: `${h}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                title={`${d.date} · ${d.count} ${valueLabel}`}
              />
              <span className="text-[9px] text-ceramic-ash mt-1 opacity-0 group-hover:opacity-100 whitespace-nowrap absolute -bottom-5 z-10 bg-white border border-ceramic-border rounded px-1">
                {d.count}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between text-[11px] text-ceramic-ash">
        <span>Start: {data[0]?.date}</span>
        <span className="font-semibold text-ceramic-graphite">
          Total: {data.reduce((s, d) => s + d.count, 0)} {valueLabel}
        </span>
        <span>End: {data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

/** 订单 + 收入 双轴图（count + amount） */
function RevenueBars({ data }: { data: RevenuePoint[] }) {
  const maxCount = Math.max(1, ...data.map(d => d.count));
  const maxAmt = Math.max(1, ...data.map(d => d.amount));
  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const totalAmt = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div>
      <div className="h-48 flex items-end gap-[2px] overflow-x-auto pb-2">
        {data.map((d, i) => (
          <div key={i} className="relative flex flex-col items-end shrink-0 min-w-[22px] flex-1 h-full justify-end gap-[2px]">
            <div
              className="w-full rounded-t bg-emerald-500"
              style={{ height: `${(d.amount / maxAmt) * 60}%`, minHeight: d.amount > 0 ? '3px' : '0' }}
              title={`${d.date} · Amount $${d.amount.toLocaleString()}`}
            />
            <div
              className="w-full rounded-t bg-ceramic-gold-matte"
              style={{ height: `${(d.count / maxCount) * 40}%`, minHeight: d.count > 0 ? '3px' : '0' }}
              title={`${d.date} · ${d.count} orders`}
            />
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px]">
        <LegendDot color="bg-emerald-500" label={`Revenue: $${totalAmt.toLocaleString()}`} />
        <LegendDot color="bg-ceramic-gold-matte" label={`Orders: ${totalCount}`} />
        <span className="ml-auto text-ceramic-ash">{data[0]?.date} — {data[data.length-1]?.date}</span>
      </div>
    </div>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ceramic-graphite font-semibold">
      <span className={`inline-block w-3 h-3 rounded-sm ${color}`} /> {label}
    </span>
  );
}

/** 水平百分比条形图（Source / Country） */
function HBarPercent({ data, paletteCountry = false }: { data: Array<{ label: string; value: number }>; paletteCountry?: boolean }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const palette = [
    'bg-ceramic-gold-matte','bg-emerald-500','bg-sky-500','bg-purple-500',
    'bg-rose-500','bg-amber-500','bg-indigo-500','bg-cyan-600','bg-pink-500','bg-slate-500',
  ];
  return (
    <div className="space-y-3">
      {data.slice(0, 10).map((d, i) => {
        const pct = (d.value / max) * 100;
        const share = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
        const color = paletteCountry ? palette[(d.label.charCodeAt(0) + i) % palette.length] : palette[i % palette.length];
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="text-ceramic-graphite font-medium truncate mr-3">{d.label || '(empty)'}</span>
              <span className="text-ceramic-ash shrink-0">{d.value} · {share}%</span>
            </div>
            <div className="h-5 bg-ceramic-cream/60 rounded-sm overflow-hidden">
              <div className={`h-full ${color} rounded-sm transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <div className="pt-2 text-[11px] text-ceramic-ash border-t border-ceramic-border/60">
        Total: <strong className="text-ceramic-graphite">{total}</strong> records
      </div>
    </div>
  );
}

/** 简单列表行（Recent 3 列） */
function RecentRows({ rows, titleKey, subKey, dateKey }: {
  rows: any[];
  titleKey: string[] | ((r: any) => string);
  subKey: string | ((r: any) => string);
  dateKey: string;
}) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        let title: string;
        if (typeof titleKey === 'function') title = titleKey(r) || '(untitled)';
        else title = titleKey.map(k => r[k]).find(Boolean) || '(untitled)';
        const sub = typeof subKey === 'function' ? subKey(r) : r[subKey];
        return (
          <div key={i} className="border-b border-ceramic-border/60 pb-3 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-[13px] text-ceramic-graphite line-clamp-1">{title}</span>
              <span className="text-[11px] text-ceramic-ash shrink-0">{r[dateKey] ? new Date(r[dateKey]).toLocaleDateString() : ''}</span>
            </div>
            {sub && <div className="text-[12px] text-ceramic-ash line-clamp-2 mt-1">{String(sub)}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default Dashboard;

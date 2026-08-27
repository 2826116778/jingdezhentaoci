/**
 * PHASE 2-B 海外客户开发中心 — Acquisition Analytics
 *
 * 路由: /console/analytics/acquisition
 *
 * 规范 §36-40：
 *   - Lead 来源 / 国家 / 行业 / 客户类型 / 开发数量 / 回复 / 询盘 / 成交
 *   - §37 漏斗：Imported → Qualified → Contacted → Replied → Interested → Inquiry → Customer → Order + 转化率
 *   - §38 国家分析：Leads / Qualified / Contacted / Replies / Inquiry / Orders
 *   - §39 渠道分析：Lead数量 / 有效Lead / 回复率 / 询盘率 / 订单率
 *   - §40 来源质量评分：告诉业务员哪个渠道转化质量更高（不只看 Lead 数量）
 *
 * 后端：GET /console/development/analytics
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, TrendingUp, Globe2, Target, Users2 } from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleAcquisitionAnalytics, LeadFunnel } from '../../../types';

const FUNNEL_STAGES: { key: keyof LeadFunnel; label: string; cls: string }[] = [
  { key: 'imported',   label: 'Imported',   cls: 'bg-slate-500' },
  { key: 'qualified',  label: 'Qualified',  cls: 'bg-cyan-600' },
  { key: 'contacted',  label: 'Contacted',  cls: 'bg-indigo-600' },
  { key: 'replied',    label: 'Replied',    cls: 'bg-sky-600' },
  { key: 'interested', label: 'Interested', cls: 'bg-purple-600' },
  { key: 'inquiry',    label: 'Inquiry',    cls: 'bg-amber-600' },
  { key: 'converted',  label: 'Customer',   cls: 'bg-emerald-600' },
  { key: 'lost',       label: 'Lost',       cls: 'bg-red-600' },
];

const AcquisitionAnalytics: React.FC = () => {
  const { showToast } = useApp();
  const [data, setData] = useState<ConsoleAcquisitionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await Console.Development.acquisitionAnalytics());
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Failed to load analytics' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  const funnel = data?.funnel;
  const funnelStages = useMemo(() => {
    if (!funnel) return [];
    return FUNNEL_STAGES.map((s) => ({ ...s, value: (funnel as any)[s.key] as number }));
  }, [funnel]);
  const maxFunnel = Math.max(1, ...funnelStages.map((s) => s.value));

  // Source quality ranking：根据 replyRate + inquiryRate + orderRate 综合
  const sourceQuality = useMemo(() => {
    if (!data?.bySource) return [];
    return data.bySource.map((s) => {
      const score = (s.replyRate || 0) * 0.3 + (s.inquiryRate || 0) * 0.3 + (s.orderRate || 0) * 0.4;
      return { ...s, qualityScore: Math.round(score) };
    }).sort((a, b) => b.qualityScore - a.qualityScore);
  }, [data]);

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto" data-testid="acquisition-analytics">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="serif-heading text-[26px] flex items-center gap-2"><BarChart3 size={22} /> Acquisition Analytics</h1>
          <p className="text-ceramic-ash text-[13px] mt-1">
            Funnel from imported leads to orders. Source quality ranking — tells you which channel converts best, not just volume (§40).
          </p>
        </div>
        <button onClick={load} className="btn-gold-outline !px-4 !py-2 text-[12px]"><RefreshCw size={13} className="inline mr-1" /> Refresh</button>
      </header>

      {loading ? (
        <div className="bg-white border border-ceramic-border rounded-sm p-12 text-center text-ceramic-ash text-[13px]">Loading analytics…</div>
      ) : !data ? (
        <div className="bg-white border border-ceramic-border rounded-sm p-12 text-center text-ceramic-ash text-[13px]">No data available.</div>
      ) : (
        <>
          {/* ===== Funnel ===== */}
          <section className="mb-10">
            <h2 className="serif-heading text-[20px] mb-3 flex items-center gap-2"><TrendingUp size={16} /> Development Funnel (§37)</h2>
            <div className="bg-white border border-ceramic-border rounded-sm p-6">
              <div className="space-y-2.5">
                {funnelStages.map((s) => {
                  const prevValue = funnelStages[0]?.value || 1;
                  const convFromImported = prevValue ? Math.round((s.value / prevValue) * 100) : 0;
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <div className="w-[100px] text-[12px] text-ceramic-graphite/80 text-right shrink-0">{s.label}</div>
                      <div className="flex-1 h-8 bg-ceramic-cream/40 rounded-[2px] overflow-hidden relative">
                        <div
                          className={`h-full ${s.cls} flex items-center px-3 text-[12px] text-white font-medium transition-all`}
                          style={{ width: `${Math.max(6, (s.value / maxFunnel) * 100)}%` }}
                        >
                          {s.value}
                        </div>
                      </div>
                      <div className="w-[80px] text-[11px] text-ceramic-ash text-right shrink-0">
                        {s.key === 'imported' ? '' : `${convFromImported}% from imported`}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-ceramic-border text-[13px]">
                <strong className="text-emerald-700">{funnel?.converted || 0}</strong> customers converted
                · overall conversion rate <strong className="text-ceramic-gold-matte">{data.funnel?.conversionRate?.toFixed(1) || 0}%</strong>
              </div>
            </div>
          </section>

          {/* ===== Source Quality (§40) ===== */}
          <section className="mb-10">
            <h2 className="serif-heading text-[20px] mb-3 flex items-center gap-2"><Target size={16} /> Source Quality Ranking (§39/40)</h2>
            <div className="bg-white border border-ceramic-border rounded-sm overflow-x-auto">
              <table className="min-w-[920px] w-full text-[13px]">
                <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
                  <tr className="text-left text-[10px] tracking-luxury uppercase text-ceramic-ash">
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Leads</th>
                    <th className="px-3 py-3">Contacted</th>
                    <th className="px-3 py-3">Replies</th>
                    <th className="px-3 py-3">Inquiry</th>
                    <th className="px-3 py-3">Converted</th>
                    <th className="px-3 py-3">Reply %</th>
                    <th className="px-3 py-3">Inquiry %</th>
                    <th className="px-3 py-3">Order %</th>
                    <th className="px-3 py-3">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceQuality.length === 0 ? (
                    <tr><td colSpan={10} className="px-3 py-10 text-center text-ceramic-ash">No source data yet.</td></tr>
                  ) : sourceQuality.map((s) => {
                    const q = s.qualityScore || 0;
                    const qCls = q >= 20 ? 'text-emerald-700' : q >= 10 ? 'text-amber-700' : 'text-slate-500';
                    return (
                      <tr key={s.source} className="border-b border-ceramic-border last:border-0 hover:bg-ceramic-cream/30">
                        <td className="px-3 py-3 font-medium capitalize">{s.source || 'unknown'}</td>
                        <td className="px-3 py-3">{s.leads}</td>
                        <td className="px-3 py-3">{s.contacted}</td>
                        <td className="px-3 py-3">{s.replied}</td>
                        <td className="px-3 py-3">{s.inquiry}</td>
                        <td className="px-3 py-3 text-emerald-700 font-medium">{s.converted}</td>
                        <td className="px-3 py-3">{(s.replyRate || 0).toFixed(1)}%</td>
                        <td className="px-3 py-3">{(s.inquiryRate || 0).toFixed(1)}%</td>
                        <td className="px-3 py-3">{(s.orderRate || 0).toFixed(1)}%</td>
                        <td className={`px-3 py-3 font-bold ${qCls}`}>{q}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[11px] text-ceramic-ash">
              Quality = 0.3·Reply% + 0.3·Inquiry% + 0.4·Order%. A lower-volume channel with higher reply/inquiry rates
              ranks higher in quality (§40 — LinkedIn vs CSV example).
            </div>
          </section>

          {/* ===== By Campaign ===== */}
          <section className="mb-10">
            <h2 className="serif-heading text-[20px] mb-3 flex items-center gap-2"><Target size={16} /> Campaign Performance</h2>
            <div className="bg-white border border-ceramic-border rounded-sm overflow-x-auto">
              <table className="min-w-[920px] w-full text-[13px]">
                <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
                  <tr className="text-left text-[10px] tracking-luxury uppercase text-ceramic-ash">
                    <th className="px-3 py-3">Campaign</th>
                    <th className="px-3 py-3">Leads</th>
                    <th className="px-3 py-3">Qualified</th>
                    <th className="px-3 py-3">Contacted</th>
                    <th className="px-3 py-3">Replies</th>
                    <th className="px-3 py-3">Inquiry</th>
                    <th className="px-3 py-3">Converted</th>
                    <th className="px-3 py-3">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.byCampaign?.length ? (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-ceramic-ash">No campaign data yet.</td></tr>
                  ) : data.byCampaign.map((c) => (
                    <tr key={c.campaignId} className="border-b border-ceramic-border last:border-0 hover:bg-ceramic-cream/30">
                      <td className="px-3 py-3 font-medium">{c.campaignName || String(c.campaignId).slice(-6)}</td>
                      <td className="px-3 py-3">{c.leads}</td>
                      <td className="px-3 py-3 text-cyan-700">{c.qualified}</td>
                      <td className="px-3 py-3 text-indigo-700">{c.contacted}</td>
                      <td className="px-3 py-3 text-sky-700">{c.replied}</td>
                      <td className="px-3 py-3 text-amber-700">{c.inquiry}</td>
                      <td className="px-3 py-3 text-emerald-700 font-medium">{c.converted}</td>
                      <td className="px-3 py-3 font-medium">{(c.conversionRate || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ===== By Country (§38) ===== */}
          <section>
            <h2 className="serif-heading text-[20px] mb-3 flex items-center gap-2"><Globe2 size={16} /> Country Performance (§38)</h2>
            <div className="bg-white border border-ceramic-border rounded-sm overflow-x-auto">
              <table className="min-w-[820px] w-full text-[13px]">
                <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
                  <tr className="text-left text-[10px] tracking-luxury uppercase text-ceramic-ash">
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">Leads</th>
                    <th className="px-3 py-3">Qualified</th>
                    <th className="px-3 py-3">Contacted</th>
                    <th className="px-3 py-3">Replies</th>
                    <th className="px-3 py-3">Inquiry</th>
                    <th className="px-3 py-3">Orders</th>
                    <th className="px-3 py-3">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.byCountry?.length ? (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-ceramic-ash">No country data yet.</td></tr>
                  ) : data.byCountry.map((c) => (
                    <tr key={c.country} className="border-b border-ceramic-border last:border-0 hover:bg-ceramic-cream/30">
                      <td className="px-3 py-3 font-medium">{c.country || 'unknown'}</td>
                      <td className="px-3 py-3">{c.leads}</td>
                      <td className="px-3 py-3 text-cyan-700">{c.qualified}</td>
                      <td className="px-3 py-3 text-indigo-700">{c.contacted}</td>
                      <td className="px-3 py-3 text-sky-700">{c.replied}</td>
                      <td className="px-3 py-3 text-amber-700">{c.inquiry}</td>
                      <td className="px-3 py-3 text-emerald-700 font-medium">{c.converted}</td>
                      <td className="px-3 py-3 font-medium">{(c.conversionRate || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AcquisitionAnalytics;

/**
 * PHASE 3-A AI Customer Development Center — 客户开发工作台
 *
 * 路径：/console/ai/development
 *
 * 组成：
 *   - 顶部 KPI 条（总数 / 待研究 / 待联系 / 已成交）
 *   - Lead Development Table（搜索/筛选/排序/分页）
 *     · 筛选：devStatus / AI Score / Market(country) / Owner
 *     · 列：公司 / 联系人 / 国家 / devStatus / AI Score / Grade / Owner / 操作
 *
 * 数据来源：Console.AI.Development.list / detail
 * 设计系统：保持 PHASE 1/2 的 ceramic-* 色板与 serif-heading 标题。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { Console } from '../../../api/console';
import type { ConsoleLead, DevStatus } from '../../../types';
import {
  Search, Filter, Loader2, ChevronRight, ArrowUp, ArrowDown, Users2, Sparkles,
} from 'lucide-react';

const DEV_STATUS_LABEL: Record<DevStatus, string> = {
  NEW: 'New', RESEARCHING: 'Researching', RESEARCHED: 'Researched',
  QUALIFIED: 'Qualified', CONTACT_READY: 'Contact Ready', CONTACTED: 'Contacted',
  REPLIED: 'Replied', FOLLOW_UP: 'Follow-up', QUALIFIED_OPPORTUNITY: 'Qualified Opp.',
  QUOTE_READY: 'Quote Ready', WON: 'Won', LOST: 'Lost',
};

const DEV_STATUS_COLOR: Record<DevStatus, string> = {
  NEW: 'bg-ceramic-cream text-ceramic-graphite border-ceramic-border',
  RESEARCHING: 'bg-blue-50 text-blue-700 border-blue-200',
  RESEARCHED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  QUALIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CONTACT_READY: 'bg-amber-50 text-amber-700 border-amber-200',
  CONTACTED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  REPLIED: 'bg-violet-50 text-violet-700 border-violet-200',
  FOLLOW_UP: 'bg-orange-50 text-orange-700 border-orange-200',
  QUALIFIED_OPPORTUNITY: 'bg-teal-50 text-teal-700 border-teal-200',
  QUOTE_READY: 'bg-rose-50 text-rose-700 border-rose-200',
  WON: 'bg-emerald-600 text-white border-emerald-700',
  LOST: 'bg-rose-600 text-white border-rose-700',
};

const DevelopmentDashboard: React.FC = () => {
  const { showToast } = useApp();
  const nav = useNavigate();

  // 列表参数
  const [params, setParams] = useState({
    page: 1, pageSize: 20, search: '', devStatus: '', country: '',
    ownerId: '', minScore: '', maxScore: '', sort: 'createdAt', order: 'desc' as 'asc' | 'desc',
  });
  const [data, setData] = useState<{ items: ConsoleLead[]; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // KPI
  const [kpis, setKpis] = useState<{ total: number; researching: number; contactReady: number; won: number }>({
    total: 0, researching: 0, contactReady: 0, won: 0,
  });

  const fetchList = async () => {
    setLoading(true); setError('');
    try {
      const filter: any = { page: params.page, pageSize: params.pageSize, sort: params.sort, order: params.order };
      if (params.search) filter.search = params.search;
      if (params.devStatus) filter.devStatus = params.devStatus;
      if (params.country) filter.country = params.country;
      if (params.ownerId) filter.ownerId = params.ownerId;
      if (params.minScore) filter.minScore = Number(params.minScore);
      if (params.maxScore) filter.maxScore = Number(params.maxScore);
      const res = await Console.AI.Development.list(filter);
      const d = (res as any)?.data ?? res;
      setData({ items: d.items || [], total: d.total || 0, totalPages: d.totalPages || 0 });
      // 简单 KPI：从当前结果估算（避免额外接口）
      const items = d.items || [];
      setKpis({
        total: d.total || items.length,
        researching: items.filter((x: ConsoleLead) => x.devStatus === 'RESEARCHING' || x.devStatus === 'RESEARCHED').length,
        contactReady: items.filter((x: ConsoleLead) => x.devStatus === 'CONTACT_READY' || x.devStatus === 'CONTACTED').length,
        won: items.filter((x: ConsoleLead) => x.devStatus === 'WON').length,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load development leads');
      showToast({ type: 'error', text: e?.message || 'Failed to load development leads' });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [params.page, params.pageSize, params.devStatus, params.country, params.ownerId, params.minScore, params.maxScore, params.sort, params.order]);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); setParams(p => ({ ...p, page: 1 })); fetchList(); };
  const onReset = () => setParams({
    page: 1, pageSize: 20, search: '', devStatus: '', country: '',
    ownerId: '', minScore: '', maxScore: '', sort: 'createdAt', order: 'desc',
  });
  const toggleSort = (col: string) => setParams(p => ({
    ...p, sort: col, order: p.sort === col && p.order === 'desc' ? 'asc' : 'desc', page: 1,
  }));

  const SortIcon = ({ col }: { col: string }) => {
    if (params.sort !== col) return <ArrowUp className="w-3 h-3 opacity-30" />;
    return params.order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const countries = useMemo(() => {
    const set = new Set<string>();
    data?.items.forEach((l) => { if (l.country) set.add(l.country); });
    return Array.from(set).sort();
  }, [data]);

  return (
    <div className="space-y-6">
      {/* ===== 标题 ===== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="serif-heading text-[24px] md:text-[28px] flex items-center gap-2">
            <Sparkles size={20} className="text-ceramic-gold-matte" />
            AI Customer Development Center
          </div>
          <p className="text-[12px] text-ceramic-ash mt-1">
            PHASE 3-A · Lead → Research → Qualification → Product Match → Strategy → Message → Approve → Contact
          </p>
        </div>
        <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">
          State machine + human review · AI never auto-sends
        </div>
      </div>

      {/* ===== KPI ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Leads" value={kpis.total} icon={<Users2 size={16} />} accent="bg-ceramic-gold-matte/10" />
        <KpiCard label="In Research" value={kpis.researching} icon={<Sparkles size={16} />} accent="bg-blue-50" />
        <KpiCard label="Contact Ready" value={kpis.contactReady} icon={<ChevronRight size={16} />} accent="bg-amber-50" />
        <KpiCard label="Won" value={kpis.won} icon={<Sparkles size={16} />} accent="bg-emerald-50" />
      </div>

      {/* ===== 筛选 ===== */}
      <form onSubmit={onSearch} className="bg-white border border-ceramic-border rounded-[2px] p-4 space-y-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ceramic-graphite">
          <Filter size={15} className="text-ceramic-ash" /> Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-[11px] text-ceramic-ash mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-ceramic-ash" />
              <input
                type="search" value={params.search} onChange={(e) => setParams(p => ({ ...p, search: e.target.value }))}
                placeholder="Company / contact / email"
                className="w-full h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border ps-9 pe-3 text-[13px] focus:border-ceramic-gold-matte focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-ceramic-ash mb-1">Dev Status</label>
            <select
              value={params.devStatus} onChange={(e) => setParams(p => ({ ...p, devStatus: e.target.value, page: 1 }))}
              className="w-full h-9 rounded-[2px] bg-white border border-ceramic-border px-2 text-[13px] focus:border-ceramic-gold-matte focus:outline-none"
            >
              <option value="">All</option>
              {Object.keys(DEV_STATUS_LABEL).map((s) => (
                <option key={s} value={s}>{DEV_STATUS_LABEL[s as DevStatus]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-ceramic-ash mb-1">Country</label>
            <select
              value={params.country} onChange={(e) => setParams(p => ({ ...p, country: e.target.value, page: 1 }))}
              className="w-full h-9 rounded-[2px] bg-white border border-ceramic-border px-2 text-[13px] focus:border-ceramic-gold-matte focus:outline-none"
            >
              <option value="">All</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-ceramic-ash mb-1">Min Score</label>
            <input
              type="number" min={0} max={100} value={params.minScore}
              onChange={(e) => setParams(p => ({ ...p, minScore: e.target.value, page: 1 }))}
              className="w-full h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-2 text-[13px] focus:border-ceramic-gold-matte focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-ceramic-ash mb-1">Max Score</label>
            <input
              type="number" min={0} max={100} value={params.maxScore}
              onChange={(e) => setParams(p => ({ ...p, maxScore: e.target.value, page: 1 }))}
              className="w-full h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-2 text-[13px] focus:border-ceramic-gold-matte focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="h-9 px-4 rounded-[2px] bg-ceramic-gold-matte text-white text-[13px] hover:opacity-90">Apply</button>
          <button type="button" onClick={onReset} className="h-9 px-4 rounded-[2px] border border-ceramic-border text-[13px] text-ceramic-graphite hover:bg-ceramic-cream/60">Reset</button>
        </div>
      </form>

      {/* ===== 表格 ===== */}
      <div className="bg-white border border-ceramic-border rounded-[2px] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-ceramic-gold-matte animate-spin" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-600 text-[13px]">{error}</div>
        ) : data && data.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-ceramic-cream/60 border-b border-ceramic-border text-ceramic-ash">
                <tr>
                  <Th onClick={() => toggleSort('companyName')}><span className="flex items-center gap-1">Company <SortIcon col="companyName" /></span></Th>
                  <Th>Contact</Th>
                  <Th>Country</Th>
                  <Th onClick={() => toggleSort('devStatus')}><span className="flex items-center gap-1">Dev Status <SortIcon col="devStatus" /></span></Th>
                  <Th onClick={() => toggleSort('score')}><span className="flex items-center gap-1">AI Score <SortIcon col="score" /></span></Th>
                  <Th>Grade</Th>
                  <Th>Owner</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((l, i) => (
                  <tr key={l._id || i} className="border-b border-ceramic-border hover:bg-ceramic-cream/30">
                    <td className="px-4 py-3">
                      <Link to={`/console/ai/development/${l._id}`} className="font-medium text-ceramic-graphite hover:text-ceramic-gold-matte">
                        {l.companyName}
                      </Link>
                      {l.website && <div className="text-[11px] text-ceramic-ash truncate">{l.website}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div>{l.contactName || '—'}</div>
                      {l.jobTitle && <div className="text-[11px] text-ceramic-ash">{l.jobTitle}</div>}
                    </td>
                    <td className="px-4 py-3">{l.country || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-[2px] border ${DEV_STATUS_COLOR[(l.devStatus as DevStatus) || 'NEW']}`}>
                        {DEV_STATUS_LABEL[(l.devStatus as DevStatus) || 'NEW']}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{l.score ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex w-7 h-7 items-center justify-center rounded-full text-[11px] font-bold
                        bg-ceramic-gold-matte/10 text-ceramic-gold-matte">{l.grade || 'C'}</span>
                    </td>
                    <td className="px-4 py-3 text-ceramic-ash">{(l as any).ownerId || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => nav(`/console/ai/development/${l._id}`)}
                        className="text-[12px] text-ceramic-gold-matte hover:underline flex items-center gap-1"
                      >
                        Open <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-ceramic-ash text-[13px]">
            No development leads yet.<br />
            <span className="text-[11px]">Import leads first via Lead Import, then trigger AI research from the detail page.</span>
          </div>
        )}

        {/* 分页 */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ceramic-border text-[12px]">
            <div className="text-ceramic-ash">Total {data.total} · Page {params.page} / {data.totalPages}</div>
            <div className="flex gap-2">
              <button
                disabled={params.page <= 1}
                onClick={() => setParams(p => ({ ...p, page: p.page - 1 }))}
                className="h-8 px-3 rounded-[2px] border border-ceramic-border disabled:opacity-40 hover:bg-ceramic-cream/60"
              >Prev</button>
              <button
                disabled={params.page >= data.totalPages}
                onClick={() => setParams(p => ({ ...p, page: p.page + 1 }))}
                className="h-8 px-3 rounded-[2px] border border-ceramic-border disabled:opacity-40 hover:bg-ceramic-cream/60"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: number; icon: React.ReactNode; accent: string }> = ({ label, value, icon, accent }) => (
  <div className="bg-white border border-ceramic-border rounded-[2px] p-4 flex items-center gap-3">
    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${accent} text-ceramic-gold-matte`}>{icon}</div>
    <div>
      <div className="text-[11px] text-ceramic-ash uppercase tracking-luxury">{label}</div>
      <div className="text-[20px] font-semibold text-ceramic-graphite leading-none mt-1">{value}</div>
    </div>
  </div>
);

const Th: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <th onClick={onClick} className={`px-4 py-2.5 text-start font-medium text-[11px] uppercase tracking-luxury ${onClick ? 'cursor-pointer hover:text-ceramic-graphite' : ''}`}>
    {children}
  </th>
);

export default DevelopmentDashboard;

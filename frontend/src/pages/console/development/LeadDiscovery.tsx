/**
 * PHASE 2-B 海外客户开发中心首页 — Lead Discovery
 *
 * 路由: /console/development
 *
 * 业务目标（来自 PHASE 2-B 规范）：
 *   找到潜在海外客户 → 导入系统 → 清洗 → 去重 → 筛选 → 评分 → 分级
 *   → 分配 → 创建开发任务 → 进入客户开发流程
 *
 * 本页内容：
 *   1. Hero: Overseas Customer Development
 *   2. Create Development Campaign (国家/城市/行业/客户类型/产品兴趣/目标数量/Owner/起止)
 *   3. 顶部统计 (Campaigns / Imports / Leads / Tasks / Funnel)
 *   4. 最近 Campaigns 列表（含漏斗 imported → converted）
 *   5. 快捷入口：Lead Import / Prospect Lists / Lead Scoring / Dev Tasks / Analytics
 *
 * 数据来自后端：
 *   - GET /console/development/overview
 *   - GET /console/development/campaigns
 *   - POST /console/development/campaigns
 *   - GET /console/development/markets  (统一配置)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass, Plus, X, Upload, ListChecks, Gauge, Target, BarChart3,
  Globe2, MapPin, Building2, Briefcase, Package, Users, CalendarDays, Star,
} from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type {
  ConsoleLeadCampaign, ConsoleDevelopmentOverview, LeadFunnel,
} from '../../../types';
import {
  TARGET_INDUSTRIES, TARGET_COMPANY_TYPES, PRODUCT_INTERESTS,
  DEFAULT_COUNTRIES, loadMarkets, getMarkets, getCitiesOfCountry,
  CAMPAIGN_STATUSES,
} from '../../../utils/leadConfig';

const FUNNEL_KEYS: { key: keyof LeadFunnel; label: string; cls: string }[] = [
  { key: 'imported',   label: 'Imported',   cls: 'bg-slate-100 text-slate-700' },
  { key: 'qualified',  label: 'Qualified',  cls: 'bg-cyan-50 text-cyan-700' },
  { key: 'contacted',  label: 'Contacted',  cls: 'bg-indigo-50 text-indigo-700' },
  { key: 'replied',    label: 'Replied',    cls: 'bg-sky-50 text-sky-700' },
  { key: 'interested', label: 'Interested', cls: 'bg-purple-50 text-purple-700' },
  { key: 'inquiry',    label: 'Inquiry',    cls: 'bg-amber-50 text-amber-700' },
  { key: 'converted',  label: 'Converted',  cls: 'bg-emerald-50 text-emerald-700' },
  { key: 'lost',       label: 'Lost',       cls: 'bg-red-50 text-red-700' },
];

const LeadDiscovery: React.FC = () => {
  const { showToast } = useApp();
  const nav = useNavigate();

  const [overview, setOverview] = useState<ConsoleDevelopmentOverview | null>(null);
  const [campaigns, setCampaigns] = useState<ConsoleLeadCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      await loadMarkets(); // 国家/城市/优先级 DB 配置
      const [ov, camp] = await Promise.all([
        Console.Development.overview(),
        Console.Development.listCampaigns({ page: 1, pageSize: 10, sort: 'createdAt', order: 'desc' } as any),
      ]);
      setOverview(ov);
      setCampaigns(camp?.items || []);
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Failed to load overview' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  const funnel = overview?.funnel;
  const funnelEntries = useMemo(() => {
    if (!funnel) return [];
    return FUNNEL_KEYS.map(({ key, label, cls }) => {
      const value = (funnel as any)[key] as number;
      return { key, label, value, cls };
    });
  }, [funnel]);
  const maxFunnel = Math.max(1, ...funnelEntries.map((f) => f.value));

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto" data-testid="lead-discovery">
      {/* ===== Hero ===== */}
      <div className="bg-gradient-to-br from-ceramic-gold-matte/10 via-ceramic-cream/40 to-white border border-ceramic-border rounded-sm px-6 md:px-10 py-8 md:py-12 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-[2px] bg-gradient-to-br from-ceramic-gold-matte to-[#A67C2A] flex items-center justify-center shadow-gold-sm shrink-0">
            <Compass size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="serif-heading text-[28px] md:text-[34px] leading-tight">Overseas Customer Development</h1>
            <p className="text-ceramic-ash text-[14px] md:text-[15px] mt-2 max-w-2xl">
              Find, qualify and develop overseas ceramic buyers. Build targeted campaigns,
              import prospect lists, score leads 0–100, grade A/B/C/D, assign sales reps,
              and convert into paying customers.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="hidden md:inline-flex items-center gap-2 btn-gold !px-5 !py-2.5 text-[13px] shrink-0"
          >
            <Plus size={15} /> Create Campaign
          </button>
        </div>
      </div>

      {/* ===== Top Stats ===== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <StatCard label="Campaigns" value={overview?.totalCampaigns ?? 0} sub={`active ${overview?.activeCampaigns ?? 0}`} Icon={Target} />
        <StatCard label="Imports" value={overview?.totalImports ?? 0} sub="total files" Icon={Upload} />
        <StatCard label="Total Leads" value={overview?.totalLeads ?? 0} sub="all campaigns" Icon={Users} />
        <StatCard label="Dev Tasks" value={overview?.totalDevTasks ?? 0} sub="in progress" Icon={ListChecks} />
        <StatCard label="Converted" value={funnel?.converted ?? 0} sub={`from ${funnel?.imported ?? 0} imported`} Icon={Star} accent />
      </div>

      {/* ===== Funnel ===== */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="serif-heading text-[20px]">Development Funnel</h2>
          <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash">Imported → Customer</span>
        </div>
        <div className="bg-white border border-ceramic-border rounded-sm p-5 md:p-6">
          {loading ? (
            <div className="text-[13px] text-ceramic-ash">Loading…</div>
          ) : funnelEntries.length ? (
            <div className="space-y-2">
              {funnelEntries.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <div className="w-[88px] text-[12px] text-ceramic-graphite/80 text-right shrink-0">{f.label}</div>
                  <div className="flex-1 h-7 bg-ceramic-cream/60 rounded-[2px] overflow-hidden relative">
                    <div
                      className={`h-full ${f.cls} flex items-center px-2 text-[12px] font-medium transition-all`}
                      style={{ width: `${Math.max(8, (f.value / maxFunnel) * 100)}%` }}
                    >
                      {f.value || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-ceramic-ash">No data yet. Create a campaign and import leads.</div>
          )}
        </div>
      </section>

      {/* ===== Quick Entries ===== */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
        <QuickEntry Icon={Upload} label="Import Leads" desc="CSV / Excel" onClick={() => nav('/console/leads/import')} />
        <QuickEntry Icon={ListChecks} label="Prospect Lists" desc="by country / source" onClick={() => nav('/console/leads/lists')} />
        <QuickEntry Icon={Gauge} label="Lead Scoring" desc="0-100 + A/B/C/D" onClick={() => nav('/console/leads/scoring')} />
        <QuickEntry Icon={Target} label="Dev Tasks" desc="assign + funnel" onClick={() => nav('/console/development/tasks')} />
        <QuickEntry Icon={BarChart3} label="Analytics" desc="source quality" onClick={() => nav('/console/analytics/acquisition')} />
      </section>

      {/* ===== Recent Campaigns ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="serif-heading text-[20px]">Recent Campaigns</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 text-[12px] tracking-luxury uppercase text-ceramic-gold-matte hover:underline"
          >
            <Plus size={13} /> New Campaign
          </button>
        </div>
        <div className="bg-white border border-ceramic-border rounded-sm overflow-x-auto">
          <table className="min-w-[820px] w-full text-[13px]">
            <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
              <tr className="text-left text-[11px] tracking-luxury uppercase text-ceramic-ash">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Countries</th>
                <th className="px-4 py-3">Industries</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Funnel</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ceramic-ash">
                    No campaigns yet. <button onClick={() => setShowCreate(true)} className="text-ceramic-gold-matte hover:underline">Create your first one →</button>
                  </td>
                </tr>
              ) : campaigns.map((c) => (
                <CampaignRow key={String(c._id)} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && (
        <CampaignCreateModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            showToast({ type: 'success', text: 'Campaign created' });
            load();
          }}
        />
      )}
    </div>
  );
};

// ----- Stat Card -----
const StatCard: React.FC<{ label: string; value: number; sub: string; Icon: React.ElementType; accent?: boolean }> =
({ label, value, sub, Icon, accent }) => (
  <div className={`bg-white border rounded-sm px-4 py-4 ${accent ? 'border-ceramic-gold-matte/50 bg-ceramic-gold-matte/5' : 'border-ceramic-border'}`}>
    <div className="flex items-center gap-2 text-[11px] tracking-luxury uppercase text-ceramic-ash mb-2">
      <Icon size={13} /> {label}
    </div>
    <div className="text-[24px] serif-heading leading-none">{value}</div>
    <div className="text-[11px] text-ceramic-ash mt-1">{sub}</div>
  </div>
);

// ----- Quick Entry -----
const QuickEntry: React.FC<{ Icon: React.ElementType; label: string; desc: string; onClick: () => void }> =
({ Icon, label, desc, onClick }) => (
  <button
    onClick={onClick}
    className="bg-white border border-ceramic-border rounded-sm px-4 py-4 text-left hover:border-ceramic-gold-matte/60 hover:shadow-gold-sm transition-all group"
  >
    <div className="flex items-center gap-2 mb-2 text-ceramic-gold-matte">
      <Icon size={16} />
      <span className="text-[14px] font-medium text-ceramic-graphite group-hover:text-ceramic-gold-matte">{label}</span>
    </div>
    <div className="text-[11px] text-ceramic-ash">{desc}</div>
  </button>
);

// ----- Campaign Row -----
const CampaignRow: React.FC<{ c: ConsoleLeadCampaign }> = ({ c }) => {
  const pct = c.targetLeadCount > 0 ? Math.min(100, Math.round((c.actualLeadCount / c.targetLeadCount) * 100)) : 0;
  const funnel = c.funnel || { imported: c.imported || 0, qualified: c.qualified || 0, contacted: c.contacted || 0, replied: c.replied || 0, interested: c.interested || 0, inquiry: c.inquiry || 0, converted: c.converted || 0, lost: c.lost || 0 };
  const statusCls: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PAUSED: 'bg-amber-50 text-amber-700 border-amber-200',
    COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200',
    ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <tr className="border-b border-ceramic-border last:border-0 hover:bg-ceramic-cream/30">
      <td className="px-4 py-3">
        <div className="font-medium text-ceramic-graphite">{c.name}</div>
        {c.description && <div className="text-[11px] text-ceramic-ash line-clamp-1">{c.description}</div>}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {(c.countries || []).slice(0, 3).map((cc) => (
            <span key={cc} className="px-1.5 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[11px]">{cc}</span>
          ))}
          {(c.countries || []).length > 3 && <span className="text-[11px] text-ceramic-ash">+{c.countries.length - 3}</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-[12px]">{(c.industries || []).slice(0, 2).join(', ') || '—'}</td>
      <td className="px-4 py-3 text-[12px]">{(c.productInterests || []).slice(0, 2).join(', ') || '—'}</td>
      <td className="px-4 py-3">
        <div className="text-[12px] text-ceramic-graphite">{c.actualLeadCount || 0} / {c.targetLeadCount || 0}</div>
        <div className="h-1.5 bg-ceramic-cream rounded-full overflow-hidden mt-1 w-[80px]">
          <div className="h-full bg-ceramic-gold-matte" style={{ width: `${pct}%` }} />
        </div>
      </td>
      <td className="px-4 py-3 text-[11px] text-ceramic-ash">
        {funnel.imported} → {funnel.qualified} → {funnel.contacted} → {funnel.replied} → {funnel.inquiry} → <span className="text-emerald-700 font-medium">{funnel.converted}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${statusCls[c.status] || ''}`}>{c.status}</span>
      </td>
    </tr>
  );
};

// 将任意日期值转为 <input type="date"> 需要的 YYYY-MM-DD 字符串（使用本地时区，避免 UTC 偏移）
function toDateInput(d?: string | Date | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ----- Campaign Create Modal -----
const CampaignCreateModal: React.FC<{ onClose: () => void; onSaved: (c: ConsoleLeadCampaign) => void }> = ({ onClose, onSaved }) => {
  const { showToast } = useApp();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ConsoleLeadCampaign>>({
    name: '', description: '',
    countries: [], cities: [],
    industries: [], companyTypes: [],
    productInterests: [],
    targetLeadCount: 50,
    status: 'DRAFT',
  });

  useEffect(() => { loadMarkets(); }, []);
  const markets = getMarkets();
  const countryOptions = markets.length ? markets : DEFAULT_COUNTRIES.map((c) => ({ countryCode: c.code, countryName: c.name, cities: [], priority: 50 }));
  const cityOptions = (form.countries || []).flatMap((code: string) => {
    const m = markets.find((mk) => mk.countryCode === code);
    return (m?.cities || getCitiesOfCountry(code)).map((city) => `${code}::${city}`);
  });

  const set = <K extends keyof ConsoleLeadCampaign>(k: K, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggleArr = (k: 'countries' | 'cities' | 'industries' | 'companyTypes' | 'productInterests', value: string) => {
    setForm((f) => {
      const arr = (f[k] as string[]) || [];
      return { ...f, [k]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return showToast({ type: 'error', text: 'Campaign Name is required' });
    if (!(form.countries || []).length) return showToast({ type: 'error', text: 'Select at least one country' });
    setSaving(true);
    try {
      const created = await Console.Development.createCampaign(form);
      onSaved(created);
    } catch (err: any) {
      showToast({ type: 'error', text: err?.message || 'Create failed' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-4xl shadow-xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <h3 className="serif-heading text-[22px]">Create Development Campaign</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* 基本信息 */}
          <Section title="Campaign Information" Icon={Target}>
            <Grid cols={1}>
              <FieldText label="Campaign Name *" value={form.name || ''} onChange={(v) => set('name', v)} placeholder="e.g. Dubai Hotel Ceramic Buyers 2026" required />
            </Grid>
            <Grid cols={1}>
              <FieldText label="Description" value={form.description || ''} onChange={(v) => set('description', v)} placeholder="Target, positioning, expected outcome..." />
            </Grid>
          </Section>

          {/* 目标市场 */}
          <Section title="Target Market" Icon={Globe2}>
            <ChipGroup
              label="Target Country *"
              selected={form.countries || []}
              options={countryOptions.map((c: any) => ({ label: c.countryName, value: c.countryCode }))}
              onToggle={(v) => toggleArr('countries', v)}
            />
            {cityOptions.length > 0 && (
              <ChipGroup
                label="Target Cities"
                selected={form.cities || []}
                options={cityOptions.map((c) => ({ label: c.split('::')[1], value: c }))}
                onToggle={(v) => toggleArr('cities', v)}
              />
            )}
          </Section>

          {/* 行业 + 客户类型 */}
          <Section title="Industry & Company Type" Icon={Briefcase}>
            <ChipGroup
              label="Industry"
              selected={form.industries || []}
              options={TARGET_INDUSTRIES.map((i) => ({ label: i, value: i }))}
              onToggle={(v) => toggleArr('industries', v)}
            />
            <ChipGroup
              label="Company Type"
              selected={form.companyTypes || []}
              options={TARGET_COMPANY_TYPES.map((i) => ({ label: i, value: i }))}
              onToggle={(v) => toggleArr('companyTypes', v)}
            />
          </Section>

          {/* 产品兴趣 */}
          <Section title="Product Interest" Icon={Package}>
            <ChipGroup
              label="Products"
              selected={form.productInterests || []}
              options={PRODUCT_INTERESTS.map((i) => ({ label: i, value: i }))}
              onToggle={(v) => toggleArr('productInterests', v)}
            />
          </Section>

          {/* Owner + 数量 + 状态 + 起止 */}
          <Section title="Targets & Schedule" Icon={CalendarDays}>
            <Grid>
              <FieldNumber label="Target Lead Count" value={form.targetLeadCount ?? 50} onChange={(v) => set('targetLeadCount', v)} />
              <SelectField label="Status" value={form.status || 'DRAFT'} onChange={(v) => set('status', v as any)} options={[...CAMPAIGN_STATUSES]} />
              <FieldDate label="Start Date" value={toDateInput(form.startDate)} onChange={(v) => set('startDate', v || undefined)} />
              <FieldDate label="End Date" value={toDateInput(form.endDate)} onChange={(v) => set('endDate', v || undefined)} />
            </Grid>
          </Section>

          <div className="flex justify-end gap-3 pt-4 border-t border-ceramic-border sticky bottom-0 bg-white -mx-5 -mb-5 p-5">
            <button type="button" onClick={onClose} className="btn-gold-outline !px-6" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-gold !px-6" disabled={saving}>{saving ? 'Creating…' : 'Create Campaign'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ====== 内部 UI 小组件 ======
function Section({ title, Icon, children }: { title: string; Icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-[12px] tracking-luxury uppercase text-ceramic-gold-matte mb-3 font-semibold">
        <Icon size={13} /> {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  const cls = cols === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2';
  return <div className={`grid gap-3 ${cls}`}>{children}</div>;
}
function FieldText({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      <input className="input-gold text-[13px]" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function FieldNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}</span>
      <input type="number" min={0} className="input-gold text-[13px]" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
  );
}
function FieldDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}</span>
      <input type="date" className="input-gold text-[13px]" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}</span>
      <select className="input-gold text-[13px]" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function ChipGroup({ label, selected, options, onToggle }: {
  label: string; selected: string[]; options: { label: string; value: string }[]; onToggle: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[12px] text-ceramic-ash mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={`px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                on ? 'bg-ceramic-gold-matte text-white border-ceramic-gold-matte' : 'bg-white text-ceramic-graphite/80 border-ceramic-border hover:border-ceramic-gold-matte/50'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default LeadDiscovery;

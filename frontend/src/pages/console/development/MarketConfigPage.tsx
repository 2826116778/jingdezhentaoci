/**
 * PHASE 2-B 海外客户开发中心 — Market Config (DB-driven, not hardcoded)
 *
 * 路由: /console/development/markets
 *
 * 规范 §6, §7, §22：
 *   - Country 不写死在组件，统一 MarketConfig 表
 *   - 城市多选 (UAE: Dubai/Abu Dhabi/Sharjah; SA: Riyadh/Jeddah/Dammam...)
 *   - 国家优先级 0-100 (UAE=100, SA=95, QA=90, USA=85, UK=80...)
 *   - §23 默认产品推荐 (Hotel → Hotelware/Dinnerware/Coffee/Tea/Custom)
 *
 * 后端：GET/POST/PATCH /console/development/markets
 */
import React, { useEffect, useState } from 'react';
import { Globe2, Plus, X, RefreshCw, Edit2, Star, MapPin, Package } from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleMarketConfig } from '../../../types';
import { PRODUCT_INTERESTS, DEFAULT_COUNTRIES } from '../../../utils/leadConfig';

const MarketConfigPage: React.FC = () => {
  const { showToast } = useApp();
  const [markets, setMarkets] = useState<ConsoleMarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<ConsoleMarketConfig | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await Console.Development.listMarkets();
      setMarkets(Array.isArray(list) ? list : []);
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Failed to load markets' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto" data-testid="market-config">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="serif-heading text-[26px] flex items-center gap-2"><Globe2 size={22} /> Market Configuration</h1>
          <p className="text-ceramic-ash text-[13px] mt-1">DB-driven country priority, cities, and default product recommendations. §22 No hardcoding.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-gold-outline !px-4 !py-2 text-[12px]"><RefreshCw size={13} className="inline mr-1" /> Refresh</button>
          <button onClick={() => { setEdit(null); setShowCreate(true); }} className="btn-gold !px-4 !py-2 text-[12px]"><Plus size={13} className="inline mr-1" /> Add Market</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12 text-ceramic-ash text-[13px]">Loading markets…</div>
        ) : markets.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12">
            <Globe2 size={36} className="mx-auto text-ceramic-ash mb-3" />
            <div className="text-ceramic-ash text-[13px] mb-3">No markets configured.</div>
            <button onClick={() => { setEdit(null); setShowCreate(true); }} className="btn-gold !px-5 inline-flex items-center gap-2"><Plus size={13} /> Add First Market</button>
          </div>
        ) : markets.map((m) => (
          <MarketCard key={String(m._id)} m={m} onEdit={() => { setEdit(m); setShowCreate(true); }} />
        ))}
      </div>

      {showCreate && (
        <MarketModal initial={edit} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); showToast({ type: 'success', text: 'Market saved' }); load(); }} />
      )}
    </div>
  );
};

const MarketCard: React.FC<{ m: ConsoleMarketConfig; onEdit: () => void }> = ({ m, onEdit }) => {
  const priority = m.priority ?? 50;
  const priorityCls = priority >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : priority >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-slate-600 bg-slate-50 border-slate-200';
  return (
    <div className="bg-white border border-ceramic-border rounded-sm p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-[2px] bg-ceramic-cream flex items-center justify-center">
            <Globe2 size={16} className="text-ceramic-gold-matte" />
          </div>
          <div>
            <div className="font-medium text-ceramic-graphite text-[15px]">{m.countryName}</div>
            <div className="text-[11px] text-ceramic-ash font-mono">{m.countryCode}</div>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] border font-bold ${priorityCls}`}>P{priority}</span>
      </div>

      <div className="space-y-2 text-[12px]">
        <div className="flex items-start gap-2">
          <MapPin size={13} className="text-ceramic-ash mt-0.5 shrink-0" />
          <div>
            <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash mb-1">Cities</div>
            <div className="flex flex-wrap gap-1">
              {(m.cities || []).length === 0 && <span className="text-ceramic-ash">—</span>}
              {(m.cities || []).map((c) => (
                <span key={c} className="px-1.5 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[11px]">{c}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Package size={13} className="text-ceramic-ash mt-0.5 shrink-0" />
          <div>
            <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash mb-1">Default Products</div>
            <div className="flex flex-wrap gap-1">
              {(m.defaultProductInterests || []).length === 0 && <span className="text-ceramic-ash">—</span>}
              {(m.defaultProductInterests || []).map((p) => (
                <span key={p} className="px-1.5 py-0.5 rounded-full bg-ceramic-gold-matte/10 border border-ceramic-gold-matte/30 text-[11px] text-ceramic-gold-matte">{p}</span>
              ))}
            </div>
          </div>
        </div>

        {m.notes && (
          <div className="text-[12px] text-ceramic-ash pt-2 border-t border-ceramic-border">{m.notes}</div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-ceramic-border flex items-center justify-between">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${m.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
          {m.isActive ? 'Active' : 'Inactive'}
        </span>
        <button onClick={onEdit} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-ceramic-gold-matte hover:underline"><Edit2 size={12} /> Edit</button>
      </div>
    </div>
  );
};

const MarketModal: React.FC<{ initial: ConsoleMarketConfig | null; onClose: () => void; onSaved: () => void }> = ({ initial, onClose, onSaved }) => {
  const { showToast } = useApp();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ConsoleMarketConfig>>({
    countryCode: '', countryName: '', priority: 50, isActive: true,
    cities: [], defaultProductInterests: [], notes: '',
  });
  useEffect(() => {
    if (initial) setForm({ ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const set = <K extends keyof ConsoleMarketConfig>(k: K, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggleCity = (c: string) => set('cities', toggleArr(form.cities as string[] || [], c));
  const toggleProduct = (p: string) => set('defaultProductInterests', toggleArr(form.defaultProductInterests as string[] || [], p));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.countryCode?.trim()) return showToast({ type: 'error', text: 'Country code is required' });
    if (!form.countryName?.trim()) return showToast({ type: 'error', text: 'Country name is required' });
    setSaving(true);
    try {
      if (initial?._id) {
        await Console.Development.updateMarket(String(initial._id), form);
      } else {
        await Console.Development.createMarket(form);
      }
      onSaved();
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Save failed' });
    } finally { setSaving(false); }
  };

  const cityInput = (form.cities as string[]).join(', ');
  const onCityInput = (v: string) => {
    const arr = v.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
    set('cities', arr);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-2xl shadow-xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <h3 className="serif-heading text-[20px]">{initial?._id ? 'Edit Market' : 'Add Market'}</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Country Code *</span>
              <select className="input-gold text-[13px]" value={form.countryCode || ''} onChange={(e) => {
                const code = e.target.value;
                const match = DEFAULT_COUNTRIES.find((c) => c.code === code);
                set('countryCode', code);
                if (match && !form.countryName) set('countryName', match.name);
              }}>
                <option value="">—</option>
                {DEFAULT_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash md:col-span-2">
              <span>Country Name *</span>
              <input className="input-gold text-[13px]" value={form.countryName || ''} onChange={(e) => set('countryName', e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Priority (0-100) — §22</span>
              <input type="number" min={0} max={100} className="input-gold text-[13px]" value={form.priority ?? 50} onChange={(e) => set('priority', Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
              <span className="text-[10px] text-ceramic-ash">Higher = more important market. Used in Lead score (§22).</span>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Active</span>
              <select className="input-gold text-[13px]" value={form.isActive ? 'true' : 'false'} onChange={(e) => set('isActive', e.target.value === 'true')}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Cities (comma separated)</span>
            <input className="input-gold text-[13px]" value={cityInput} onChange={(e) => onCityInput(e.target.value)} placeholder="Dubai, Abu Dhabi, Sharjah" />
          </label>
          <div>
            <div className="text-[12px] text-ceramic-ash mb-2">Default Product Recommendations (§23 — Industry=Hotel → recommend Hotelware etc.)</div>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_INTERESTS.map((p) => {
                const on = (form.defaultProductInterests as string[] || []).includes(p);
                return (
                  <button key={p} type="button" onClick={() => toggleProduct(p)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] ${
                      on ? 'bg-ceramic-gold-matte text-white border-ceramic-gold-matte' : 'bg-white text-ceramic-graphite/80 border-ceramic-border'
                    }`}>{p}</button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Notes</span>
            <textarea className="input-gold text-[13px]" rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Market characteristics, entry strategy..." />
          </label>
          <div className="flex justify-end gap-3 pt-3 border-t border-ceramic-border sticky bottom-0 bg-white -mx-5 -mb-5 p-5">
            <button type="button" onClick={onClose} className="btn-gold-outline !px-6" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-gold !px-6" disabled={saving}>{saving ? 'Saving…' : (initial?._id ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

function toggleArr(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default MarketConfigPage;

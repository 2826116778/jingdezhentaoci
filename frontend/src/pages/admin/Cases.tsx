import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Pencil, Trash2, Search, X, Upload, Save, Loader2, FolderKanban, Check, Image as ImageIcon
} from 'lucide-react';
import { Admin } from '../../api';
import { useApp } from '../../context/AppContext';
import type { Case } from '../../types';
import { pickBilingual } from '../../utils';

type F = Omit<Partial<Case>, '_id'> & { _id?: string };

const INIT: F = {
  nameEn: '', nameAr: '',
  category: 'hotel',
  clientNameEn: '', clientNameAr: '',
  locationEn: '', locationAr: '',
  year: new Date().getFullYear(),
  coverImage: '',
  images: [],
  descEn: '', descAr: '',
  scopeEn: '', scopeAr: '',
  isPublished: true, sort: 0,
};

const CATS = [
  { v: 'hotel',      label: 'Hotel' },
  { v: 'villa',      label: 'Villa' },
  { v: 'commercial', label: 'Commercial' },
];

const AdminCases: React.FC = () => {
  const { t } = useTranslation();
  const { lang, showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Case[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<F>({ ...INIT });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setList(await Admin.listCases({ limit: 200 }) || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const fq = q.trim().toLowerCase();
    return list
      .filter(c => cat === 'all' ? true : c.category === cat)
      .filter(c => !fq
        || c.nameEn.toLowerCase().includes(fq)
        || (c.nameAr || '').includes(q)
        || String(c.year).includes(fq));
  }, [list, q, cat]);

  const openNew = () => { setForm({ ...INIT }); setOpen(true); };
  const openEdit = (c: Case) => { setForm({ ...c }); setOpen(true); };

  const del = async (id: string) => {
    setDeleting(id);
    try {
      await Admin.deleteCase(id);
      setList(list.filter(c => c._id !== id));
      showToast({ type: 'success', text: t('admin.common.del_ok') });
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setDeleting(null); }
  };

  const submit = async () => {
    if (!form.nameEn) { showToast({ type: 'error', text: 'English name required' }); return; }
    if (!form.coverImage) { showToast({ type: 'error', text: 'Cover image required' }); return; }
    setSaving(true);
    try {
      if (form._id) {
        const r = await Admin.updateCase(form._id, form as any);
        setList(list.map(c => c._id === r._id ? r : c));
      } else {
        const r = await Admin.createCase(form as any);
        setList([r, ...list]);
      }
      setOpen(false);
      showToast({ type: 'success', text: form._id ? t('admin.common.update_ok') : t('admin.common.create_ok') });
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setSaving(false); }
  };

  const uploadOne = async (files: FileList | File[], key: 'coverImage' | 'images') => {
    const arr = Array.isArray(files) ? files : Array.from(files);
    const urls: string[] = [];
    for (const f of arr) {
      try { urls.push(await Admin.uploadImage(f)); }
      catch (e: any) { showToast({ type: 'error', text: `${f.name}: ${e.message || String(e)}` }); }
    }
    if (key === 'coverImage') {
      setForm(f => ({ ...f, coverImage: urls[0] || f.coverImage }));
    } else {
      setForm(f => ({ ...f, images: [...(f.images || []), ...urls] }));
    }
  };
  const removeGallery = (idx: number) => setForm(f => ({ ...f, images: (f.images || []).filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="serif-heading text-[28px] mb-1">{t('admin.cases.title')}</h2>
          <p className="text-ceramic-ash text-sm flex items-center gap-2"><FolderKanban size={14} /> {list.length} items</p>
        </div>
        <button className="btn-gold !py-2.5 !px-5 text-[13px]" onClick={openNew}><Plus size={15} /> {t('admin.cases.new')}</button>
      </div>

      <div className="gold-card p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-ceramic-ash" />
          <input className="input !ps-10" placeholder="Project / Client / Year..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="all">All</option>
          {CATS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && [...Array(6)].map((_, i) => <div key={i} className="gold-card aspect-[4/3] animate-pulse" />)}
        {!loading && filtered.length === 0 && <div className="col-span-full gold-card p-10 text-center text-ceramic-ash">{t('admin.common.no_data')}</div>}
        {!loading && filtered.map(c => (
          <div key={c._id} className="gold-card overflow-hidden group">
            <div className="relative aspect-[4/3] overflow-hidden">
              <img src={c.coverImage} alt="" className="w-full h-full object-cover transition-transform duration-[1500ms] group-hover:scale-110" loading="lazy" />
              <div className="absolute top-3 start-3">
                {c.isPublished
                  ? <span className="badge bg-emerald-500/90 text-white"><Check size={11} /> Live</span>
                  : <span className="badge bg-zinc-300/90 text-zinc-700">Draft</span>}
              </div>
              <div className="absolute top-3 end-3">
                <span className="badge bg-ceramic-gold-matte/90 text-white">
                  {CATS.find(x => x.v === c.category)?.label || c.category}
                </span>
              </div>
            </div>
            <div className="p-5">
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-1">{c.year} · {lang === 'ar' ? c.locationAr : c.locationEn}</div>
              <h4 className="serif-heading text-[20px] leading-snug mb-2">{pickBilingual(c, lang)}</h4>
              <div className="text-[12px] text-ceramic-ash mb-4">
                {lang === 'ar' ? c.clientNameAr : c.clientNameEn}
              </div>
              <div className="flex gap-2">
                <button className="btn-gold-outline !py-1.5 !px-3 text-[12px] flex-1 justify-center" onClick={() => openEdit(c)}>
                  <Pencil size={12} /> {t('admin.common.edit')}
                </button>
                <button className="btn-gold-outline !py-1.5 !px-3 !text-rose-600 !border-rose-200 hover:!bg-rose-50"
                  disabled={deleting === c._id} onClick={() => del(c._id)}>
                  {deleting === c._id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm p-4 md:p-8 flex items-start md:items-center justify-center overflow-y-auto animate-fade-in">
          <div className="bg-ceramic-cream w-full max-w-5xl my-auto gold-card overflow-hidden">
            <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-ceramic-border sticky top-0 bg-white/90 backdrop-blur z-10">
              <h3 className="serif-heading text-[22px]">{form._id ? t('admin.cases.edit_title') : t('admin.cases.new_title')}</h3>
              <button className="p-2" onClick={() => setOpen(false)}><X size={20} /></button>
            </div>
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="label mb-1.5">Project Name EN</label><input className="input" value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} /></div>
              <div><label className="label mb-1.5">اسم المشروع AR</label><input className="input text-right" dir="rtl" value={form.nameAr || ''} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} /></div>
              <div><label className="label mb-1.5">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}>
                  {CATS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                </select>
              </div>
              <div><label className="label mb-1.5">Year</label><input type="number" className="input" value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} /></div>
              <div><label className="label mb-1.5">Client EN</label><input className="input" value={form.clientNameEn || ''} onChange={e => setForm(f => ({ ...f, clientNameEn: e.target.value }))} /></div>
              <div><label className="label mb-1.5">العميل AR</label><input className="input text-right" dir="rtl" value={form.clientNameAr || ''} onChange={e => setForm(f => ({ ...f, clientNameAr: e.target.value }))} /></div>
              <div><label className="label mb-1.5">Location EN</label><input className="input" value={form.locationEn || ''} onChange={e => setForm(f => ({ ...f, locationEn: e.target.value }))} /></div>
              <div><label className="label mb-1.5">الموقع AR</label><input className="input text-right" dir="rtl" value={form.locationAr || ''} onChange={e => setForm(f => ({ ...f, locationAr: e.target.value }))} /></div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="label mb-1.5">Overview EN</label>
                  <textarea className="input min-h-[140px]" value={form.descEn || ''} onChange={e => setForm(f => ({ ...f, descEn: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1.5">نظرة عامة AR</label>
                  <textarea className="input min-h-[140px] text-right" dir="rtl" value={form.descAr || ''} onChange={e => setForm(f => ({ ...f, descAr: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1.5">Scope EN</label>
                  <textarea className="input min-h-[140px]" value={form.scopeEn || ''} onChange={e => setForm(f => ({ ...f, scopeEn: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1.5">نطاق العمل AR</label>
                  <textarea className="input min-h-[140px] text-right" dir="rtl" value={form.scopeAr || ''} onChange={e => setForm(f => ({ ...f, scopeAr: e.target.value }))} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="label mb-0">Cover Image</label>
                  <label className="btn-gold-outline !py-2 cursor-pointer text-[12px]">
                    <Upload size={13} /> Upload
                    <input type="file" accept="image/*" hidden onChange={e => e.target.files && uploadOne(e.target.files, 'coverImage')} />
                  </label>
                </div>
                {form.coverImage
                  ? <div className="relative gold-card aspect-[16/9] overflow-hidden">
                      <img src={form.coverImage} className="w-full h-full object-cover" alt="" />
                    </div>
                  : <div className="gold-card aspect-[16/9] flex flex-col items-center justify-center text-ceramic-ash">
                      <ImageIcon size={34} className="mb-2" /> No cover yet
                    </div>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="label mb-0">Gallery ({form.images?.length || 0})</label>
                  <label className="btn-gold-outline !py-2 cursor-pointer text-[12px]">
                    <Upload size={13} /> Upload
                    <input type="file" accept="image/*" multiple hidden onChange={e => e.target.files && uploadOne(e.target.files, 'images')} />
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(form.images || []).map((src, i) => (
                    <div key={i} className="relative gold-card aspect-square overflow-hidden">
                      <img src={src} className="w-full h-full object-cover" alt="" loading="lazy" />
                      <button className="absolute top-1 end-1 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-rose-600 text-[11px]" onClick={() => removeGallery(i)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 flex items-center gap-4 justify-between border-t border-ceramic-border pt-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-ceramic-gold-matte" checked={!!form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
                  Published
                </label>
                <input type="number" className="input !w-32" placeholder="sort" value={form.sort || 0} onChange={e => setForm(f => ({ ...f, sort: +e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 md:px-8 py-5 border-t border-ceramic-border bg-ceramic-offWhite/60">
              <button className="btn-gold-outline" onClick={() => setOpen(false)}>{t('admin.common.cancel')}</button>
              <button className="btn-gold justify-center" onClick={submit} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? t('common.loading') : t('admin.common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCases;

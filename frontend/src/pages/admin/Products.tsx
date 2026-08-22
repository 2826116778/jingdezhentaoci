import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Pencil, Trash2, Search, X, Upload, Image as ImageIcon,
  Check, ArrowUpDown, Save, Loader2, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Admin } from '../../api';
import { useApp } from '../../context/AppContext';
import type { Product } from '../../types';
import { pickBilingual } from '../../utils';

type Form = Omit<Partial<Product>, '_id'> & { _id?: string };

const INIT: Form = {
  sku: '', nameEn: '', nameAr: '',
  category: 'tableware', material: 'porcelain',
  descEn: '', descAr: '', careEn: '', careAr: '',
  size: '', glazeColor: '',
  images: [], detailImages: [],
  moq: 100, priceMin: 10, priceMax: 100,
  isStock: true, isCustom: false, isPublished: true,
  sort: 0,
};

const CATEGORY_I18N: Record<string, string> = {
  tableware: 'Tableware', 'vase': 'Vases', 'art-sculpture': 'Art Sculptures',
  'hotel-ware': 'Hotel Ware', tiles: 'Tiles & Panels', 'oem-sample': 'OEM / Sample',
};

const AdminProducts: React.FC = () => {
  const { t } = useTranslation();
  const { lang, showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({ ...INIT });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await Admin.listProducts({ limit: 200 });
      setList(list || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const sorted = useMemo(() => {
    const fq = q.trim().toLowerCase();
    return list
      .filter(p => (filterCat === 'all' ? true : p.category === filterCat))
      .filter(p => !fq
        || p.sku.toLowerCase().includes(fq)
        || p.nameEn.toLowerCase().includes(fq)
        || (p.nameAr || '').includes(q)
      )
      .sort((a, b) => {
        const av: any = (a as any)[sortField];
        const bv: any = (b as any)[sortField];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
        return String(av || '').localeCompare(String(bv || ''), 'zh') * sortDir;
      });
  }, [list, q, filterCat, sortField, sortDir]);

  const openNew = () => { setForm({ ...INIT, images: [], detailImages: [] }); setOpen(true); };
  const openEdit = (p: Product) => { setForm({ ...p }); setOpen(true); };

  const del = async (id: string) => {
    setDeleting(id);
    try {
      await Admin.deleteProduct(id);
      setList(list.filter(p => p._id !== id));
      showToast({ type: 'success', text: t('admin.common.del_ok') });
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setDeleting(null); }
  };

  const submit = async () => {
    if (!form.sku || !form.nameEn) { showToast({ type: 'error', text: 'SKU & English name required' }); return; }
    if (form.images!.length === 0) { showToast({ type: 'error', text: 'At least 1 image' }); return; }
    setSaving(true);
    try {
      if (form._id) {
        const updated = await Admin.updateProduct(form._id, form as any);
        setList(list.map(p => p._id === updated._id ? updated : p));
        showToast({ type: 'success', text: t('admin.common.update_ok') });
      } else {
        const created = await Admin.createProduct(form as any);
        setList([created, ...list]);
        showToast({ type: 'success', text: t('admin.common.create_ok') });
      }
      setOpen(false);
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setSaving(false); }
  };

  // 图片上传（可拖/选多个）
  const upload = async (files: FileList | File[], target: 'images' | 'detailImages') => {
    const arr = Array.isArray(files) ? files : Array.from(files);
    const results: string[] = [];
    for (const f of arr) {
      try {
        const path = await Admin.uploadImage(f);
        results.push(path);
      } catch (e: any) { showToast({ type: 'error', text: `${f.name}: ${e.message || String(e)}` }); }
    }
    setForm(prev => ({ ...prev, [target]: [...(prev as any)[target], ...results] }));
  };

  const removeImg = (target: 'images' | 'detailImages', idx: number) => {
    setForm(prev => ({ ...prev, [target]: (prev as any)[target].filter((_: any, i: number) => i !== idx) }));
  };

  const setF = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggleF = (k: keyof Form) => setForm(f => ({ ...f, [k]: !(f as any)[k] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="serif-heading text-[28px] mb-1">{t('admin.products.title')}</h2>
          <p className="text-ceramic-ash text-sm">{list.length} {t('admin.products.total')}</p>
        </div>
        <button className="btn-gold !py-2.5 !px-5 text-[13px]" onClick={openNew}>
          <Plus size={15} /> {t('admin.products.new')}
        </button>
      </div>

      {/* 过滤 */}
      <div className="gold-card p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-ceramic-ash" />
          <input className="input !ps-10" placeholder="SKU / Name..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">{t('products.f_all')}</option>
          {Object.keys(CATEGORY_I18N).map(k => <option key={k} value={k}>{CATEGORY_I18N[k]}</option>)}
        </select>
        <button className="btn-gold-outline !py-2 !px-4 text-[12px]" onClick={() => { setSortField('priceMin'); setSortDir(d => (d === 1 ? -1 : 1) as 1 | -1); }}>
          <ArrowUpDown size={13} /> {t('admin.products.sort_price')}
        </button>
      </div>

      {/* 表 */}
      <div className="gold-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] tracking-luxury uppercase text-ceramic-ash bg-ceramic-offWhite/70">
                <th className="px-5 py-4 text-start w-[60px]">IMG</th>
                <th className="px-5 py-4 text-start">SKU · NAME</th>
                <th className="px-5 py-4 text-start">CAT</th>
                <th className="px-5 py-4 text-start">PRICE</th>
                <th className="px-5 py-4 text-start">MOQ</th>
                <th className="px-5 py-4 text-start">STATUS</th>
                <th className="px-5 py-4 text-end">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-10 text-center text-ceramic-ash">{t('common.loading')}</td></tr>}
              {!loading && sorted.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-ceramic-ash">{t('admin.common.no_data')}</td></tr>}
              {sorted.map(p => (
                <tr key={p._id} className="border-t border-ceramic-border/60 hover:bg-ceramic-offWhite/60">
                  <td className="px-5 py-3">
                    <img src={p.images?.[0]} className="w-11 h-11 object-cover rounded-sm gold-card" alt="" loading="lazy" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-mono text-[11px] text-ceramic-ash">{p.sku}</div>
                    <div className="text-[14px] mt-0.5">{pickBilingual(p, lang)}</div>
                  </td>
                  <td className="px-5 py-3 text-ceramic-ash">{CATEGORY_I18N[p.category] || p.category}</td>
                  <td className="px-5 py-3 serif-heading text-[15px] gold-text">${p.priceMin}-{p.priceMax}</td>
                  <td className="px-5 py-3 text-ceramic-graphite">{p.moq}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 text-[12px]">
                      {p.isPublished
                        ? <span className="badge bg-emerald-500/10 text-emerald-700"><Check size={11} /> Live</span>
                        : <span className="badge bg-zinc-200 text-zinc-700">Draft</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button className="btn-gold-outline !py-1.5 !px-3 text-[12px]" onClick={() => openEdit(p)}>
                        <Pencil size={12} /> {t('admin.common.edit')}
                      </button>
                      <button className="btn-gold-outline !py-1.5 !px-3 !border-rose-200 !text-rose-600 hover:!bg-rose-50"
                        onClick={() => del(p._id)}
                        disabled={deleting === p._id}>
                        {deleting === p._id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        {t('admin.common.del')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 编辑弹层 */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm p-4 md:p-8 flex items-start md:items-center justify-center overflow-y-auto animate-fade-in">
          <div className="bg-ceramic-cream w-full max-w-5xl my-auto gold-card overflow-hidden">
            <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-ceramic-border sticky top-0 bg-white/90 backdrop-blur z-10">
              <div>
                <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte">{form._id ? t('admin.products.edit_title') : t('admin.products.new')}</div>
                <h3 className="serif-heading text-[22px]">{form._id ? t('admin.products.edit_title') : t('admin.products.new_title')}</h3>
              </div>
              <button className="p-2 text-ceramic-ash hover:text-ceramic-graphite" onClick={() => setOpen(false)}><X size={20} /></button>
            </div>

            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="label mb-1.5">SKU *</label><input className="input" value={form.sku} onChange={e => setF('sku', e.target.value)} /></div>
              <div><label className="label mb-1.5">Category</label>
                <select className="input" value={form.category} onChange={e => setF('category', e.target.value as any)}>
                  {Object.keys(CATEGORY_I18N).map(k => <option key={k} value={k}>{CATEGORY_I18N[k]}</option>)}
                </select>
              </div>
              <div><label className="label mb-1.5">Name EN *</label><input className="input" value={form.nameEn} onChange={e => setF('nameEn', e.target.value)} /></div>
              <div><label className="label mb-1.5">اسم المنتج AR</label><input className="input text-right" dir="rtl" value={form.nameAr || ''} onChange={e => setF('nameAr', e.target.value)} /></div>
              <div><label className="label mb-1.5">Material</label>
                <select className="input" value={form.material} onChange={e => setF('material', e.target.value as any)}>
                  <option>porcelain</option><option>bone-china</option><option>stoneware</option><option>ceramic</option>
                </select>
              </div>
              <div><label className="label mb-1.5">Glaze Color / Finish</label><input className="input" value={form.glazeColor || ''} onChange={e => setF('glazeColor', e.target.value)} /></div>
              <div><label className="label mb-1.5">Size (L×W×H cm)</label><input className="input" value={form.size || ''} onChange={e => setF('size', e.target.value)} /></div>
              <div><label className="label mb-1.5">MOQ (pcs)</label><input type="number" className="input" value={form.moq} onChange={e => setF('moq', +e.target.value)} /></div>
              <div><label className="label mb-1.5">Price Min ($)</label><input type="number" className="input" value={form.priceMin} onChange={e => setF('priceMin', +e.target.value)} /></div>
              <div><label className="label mb-1.5">Price Max ($)</label><input type="number" className="input" value={form.priceMax} onChange={e => setF('priceMax', +e.target.value)} /></div>
              <div><label className="label mb-1.5">Sort (小前大后)</label><input type="number" className="input" value={form.sort || 0} onChange={e => setF('sort', +e.target.value)} /></div>
              <div className="flex items-end gap-4 pb-2">
                <button type="button" className="btn-gold-outline !py-2.5" onClick={() => toggleF('isPublished')}>
                  {form.isPublished ? <ToggleRight size={16} /> : <ToggleLeft size={16} />} {form.isPublished ? 'Published' : 'Draft'}
                </button>
                <button type="button" className="btn-gold-outline !py-2.5" onClick={() => toggleF('isStock')}>
                  {form.isStock ? <Check size={12} /> : null} Stock
                </button>
                <button type="button" className="btn-gold-outline !py-2.5" onClick={() => toggleF('isCustom')}>
                  {form.isCustom ? <Check size={12} /> : null} OEM
                </button>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="label mb-1.5">Description EN</label>
                  <textarea className="input min-h-[150px]" value={form.descEn || ''} onChange={e => setF('descEn', e.target.value)} />
                </div>
                <div>
                  <label className="label mb-1.5">وصف AR</label>
                  <textarea className="input min-h-[150px] text-right" dir="rtl" value={form.descAr || ''} onChange={e => setF('descAr', e.target.value)} />
                </div>
                <div>
                  <label className="label mb-1.5">Care Instructions EN</label>
                  <textarea className="input min-h-[120px]" value={form.careEn || ''} onChange={e => setF('careEn', e.target.value)} />
                </div>
                <div>
                  <label className="label mb-1.5">ملاحظات العناية AR</label>
                  <textarea className="input min-h-[120px] text-right" dir="rtl" value={form.careAr || ''} onChange={e => setF('careAr', e.target.value)} />
                </div>
              </div>

              {/* 图片 */}
              <div className="md:col-span-2 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="label mb-0">Main Images ({form.images?.length || 0})</label>
                    <label className="btn-gold-outline !py-2 cursor-pointer text-[12px]">
                      <Upload size={13} /> Upload
                      <input type="file" accept="image/*" multiple hidden
                        onChange={e => e.target.files && upload(e.target.files, 'images')} />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {(form.images || []).map((src, i) => (
                      <div key={i} className="relative gold-card aspect-square overflow-hidden group">
                        <img src={src} className="w-full h-full object-cover" alt="" loading="lazy" />
                        <button className="absolute top-1 end-1 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImg('images', i)}><X size={14} /></button>
                      </div>
                    ))}
                    {form.images!.length === 0 && (
                      <div className="col-span-full aspect-[5/2] border-2 border-dashed border-ceramic-border gold-card flex flex-col items-center justify-center text-ceramic-ash">
                        <ImageIcon size={28} className="mb-3" /> Drag & drop or click to upload
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="label mb-0">Detail Gallery Images ({form.detailImages?.length || 0})</label>
                    <label className="btn-gold-outline !py-2 cursor-pointer text-[12px]">
                      <Upload size={13} /> Upload
                      <input type="file" accept="image/*" multiple hidden
                        onChange={e => e.target.files && upload(e.target.files, 'detailImages')} />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {(form.detailImages || []).map((src, i) => (
                      <div key={i} className="relative gold-card aspect-square overflow-hidden group">
                        <img src={src} className="w-full h-full object-cover" alt="" loading="lazy" />
                        <button className="absolute top-1 end-1 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImg('detailImages', i)}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
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

export default AdminProducts;

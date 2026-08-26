/**
 * PHASE 2-A: Customer Create / Edit Modal
 */
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleCustomer } from '../../../types';

interface Props {
  open: boolean;
  initial?: ConsoleCustomer;
  onClose: () => void;
  onSaved: (c: ConsoleCustomer) => void;
}

const EMPTY: any = {
  company: '', website: '', country: '', industry: 'other',
  customerCode: '', customerLevel: 'PROSPECT', status: 'ACTIVE',
  source: 'manual', score: 50, tags: [], notes: '',
};

const CustomerFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const { showToast } = useApp();
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
  }, [initial, open]);

  if (!open) return null;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reqName = form.company || form.name;
    if (!reqName?.trim()) return showToast({ type: 'error', text: 'Company Name is required' });
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (typeof payload.tags === 'string') {
        payload.tags = (payload.tags as string).split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
      }
      let saved: ConsoleCustomer;
      if (initial?._id) {
        saved = await Console.updateCustomer(String(initial._id || initial.id), payload);
        showToast({ type: 'success', text: 'Customer updated' });
      } else {
        saved = await Console.createCustomer(payload);
        showToast({ type: 'success', text: 'Customer created' });
      }
      onSaved(saved);
    } catch (err: any) {
      showToast({ type: 'error', text: err?.message || 'Save failed' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-3xl shadow-xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <h3 className="serif-heading text-[22px]">{initial?._id ? 'Edit Customer' : 'Add Customer'}</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <h4 className="text-[12px] tracking-luxury uppercase text-ceramic-gold-matte font-semibold">Company</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FL label="Company Name *" value={form.company || form.name || ''} onChange={v => set('company', v)} required />
            <FL label="Website" value={form.website || ''} onChange={v => set('website', v)} placeholder="https://" />
            <FL label="Country" value={form.country || ''} onChange={v => set('country', v)} />
            <FS label="Industry" value={form.industry || 'other'} onChange={v => set('industry', v)} options={[
              'hospitality','residential','retail','ecommerce','construction','interior_design','food_beverage','luxury_goods','art_collectibles','government','education','other'
            ]} />
          </div>

          <h4 className="text-[12px] tracking-luxury uppercase text-ceramic-gold-matte font-semibold pt-2">Customer Profile</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FL label="Customer Code (auto)" value={form.customerCode || ''} onChange={v => set('customerCode', v)} placeholder="Leave empty to auto-generate" />
            <FS label="Customer Level" value={form.customerLevel || 'PROSPECT'} onChange={v => set('customerLevel', v)} options={['PLATINUM','GOLD','SILVER','BRONZE','PROSPECT']} />
            <FS label="Status" value={form.status || 'ACTIVE'} onChange={v => set('status', v)} options={['ACTIVE','PENDING','AT_RISK','INACTIVE','CHURNED']} />
            <FS label="Source" value={form.source || 'manual'} onChange={v => set('source', v)} options={[
              'website','manual','linkedin','google','instagram','alibaba','exhibition','referral','import','other','lead_converted'
            ]} />
            <FL label="Score (0-100)" value={String(form.score ?? 50)} onChange={v => set('score', Math.max(0, Math.min(100, Number(v) || 0)))} type="number" />
            <FL label="Tags (comma separated)" value={(form.tags || []).join(', ')} onChange={v => set('tags', v)} />
          </div>

          <h4 className="text-[12px] tracking-luxury uppercase text-ceramic-gold-matte font-semibold pt-2">Notes</h4>
          <textarea className="input-gold text-[13px] w-full" rows={3} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />

          <div className="flex justify-end gap-3 pt-4 border-t border-ceramic-border sticky bottom-0 bg-white -mx-5 -mb-5 p-5">
            <button type="button" onClick={onClose} className="btn-gold-outline !px-6" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-gold !px-6" disabled={saving}>{saving ? 'Saving...' : (initial?._id ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

function FL({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      <input type={type} className="input-gold text-[13px]" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function FS({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}</span>
      <select className="input-gold text-[13px]" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export default CustomerFormModal;

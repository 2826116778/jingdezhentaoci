/**
 * PHASE 2-A: Lead Create / Edit Modal（真实 CRUD）
 */
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleLead } from '../../../types';

interface Props {
  open: boolean;
  initial?: ConsoleLead;
  onClose: () => void;
  onSaved: (lead: ConsoleLead) => void;
}

const EMPTY: Partial<ConsoleLead> = {
  companyName: '', website: '', country: '', city: '', industry: 'other', companyType: '',
  contactName: '', jobTitle: '', email: '', phone: '', whatsapp: '', linkedin: '',
  source: 'manual', sourceUrl: '',
  productInterest: [], purchaseIntent: 'low', estimatedPurchaseVolume: '',
  score: 50, grade: 'C',
  status: 'NEW',
  tags: [], notes: '',
};

const LeadFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const { showToast } = useApp();
  const [form, setForm] = useState<Partial<ConsoleLead>>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
  }, [initial, open]);

  if (!open) return null;

  const set = <K extends keyof ConsoleLead>(k: K, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName?.trim()) return showToast({ type: 'error', text: 'Company Name is required' });
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (typeof payload.tags === 'string') {
        payload.tags = (payload.tags as string).split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
      }
      if (typeof payload.productInterest === 'string') {
        payload.productInterest = (payload.productInterest as string)
          .split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
      }
      let saved: ConsoleLead;
      if (initial?._id) {
        saved = await Console.updateLead(String(initial._id || initial.id), payload);
        showToast({ type: 'success', text: 'Lead updated' });
      } else {
        saved = await Console.createLead(payload);
        showToast({ type: 'success', text: 'Lead created' });
      }
      onSaved(saved);
    } catch (err: any) {
      showToast({ type: 'error', text: err?.message || 'Save failed' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-4xl shadow-xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <h3 className="serif-heading text-[22px]">{initial?._id ? 'Edit Lead' : 'Add Lead'}</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">
          <Section title="Company">
            <Grid>
              <Field label="Company Name *" value={form.companyName || ''} onChange={v => set('companyName', v)} required />
              <Field label="Website" value={form.website || ''} onChange={v => set('website', v)} placeholder="https://" />
              <Field label="Country" value={form.country || ''} onChange={v => set('country', v)} placeholder="UAE, Saudi Arabia..." />
              <Field label="City" value={form.city || ''} onChange={v => set('city', v)} />
              <Select label="Industry" value={form.industry || 'other'} onChange={v => set('industry', v)} options={[
                'hospitality','residential','retail','ecommerce','construction','interior_design','food_beverage','luxury_goods','art_collectibles','government','education','other'
              ]} />
              <Field label="Company Type" value={form.companyType || ''} onChange={v => set('companyType', v)} placeholder="Trading, Brand, Hotel Chain..." />
            </Grid>
          </Section>
          <Section title="Contact Person">
            <Grid>
              <Field label="Name" value={form.contactName || ''} onChange={v => set('contactName', v)} />
              <Field label="Job Title" value={form.jobTitle || ''} onChange={v => set('jobTitle', v)} />
              <Field label="Email" value={form.email || ''} onChange={v => set('email', v)} type="email" />
              <Field label="Phone" value={form.phone || ''} onChange={v => set('phone', v)} />
              <Field label="WhatsApp" value={form.whatsapp || ''} onChange={v => set('whatsapp', v)} />
              <Field label="LinkedIn" value={form.linkedin || ''} onChange={v => set('linkedin', v)} placeholder="https://linkedin.com/in/..." />
            </Grid>
          </Section>
          <Section title="Source & Intent">
            <Grid>
              <Select label="Source" value={form.source || 'manual'} onChange={v => set('source', v)} options={[
                'website','manual','linkedin','google','instagram','alibaba','exhibition','referral','import','other'
              ]} />
              <Field label="Source URL" value={form.sourceUrl || ''} onChange={v => set('sourceUrl', v)} />
              <Field label="Product Interest (comma separated)" value={(form.productInterest || []).join(', ')} onChange={v => set('productInterest', v)} placeholder="vase, hotel tableware, tiles..." />
              <Select label="Purchase Intent" value={form.purchaseIntent || 'low'} onChange={v => set('purchaseIntent', v as any)} options={['none','low','medium','high']} />
              <Field label="Estimated Purchase Volume" value={form.estimatedPurchaseVolume || ''} onChange={v => set('estimatedPurchaseVolume', v)} placeholder="e.g. 5000 pcs / $20k" />
            </Grid>
          </Section>
          <Section title="Qualification">
            <Grid>
              <Select label="Status" value={form.status || 'NEW'} onChange={v => set('status', v as any)} options={[
                'NEW','RESEARCHING','QUALIFIED','CONTACTED','REPLIED','INTERESTED','INQUIRY','CONVERTED','LOST'
              ]} />
              <Select label="Grade" value={form.grade || 'C'} onChange={v => set('grade', v as any)} options={['A','B','C','D']} />
              <Field label="Score (0-100)" value={String(form.score ?? 50)} onChange={v => set('score', Math.max(0, Math.min(100, Number(v) || 0)))} type="number" />
            </Grid>
          </Section>
          <Section title="Tags & Notes">
            <Grid cols={1}>
              <Field label="Tags (comma separated)" value={(form.tags || []).join(', ')} onChange={v => set('tags', v)} />
              <Textarea label="Notes" value={form.notes || ''} onChange={v => set('notes', v)} rows={3} />
            </Grid>
          </Section>
          <div className="flex justify-end gap-3 pt-4 border-t border-ceramic-border sticky bottom-0 bg-white -mx-5 -mb-5 p-5">
            <button type="button" onClick={onClose} className="btn-gold-outline !px-6" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-gold !px-6" disabled={saving}>{saving ? 'Saving...' : (initial?._id ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[12px] tracking-luxury uppercase text-ceramic-gold-matte mb-3 font-semibold">{title}</h4>
      {children}
    </div>
  );
}
function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  const cls = cols === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2';
  return <div className={`grid gap-3 ${cls}`}>{children}</div>;
}
function Field({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      <input
        type={type}
        className="input-gold text-[13px]"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}</span>
      <select className="input-gold text-[13px]" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function Textarea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}</span>
      <textarea className="input-gold text-[13px]" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default LeadFormModal;

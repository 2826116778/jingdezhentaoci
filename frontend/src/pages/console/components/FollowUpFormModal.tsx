/**
 * PHASE 2-A: FollowUp Form Modal (create / edit)
 */
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleFollowUp } from '../../../types';

interface Props {
  open: boolean;
  initial?: ConsoleFollowUp;
  defaultCustomerId?: string;
  defaultLeadId?: string;
  onClose: () => void;
  onSaved: (f: ConsoleFollowUp) => void;
}

const toDateInput = (d?: string) => {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const EMPTY: Partial<ConsoleFollowUp> = {
  type: 'EMAIL', content: '', result: '', nextAction: '',
  status: 'PENDING',
};

const FollowUpFormModal: React.FC<Props> = ({ open, initial, defaultCustomerId, defaultLeadId, onClose, onSaved }) => {
  const { showToast } = useApp();
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) setForm({ ...EMPTY, ...initial, scheduledAt: toDateInput(initial.scheduledAt), completedAt: toDateInput(initial.completedAt) });
    else setForm({ ...EMPTY, customerId: defaultCustomerId, leadId: defaultLeadId, scheduledAt: toDateInput(new Date(Date.now() + 86400000).toISOString()) });
  }, [initial, open, defaultCustomerId, defaultLeadId]);

  if (!open) return null;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let saved: ConsoleFollowUp;
      if (initial?._id) {
        saved = await Console.updateFollowUp(String(initial._id || initial.id), form);
        showToast({ type: 'success', text: 'Follow-up updated' });
      } else {
        saved = await Console.createFollowUp(form);
        showToast({ type: 'success', text: 'Follow-up created' });
      }
      onSaved(saved);
    } catch (err: any) {
      showToast({ type: 'error', text: err?.message || 'Save failed' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-xl shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <h3 className="serif-heading text-[20px]">{initial?._id ? 'Edit Follow-Up' : 'Log Follow-Up'}</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Sel label="Type" value={form.type || 'EMAIL'} onChange={v => set('type', v)} options={['EMAIL','WHATSAPP','PHONE','MEETING','SOCIAL','OTHER']} />
            <Sel label="Status" value={form.status || 'PENDING'} onChange={v => set('status', v)} options={['PENDING','COMPLETED','CANCELLED','OVERDUE']} />
            <FL label="Scheduled At" type="datetime-local" value={form.scheduledAt || ''} onChange={v => set('scheduledAt', v)} />
            <FL label="Completed At" type="datetime-local" value={form.completedAt || ''} onChange={v => set('completedAt', v)} />
          </div>
          <TA label="Content / Message" value={form.content || ''} onChange={v => set('content', v)} rows={3} />
          <TA label="Result" value={form.result || ''} onChange={v => set('result', v)} rows={2} />
          <FL label="Next Action" value={form.nextAction || ''} onChange={v => set('nextAction', v)} placeholder="What to do next?" />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-gold-outline !px-6" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-gold !px-6" disabled={saving}>{saving ? 'Saving...' : (initial?._id ? 'Update' : 'Save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

function FL({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}</span>
      <input type={type} className="input-gold text-[13px]" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Sel({ label, value, onChange, options }: {
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
function TA({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
      <span>{label}</span>
      <textarea className="input-gold text-[13px]" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default FollowUpFormModal;

/**
 * PHASE 2-A: Task Form Modal (create / edit)
 */
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleTask } from '../../../types';

interface Props {
  open: boolean;
  initial?: ConsoleTask;
  onClose: () => void;
  onSaved: (t: ConsoleTask) => void;
}

const toDateInput = (d?: string) => {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
};

const EMPTY: Partial<ConsoleTask> = {
  title: '', description: '', type: 'OTHER', priority: 'MEDIUM', status: 'TODO',
};

const TaskFormModal: React.FC<Props> = ({ open, initial, onClose, onSaved }) => {
  const { showToast } = useApp();
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) setForm({ ...EMPTY, ...initial, dueAt: toDateInput(initial.dueAt), completedAt: toDateInput(initial.completedAt) });
    else setForm({ ...EMPTY, dueAt: toDateInput(new Date(Date.now() + 3 * 86400000).toISOString()) });
  }, [initial, open]);

  if (!open) return null;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return showToast({ type: 'error', text: 'Title is required' });
    setSaving(true);
    try {
      let saved: ConsoleTask;
      if (initial?._id) {
        saved = await Console.updateTask(String(initial._id || initial.id), form);
        showToast({ type: 'success', text: 'Task updated' });
      } else {
        saved = await Console.createTask(form);
        showToast({ type: 'success', text: 'Task created' });
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
          <h3 className="serif-heading text-[20px]">{initial?._id ? 'Edit Task' : 'New Task'}</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <FL label="Title *" value={form.title || ''} onChange={v => set('title', v)} placeholder="What needs to be done?" />
          <TA label="Description" value={form.description || ''} onChange={v => set('description', v)} rows={3} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Sel label="Type" value={form.type || 'OTHER'} onChange={v => set('type', v)} options={['FOLLOW_UP','INQUIRY_REPLY','QUOTE_PREPARE','ORDER_FOLLOW','RESEARCH','MEETING','OTHER']} />
            <Sel label="Priority" value={form.priority || 'MEDIUM'} onChange={v => set('priority', v)} options={['URGENT','HIGH','MEDIUM','LOW']} />
            <Sel label="Status" value={form.status || 'TODO'} onChange={v => set('status', v)} options={['TODO','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED']} />
            <FL label="Due Date" type="date" value={form.dueAt || ''} onChange={v => set('dueAt', v)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-gold-outline !px-6" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-gold !px-6" disabled={saving}>{saving ? 'Saving...' : (initial?._id ? 'Update' : 'Create')}</button>
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

export default TaskFormModal;

/**
 * PHASE 2-B 海外客户开发中心 — Message Templates
 *
 * 路由: /console/development/templates
 *
 * 规范 §34-35：
 *   - First Contact / Follow-up 1 / Follow-up 2 / Inquiry Follow-up / Quote Follow-up
 *   - 支持 {{firstName}} / {{companyName}} / {{country}} / {{productName}} / {{salesName}}
 *   - Channel: EMAIL / WHATSAPP / LINKEDIN / OTHER
 *   - 字段：name / channel / language / subject / content / variables / status / createdBy
 *
 * 后端：/console/development/templates CRUD + /:id/preview
 */
import React, { useEffect, useState } from 'react';
import { FileText, Plus, X, RefreshCw, Trash2, Edit2, Eye, Mail, MessageCircle, Linkedin, Globe2 } from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleMessageTemplate } from '../../../types';
import { TEMPLATE_CHANNELS, TEMPLATE_VARIABLES } from '../../../utils/leadConfig';
import { useConsoleListPage } from '../../../components/console/ConsoleListPage';

const MessageTemplates: React.FC = () => {
  const { showToast } = useApp();
  const hook = useConsoleListPage<ConsoleMessageTemplate>((p) => Console.Development.listTemplates(p), { pageSize: 50, sort: 'createdAt', order: 'desc' } as any);
  const { loading, data, reload } = hook;
  const rows = data.items || [];
  const [edit, setEdit] = useState<ConsoleMessageTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [preview, setPreview] = useState<ConsoleMessageTemplate | null>(null);

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto" data-testid="message-templates">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="serif-heading text-[26px] flex items-center gap-2"><FileText size={22} /> Message Templates</h1>
          <p className="text-ceramic-ash text-[13px] mt-1">First contact / Follow-up / Inquiry / Quote templates. Variable support: {TEMPLATE_VARIABLES.join(', ')}.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => reload()} className="btn-gold-outline !px-4 !py-2 text-[12px]"><RefreshCw size={13} className="inline mr-1" /> Refresh</button>
          <button onClick={() => { setEdit(null); setShowCreate(true); }} className="btn-gold !px-4 !py-2 text-[12px]"><Plus size={13} className="inline mr-1" /> New Template</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12 text-ceramic-ash text-[13px]">Loading templates…</div>
        ) : rows.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12">
            <FileText size={36} className="mx-auto text-ceramic-ash mb-3" />
            <div className="text-ceramic-ash text-[13px] mb-3">No templates yet.</div>
            <button onClick={() => { setEdit(null); setShowCreate(true); }} className="btn-gold !px-5 inline-flex items-center gap-2"><Plus size={13} /> Create First Template</button>
          </div>
        ) : rows.map((t) => (
          <TemplateCard key={String(t._id)} t={t} onEdit={() => { setEdit(t); setShowCreate(true); }} onPreview={() => setPreview(t)} onDelete={async () => {
            if (!window.confirm(`Delete template "${t.name}"?`)) return;
            try {
              await Console.Development.deleteTemplate(String(t._id));
              showToast({ type: 'success', text: 'Template deleted' });
              reload();
            } catch (e: any) { showToast({ type: 'error', text: e?.message || 'Delete failed' }); }
          }} />
        ))}
      </div>

      {showCreate && (
        <TemplateModal
          initial={edit}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); showToast({ type: 'success', text: 'Saved' }); reload(); }}
        />
      )}

      {preview && (
        <PreviewModal template={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
};

const TemplateCard: React.FC<{ t: ConsoleMessageTemplate; onEdit: () => void; onPreview: () => void; onDelete: () => void }> =
({ t, onEdit, onPreview, onDelete }) => {
  const channelIcon: Record<string, React.ElementType> = {
    EMAIL: Mail, WHATSAPP: MessageCircle, LINKEDIN: Linkedin, OTHER: Globe2,
  };
  const Icon = channelIcon[t.channel] || FileText;
  return (
    <div className="bg-white border border-ceramic-border rounded-sm p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-[2px] bg-ceramic-cream flex items-center justify-center shrink-0">
            <Icon size={15} className="text-ceramic-gold-matte" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-ceramic-graphite truncate">{t.name}</div>
            <div className="text-[11px] text-ceramic-ash">{t.channel} · {t.language || 'en'}</div>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${t.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : t.status === 'DRAFT' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{t.status}</span>
      </div>
      {t.subject && <div className="text-[12px] font-medium text-ceramic-graphite mb-1 line-clamp-1">{t.subject}</div>}
      <div className="text-[12px] text-ceramic-ash line-clamp-3 flex-1">{t.content}</div>
      {t.variables?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {t.variables.map((v) => <span key={v} className="px-1.5 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[10px] font-mono">{v}</span>)}
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-ceramic-border flex items-center gap-2">
        <button onClick={onPreview} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-ceramic-gold-matte hover:underline"><Eye size={12} /> Preview</button>
        <button onClick={onEdit} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-ceramic-gold-matte hover:underline"><Edit2 size={12} /> Edit</button>
        <button onClick={onDelete} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-red-600 hover:underline ml-auto"><Trash2 size={12} /></button>
      </div>
    </div>
  );
};

const TemplateModal: React.FC<{ initial: ConsoleMessageTemplate | null; onClose: () => void; onSaved: (t: ConsoleMessageTemplate) => void }> =
({ initial, onClose, onSaved }) => {
  const { showToast } = useApp();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ConsoleMessageTemplate>>({
    name: '', channel: 'EMAIL', language: 'en', subject: '', content: '',
    variables: [], status: 'DRAFT',
  });
  useEffect(() => { setForm(initial ? { ...initial } : form); /* eslint-disable-line */ }, [initial]);

  const set = <K extends keyof ConsoleMessageTemplate>(k: K, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggleVar = (v: string) => setForm((f) => {
    const arr = (f.variables as string[]) || [];
    return { ...f, variables: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return showToast({ type: 'error', text: 'Name is required' });
    if (!form.content?.trim()) return showToast({ type: 'error', text: 'Content is required' });
    setSaving(true);
    try {
      let saved: ConsoleMessageTemplate;
      if (initial?._id) {
        saved = await Console.Development.updateTemplate(String(initial._id), form);
      } else {
        saved = await Console.Development.createTemplate(form);
      }
      onSaved(saved);
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Save failed' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-3xl shadow-xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <h3 className="serif-heading text-[20px]">{initial?._id ? 'Edit Template' : 'New Template'}</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Template Name *</span>
              <input className="input-gold text-[13px]" value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. First Contact - Hotel Buyer" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Channel</span>
              <select className="input-gold text-[13px]" value={form.channel || 'EMAIL'} onChange={(e) => set('channel', e.target.value as any)}>
                {TEMPLATE_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Language</span>
              <input className="input-gold text-[13px]" value={form.language || 'en'} onChange={(e) => set('language', e.target.value)} placeholder="en / ar / zh..." />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Status</span>
              <select className="input-gold text-[13px]" value={form.status || 'DRAFT'} onChange={(e) => set('status', e.target.value as any)}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Subject (for Email channel)</span>
            <input className="input-gold text-[13px]" value={form.subject || ''} onChange={(e) => set('subject', e.target.value)} placeholder="Subject line" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Content *</span>
            <textarea className="input-gold text-[13px] font-mono" rows={8} value={form.content || ''} onChange={(e) => set('content', e.target.value)} placeholder={`Dear {{firstName}},\n\nGreetings from LuxeCeramics. We noticed {{companyName}}...`} />
          </label>
          <div>
            <div className="text-[12px] text-ceramic-ash mb-2">Variables used in this template</div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => {
                const on = (form.variables || []).includes(v);
                return (
                  <button key={v} type="button" onClick={() => toggleVar(v)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-mono ${
                      on ? 'bg-ceramic-gold-matte text-white border-ceramic-gold-matte' : 'bg-white text-ceramic-graphite/80 border-ceramic-border'
                    }`}>{v}</button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-ceramic-border sticky bottom-0 bg-white -mx-5 -mb-5 p-5">
            <button type="button" onClick={onClose} className="btn-gold-outline !px-6" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-gold !px-6" disabled={saving}>{saving ? 'Saving…' : (initial?._id ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PreviewModal: React.FC<{ template: ConsoleMessageTemplate; onClose: () => void }> = ({ template, onClose }) => {
  const { showToast } = useApp();
  const [vars, setVars] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ subject: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const doPreview = async () => {
    setLoading(true);
    try {
      const r = await Console.Development.previewTemplate(String(template._id), vars);
      setResult(r);
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Preview failed' });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-3xl shadow-xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <h3 className="serif-heading text-[20px]">Preview · {template.name}</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(template.variables || []).map((v) => (
              <label key={v} className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
                <span className="font-mono">{v}</span>
                <input className="input-gold text-[13px]" value={vars[v] || ''} onChange={(e) => setVars({ ...vars, [v]: e.target.value })} placeholder={`e.g. ${v === '{{firstName}}' ? 'Ahmed' : v === '{{companyName}}' ? 'ABC Trading' : ''}`} />
              </label>
            ))}
          </div>
          <button onClick={doPreview} disabled={loading} className="btn-gold !px-6 !py-2 text-[12px] disabled:opacity-50">Render Preview</button>
          {result && (
            <div className="bg-ceramic-cream/40 border border-ceramic-border rounded-sm p-4 space-y-2">
              {result.subject && (
                <div>
                  <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash">Subject</div>
                  <div className="text-[13px] font-medium text-ceramic-graphite">{result.subject}</div>
                </div>
              )}
              <div>
                <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash">Content</div>
                <pre className="text-[13px] text-ceramic-graphite whitespace-pre-wrap font-sans">{result.content}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageTemplates;

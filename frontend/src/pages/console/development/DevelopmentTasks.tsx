/**
 * PHASE 2-B 海外客户开发中心 — Development Tasks
 *
 * 路由: /console/development/tasks
 *
 * 业务规范 §29-32：
 *   - Dev Task 承载 Campaign → Leads 分配 → 漏斗统计
 *   - 支持批量分配业务员（Sales A / B / C …）
 *   - 状态：TODO / IN_PROGRESS / BLOCKED / COMPLETED / CANCELLED
 *   - 优先级：URGENT / HIGH / MEDIUM / LOW
 *
 * 数据来自后端：/console/development/tasks CRUD + 详情返回 funnel
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target, Plus, X, RefreshCw, Trash2, Eye, Users, BarChart3,
} from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type {
  ConsoleDevelopmentTask, ConsoleLeadCampaign, LeadFunnel,
} from '../../../types';
import { useConsoleListPage } from '../../../components/console/ConsoleListPage';

const TaskStatuses = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'] as const;
const TaskPriorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;

const DevelopmentTasks: React.FC = () => {
  const { showToast } = useApp();
  const nav = useNavigate();
  const hook = useConsoleListPage<ConsoleDevelopmentTask>((p) => Console.Development.listTasks(p), { pageSize: 20, sort: 'createdAt', order: 'desc' } as any);
  const { loading, data, reload } = hook;
  const rows = data.items || [];

  const [showCreate, setShowCreate] = useState(false);
  const [campaigns, setCampaigns] = useState<ConsoleLeadCampaign[]>([]);
  useEffect(() => {
    Console.Development.listCampaigns({ page: 1, pageSize: 100 } as any)
      .then((r) => setCampaigns(r?.items || []))
      .catch(() => setCampaigns([]));
  }, []);

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto" data-testid="development-tasks">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="serif-heading text-[26px] flex items-center gap-2"><Target size={22} /> Development Tasks</h1>
          <p className="text-ceramic-ash text-[13px] mt-1">Campaign-driven lead development tasks. Track funnel: Imported → Qualified → Contacted → Replied → Inquiry → Converted.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => reload()} className="btn-gold-outline !px-4 !py-2 text-[12px]"><RefreshCw size={13} className="inline mr-1" /> Refresh</button>
          <button onClick={() => setShowCreate(true)} className="btn-gold !px-4 !py-2 text-[12px]"><Plus size={13} className="inline mr-1" /> New Dev Task</button>
        </div>
      </header>

      <div className="bg-white border border-ceramic-border rounded-sm overflow-x-auto">
        <table className="min-w-[920px] w-full text-[13px]">
          <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
            <tr className="text-left text-[10px] tracking-luxury uppercase text-ceramic-ash">
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total Leads</th>
              <th className="px-4 py-3">Funnel</th>
              <th className="px-4 py-3">Conversion</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-ceramic-ash">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Target size={36} className="mx-auto text-ceramic-ash mb-3" />
                  <div className="text-ceramic-ash text-[13px] mb-3">No development tasks yet.</div>
                  <button onClick={() => setShowCreate(true)} className="btn-gold !px-5 inline-flex items-center gap-2"><Plus size={13} /> Create Dev Task</button>
                </td>
              </tr>
            ) : rows.map((t) => (
              <TaskRow key={String(t._id)} t={t} onView={() => nav(`/console/development/tasks/${t._id}`)} />
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <TaskCreateModal
          campaigns={campaigns}
          onClose={() => setShowCreate(false)}
          onSaved={(task) => {
            setShowCreate(false);
            showToast({ type: 'success', text: 'Dev task created' });
            reload();
            // 若有 leadIds 直接通过批量分配页面创建，否则引导回 Lead 列表
            if (!task.leadIds?.length) {
              showToast({ type: 'info', text: 'Tip: select leads in /console/leads and use "Create Development Task" to attach them.' });
            }
          }}
        />
      )}
    </div>
  );
};

const TaskRow: React.FC<{ t: ConsoleDevelopmentTask; onView: () => void }> = ({ t, onView }) => {
  const funnel: LeadFunnel = t.funnel || { imported: 0, qualified: 0, contacted: 0, replied: 0, interested: 0, inquiry: 0, converted: 0, lost: 0 };
  const total = t.totalLeads || t.leadIds?.length || 0;
  const conv = total ? Math.round((funnel.converted / total) * 100) : 0;
  const statusCls: Record<string, string> = {
    TODO: 'bg-slate-100 text-slate-700 border-slate-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    BLOCKED: 'bg-amber-50 text-amber-700 border-amber-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  const priCls: Record<string, string> = {
    URGENT: 'text-red-700', HIGH: 'text-amber-700', MEDIUM: 'text-ceramic-graphite', LOW: 'text-ceramic-ash',
  };
  return (
    <tr className="border-b border-ceramic-border last:border-0 hover:bg-ceramic-cream/30">
      <td className="px-4 py-3">
        <div className="font-medium text-ceramic-graphite">{t.title}</div>
        {t.description && <div className="text-[11px] text-ceramic-ash line-clamp-1 max-w-[280px]">{t.description}</div>}
      </td>
      <td className={`px-4 py-3 font-medium ${priCls[t.priority] || ''}`}>{t.priority}</td>
      <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${statusCls[t.status] || ''}`}>{t.status}</span></td>
      <td className="px-4 py-3 font-medium">{total}</td>
      <td className="px-4 py-3 text-[11px] text-ceramic-ash whitespace-nowrap">
        {funnel.imported} → <span className="text-cyan-700">{funnel.qualified}</span> → <span className="text-indigo-700">{funnel.contacted}</span> → <span className="text-sky-700">{funnel.replied}</span> → <span className="text-amber-700">{funnel.inquiry}</span> → <span className="text-emerald-700 font-medium">{funnel.converted}</span>
      </td>
      <td className="px-4 py-3"><span className="font-medium text-emerald-700">{conv}%</span></td>
      <td className="px-4 py-3 text-[11px] text-ceramic-ash">{t.dueAt ? new Date(t.dueAt).toLocaleDateString() : '—'}</td>
      <td className="px-4 py-3 text-right">
        <button onClick={onView} className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-ceramic-gold-matte hover:underline"><Eye size={12} /> View</button>
      </td>
    </tr>
  );
};

const TaskCreateModal: React.FC<{ campaigns: ConsoleLeadCampaign[]; onClose: () => void; onSaved: (t: ConsoleDevelopmentTask) => void }> =
({ campaigns, onClose, onSaved }) => {
  const { showToast } = useApp();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ConsoleDevelopmentTask>>({
    title: '', description: '', campaignId: '', ownerId: '',
    type: 'RESEARCH', priority: 'MEDIUM', status: 'TODO', dueAt: '',
  });
  const set = <K extends keyof ConsoleDevelopmentTask>(k: K, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return showToast({ type: 'error', text: 'Title is required' });
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (payload.dueAt) payload.dueAt = new Date(payload.dueAt);
      else delete payload.dueAt;
      const created = await Console.Development.createTask(payload);
      onSaved(created);
    } catch (err: any) {
      showToast({ type: 'error', text: err?.message || 'Create failed' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-2xl shadow-xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <h3 className="serif-heading text-[20px]">New Development Task</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Title *</span>
            <input className="input-gold text-[13px]" value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Q1 Dubai Hotel Outreach" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Description</span>
            <textarea className="input-gold text-[13px]" rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Assign to Campaign</span>
              <select className="input-gold text-[13px]" value={form.campaignId || ''} onChange={(e) => set('campaignId', e.target.value || undefined)}>
                <option value="">— None —</option>
                {campaigns.map((c) => <option key={String(c._id)} value={String(c._id)}>{c.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Owner ID (sales rep)</span>
              <input className="input-gold text-[13px]" value={form.ownerId || ''} onChange={(e) => set('ownerId', e.target.value)} placeholder="user ObjectId" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Priority</span>
              <select className="input-gold text-[13px]" value={form.priority || 'MEDIUM'} onChange={(e) => set('priority', e.target.value as any)}>
                {TaskPriorities.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Status</span>
              <select className="input-gold text-[13px]" value={form.status || 'TODO'} onChange={(e) => set('status', e.target.value as any)}>
                {TaskStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
              <span>Due Date</span>
              <input type="date" className="input-gold text-[13px]" value={(form.dueAt as any) || ''} onChange={(e) => set('dueAt', e.target.value)} />
            </label>
          </div>
          <div className="bg-ceramic-cream/40 border border-ceramic-border rounded-sm p-3 text-[11px] text-ceramic-ash">
            Tip: To attach existing leads, select them in the Leads page and choose "Create Development Task" from batch actions.
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-ceramic-border sticky bottom-0 bg-white -mx-5 -mb-5 p-5">
            <button type="button" onClick={onClose} className="btn-gold-outline !px-6" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-gold !px-6" disabled={saving}>{saving ? 'Creating…' : 'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DevelopmentTasks;

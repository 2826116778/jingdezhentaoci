/**
 * PHASE 2-A：Tasks 列表页（真实 CRUD + 视图筛选：待办/已完成/逾期 + 优先级）
 */
import React, { useState } from 'react';
import { ListTodo, CheckCircle, AlertTriangle, Clock, AlertOctagon } from 'lucide-react';
import ConsoleListPageView, { Column, ListFilter } from '../../components/console/ConsoleListPage';
import { Console, ConsoleListParams } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleTask } from '../../types';
import TaskFormModal from './components/TaskFormModal';

const VIEWS: Array<{ key: string; label: string; icon: any; params: ConsoleListParams }> = [
  { key: 'all',     label: 'All Tasks', icon: ListTodo,     params: {} },
  { key: 'todo',    label: 'To-Do',     icon: Clock,        params: { view: 'todo' } },
  { key: 'overdue', label: 'Overdue',   icon: AlertOctagon, params: { view: 'overdue' } },
  { key: 'done',    label: 'Completed', icon: CheckCircle,  params: { view: 'done' } },
];

const FILTERS: ListFilter[] = [
  { key: 'search',   label: 'Search',   type: 'search', placeholder: 'Title / Description' },
  { key: 'status',   label: 'Status',   type: 'select', options: ['TODO','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED'].map(v => ({ label: v, value: v })) },
  { key: 'priority', label: 'Priority', type: 'select', options: ['URGENT','HIGH','MEDIUM','LOW'].map(v => ({ label: v, value: v })) },
  { key: 'type',     label: 'Type',     type: 'select', options: ['FOLLOW_UP','INQUIRY_REPLY','QUOTE_PREPARE','ORDER_FOLLOW','RESEARCH','MEETING','OTHER'].map(v => ({ label: v, value: v })) },
];

const COLUMNS: Column<ConsoleTask>[] = [
  { key: 'priority', label: 'Pri', width: '5%',
    render: (t) => <PriorityDot p={t.priority} /> },
  { key: 'title', label: 'Title', width: '28%',
    render: (t) => (
      <div className="flex flex-col">
        <span className={`font-medium text-[13px] ${t.status === 'COMPLETED' ? 'line-through text-ceramic-ash' : 'text-ceramic-graphite'}`}>{t.title}</span>
        {t.description && <span className="text-[11px] text-ceramic-ash line-clamp-1 mt-1">{t.description}</span>}
      </div>
    ) },
  { key: 'type', label: 'Type', width: '12%',
    render: (t) => <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-ceramic-cream border border-ceramic-border">{t.type}</span> },
  { key: 'status', label: 'Status', width: '12%',
    render: (t) => <StatusChip status={t.status} /> },
  { key: 'dueAt', label: 'Due Date', width: '15%',
    render: (t) => <DueBadge due={t.dueAt} status={t.status} /> },
  { key: 'completedAt', label: 'Completed', width: '13%',
    render: (t) => t.completedAt ? <span className="text-[12px] text-emerald-700">{new Date(t.completedAt).toLocaleDateString()}</span> : <span className="text-[12px] text-ceramic-ash">---</span> },
  { key: 'customerId', label: 'Link', width: '10%',
    render: (t) => (
      <div className="flex gap-1 flex-wrap text-[10px] text-ceramic-ash">
        {t.customerId && <span className="px-1.5 py-0.5 rounded bg-ceramic-cream border border-ceramic-border">C</span>}
        {t.leadId && <span className="px-1.5 py-0.5 rounded bg-ceramic-cream border border-ceramic-border">L</span>}
      </div>
    ) },
];

function PriorityDot({ p }: { p: ConsoleTask['priority'] }) {
  const color = p === 'URGENT' ? 'bg-red-600' : p === 'HIGH' ? 'bg-orange-500' : p === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="flex items-center gap-1" title={p}>
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <AlertTriangle size={10} className={p === 'URGENT' ? 'text-red-600' : 'opacity-0'} />
    </div>
  );
}
function StatusChip({ status }: { status: ConsoleTask['status'] }) {
  const m: Record<string, string> = {
    TODO:        'bg-sky-50 text-sky-700 border-sky-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    BLOCKED:     'bg-red-50 text-red-700 border-red-200',
    COMPLETED:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED:   'bg-gray-100 text-gray-600 border-gray-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border font-semibold ${m[status] || ''}`}>{status}</span>;
}
function DueBadge({ due, status }: { due?: string; status: ConsoleTask['status'] }) {
  if (!due) return <span className="text-[12px] text-ceramic-ash">---</span>;
  const d = new Date(due);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  let cls = 'text-ceramic-ash';
  if (status === 'COMPLETED') cls = 'text-emerald-600 line-through';
  else if (diffDays < 0) cls = 'text-red-600 font-semibold';
  else if (diffDays === 0) cls = 'text-amber-700 font-semibold';
  else if (diffDays <= 2) cls = 'text-sky-700';
  return <span className={`text-[12px] ${cls}`}>{d.toLocaleDateString()}</span>;
}

const Tasks: React.FC = () => {
  const { showToast } = useApp();
  const [edit, setEdit] = useState<ConsoleTask | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const activeView = VIEWS.find(v => v.key === view) || VIEWS[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => { setView(v.key); setRefreshKey(k => k + 1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-[12px] transition-colors ${
                view === v.key
                  ? 'border-ceramic-gold bg-ceramic-gold text-white font-semibold shadow-sm'
                  : 'bg-ceramic-cream/50 border-transparent text-ceramic-graphite hover:border-ceramic-border'
              }`}>
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ceramic-ash">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /> URGENT</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> HIGH</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> MEDIUM</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> LOW</span>
        </div>
      </div>

      <ConsoleListPageView<ConsoleTask>
        testId={`console-tasks-${view}`}
        pageTitle="Tasks"
        pageSubtitle="Sales & operational to-dos linked to leads, customers, inquiries, quotes or orders. Assign priorities and due dates for team accountability."
        Icon={ListTodo}
        newCtaLabel="New Task"
        fetcher={(p) => Console.listTasks({ ...(activeView.params || {}), ...p, _k: refreshKey } as any)}
        columns={COLUMNS}
        filters={FILTERS}
        initialParams={activeView.params}
        onCreate={() => { setEdit(null); setShowCreate(true); }}
        onEdit={(row) => { setEdit(row); setShowCreate(true); }}
        onDelete={async (row) => { await Console.deleteTask(String(row._id || row.id)); return true; }}
      />

      <TaskFormModal
        open={showCreate}
        initial={edit || undefined}
        onClose={() => { setShowCreate(false); setEdit(null); }}
        onSaved={() => { setShowCreate(false); setRefreshKey(k => k + 1); showToast({ type: 'success', text: 'Task saved' }); }}
      />
    </div>
  );
};

export default Tasks;

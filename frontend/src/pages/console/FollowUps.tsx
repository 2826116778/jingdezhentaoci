/**
 * PHASE 2-A：FollowUps 列表页（真实 CRUD + 视图筛选：今日/即将到期/已完成/已逾期）
 */
import React, { useState } from 'react';
import { MessageCircle, Calendar, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import ConsoleListPageView, { Column, ListFilter } from '../../components/console/ConsoleListPage';
import { Console, ConsoleListParams } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleFollowUp } from '../../types';
import FollowUpFormModal from './components/FollowUpFormModal';

const VIEWS: Array<{ key: string; label: string; icon: any; className: string; params: ConsoleListParams }> = [
  { key: 'all',      label: 'All',         icon: MessageCircle,  className: '',                           params: {} },
  { key: 'today',    label: 'Today',       icon: Calendar,       className: 'bg-sky-50 text-sky-700',    params: { view: 'today' } },
  { key: 'upcoming', label: 'Upcoming',    icon: Clock,          className: 'bg-cyan-50 text-cyan-700',  params: { view: 'upcoming' } },
  { key: 'overdue',  label: 'Overdue',     icon: AlertTriangle,  className: 'bg-red-50 text-red-700',    params: { view: 'overdue' } },
  { key: 'completed',label: 'Completed',   icon: CheckCircle,    className: 'bg-emerald-50 text-emerald-700', params: { view: 'completed' } },
];

const FILTERS: ListFilter[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Content / Result / Next Action' },
  { key: 'status', label: 'Status', type: 'select', options: ['PENDING','COMPLETED','CANCELLED','OVERDUE'].map(v => ({ label: v, value: v })) },
  { key: 'type',   label: 'Type',   type: 'select', options: ['EMAIL','WHATSAPP','PHONE','MEETING','SOCIAL','OTHER'].map(v => ({ label: v, value: v })) },
];

const COLUMNS: Column<ConsoleFollowUp>[] = [
  { key: 'type', label: 'Type', width: '10%',
    render: (f) => <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border font-semibold ${typeColor(f.type)}`}>{f.type}</span> },
  { key: 'status', label: 'Status', width: '10%',
    render: (f) => <StatusChip status={f.status} /> },
  { key: 'content', label: 'Content', width: '30%',
    render: (f) => (
      <div className="flex flex-col">
        <span className="text-[13px] line-clamp-2 text-ceramic-graphite">{f.content || '---'}</span>
        {f.result && <span className="text-[11px] text-ceramic-ash line-clamp-1 mt-1"><strong>Result:</strong> {f.result}</span>}
      </div>
    ) },
  { key: 'scheduledAt', label: 'Scheduled', width: '15%',
    render: (f) => <DateBadge date={f.scheduledAt} /> },
  { key: 'completedAt', label: 'Completed', width: '15%',
    render: (f) => f.completedAt ? <span className="text-[12px] text-emerald-700">{new Date(f.completedAt).toLocaleString()}</span> : <span className="text-[12px] text-ceramic-ash">---</span> },
  { key: 'nextAction', label: 'Next Action', width: '15%',
    render: (f) => <span className="text-[12px] text-ceramic-ash line-clamp-1">{f.nextAction || '---'}</span> },
  { key: 'customerId', label: 'Relations', width: '5%',
    render: (f) => (
      <div className="flex gap-1 flex-wrap text-[10px] text-ceramic-ash">
        {f.customerId && <span className="px-1.5 py-0.5 rounded bg-ceramic-cream border border-ceramic-border">C</span>}
        {f.leadId && <span className="px-1.5 py-0.5 rounded bg-ceramic-cream border border-ceramic-border">L</span>}
      </div>
    ) },
];

function typeColor(t: string) {
  const m: Record<string, string> = {
    EMAIL:    'bg-blue-50 text-blue-700 border-blue-200',
    WHATSAPP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PHONE:    'bg-indigo-50 text-indigo-700 border-indigo-200',
    MEETING:  'bg-purple-50 text-purple-700 border-purple-200',
    SOCIAL:   'bg-pink-50 text-pink-700 border-pink-200',
    OTHER:    'bg-gray-100 text-gray-700 border-gray-200',
  };
  return m[t] || m.OTHER;
}
function StatusChip({ status }: { status: ConsoleFollowUp['status'] }) {
  const m: Record<string, string> = {
    PENDING:   'bg-sky-50 text-sky-700 border-sky-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
    OVERDUE:   'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${m[status] || ''}`}>{status}</span>;
}
function DateBadge({ date }: { date?: string }) {
  if (!date) return <span className="text-[12px] text-ceramic-ash">---</span>;
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  let badge = '';
  if (diffDays < 0) badge = 'text-red-600';
  else if (diffDays === 0) badge = 'text-amber-700 font-semibold';
  else if (diffDays <= 3) badge = 'text-sky-700';
  else badge = 'text-ceramic-ash';
  return <span className={`text-[12px] ${badge}`}>{d.toLocaleDateString()}</span>;
}

const FollowUps: React.FC = () => {
  const { showToast } = useApp();
  const [edit, setEdit] = useState<ConsoleFollowUp | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<string>('all');
  const [hookRefreshKey, setHookRefreshKey] = useState(0);

  const activeView = VIEWS.find(v => v.key === view) || VIEWS[0];

  return (
    <div className="space-y-5">
      {/* View chips */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map(v => (
          <button key={v.key} onClick={() => { setView(v.key); setHookRefreshKey(k => k + 1); }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-[12px] transition-colors ${
              view === v.key
                ? 'border-ceramic-gold bg-ceramic-gold text-white font-semibold shadow-sm'
                : `${v.className} border-transparent hover:border-ceramic-border`
            }`}>
            <v.icon size={13} /> {v.label}
          </button>
        ))}
      </div>

      <ConsoleListPageView<ConsoleFollowUp>
        testId={`console-followups-${view}`}
        pageTitle="Follow-Ups"
        pageSubtitle="Schedule and log all customer communications: emails, WhatsApp, calls, meetings. Follow-ups linked to Leads, Customers, Inquiries, Quotes or Orders."
        Icon={MessageCircle}
        newCtaLabel="Log Follow-Up"
        fetcher={(p) => Console.listFollowUps({ ...(activeView.params || {}), ...p, page: p?.page || 1, _k: hookRefreshKey } as any)}
        columns={COLUMNS}
        filters={FILTERS}
        initialParams={activeView.params}
        onCreate={() => { setEdit(null); setShowCreate(true); }}
        onEdit={(row) => { setEdit(row); setShowCreate(true); }}
        onDelete={async (row) => { await Console.deleteFollowUp(String(row._id || row.id)); return true; }}
      />

      <FollowUpFormModal
        open={showCreate}
        initial={edit || undefined}
        onClose={() => { setShowCreate(false); setEdit(null); }}
        onSaved={() => { setShowCreate(false); setHookRefreshKey(k => k + 1); showToast({ type: 'success', text: 'Follow-up saved' }); }}
      />
    </div>
  );
};

export default FollowUps;

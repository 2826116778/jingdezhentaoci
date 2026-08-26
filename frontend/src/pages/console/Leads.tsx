/**
 * PHASE 2-A：Leads 列表页（真实 CRUD + 搜索 + 筛选 + 分页 + 转换 Customer）
 */
import React, { useState } from 'react';
import { Users2, Star, UserCheck, ArrowRightLeft } from 'lucide-react';
import ConsoleListPageView, { Column, ListFilter } from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleLead } from '../../types';
import LeadFormModal from './components/LeadFormModal';
import CustomerConvertModal from './components/CustomerConvertModal';

const FILTERS: ListFilter[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Company / Contact / Email / WhatsApp' },
  { key: 'country', label: 'Country', type: 'text', placeholder: 'e.g. UAE' },
  { key: 'industry', label: 'Industry', type: 'select', options: [
    'hospitality','residential','retail','ecommerce','construction','interior_design','food_beverage','luxury_goods','art_collectibles','government','education','other'
  ].map(v => ({ label: v, value: v })) },
  { key: 'status', label: 'Status', type: 'select', options: [
    'NEW','RESEARCHING','QUALIFIED','CONTACTED','REPLIED','INTERESTED','INQUIRY','CONVERTED','LOST'
  ].map(v => ({ label: v, value: v })) },
  { key: 'grade', label: 'Grade', type: 'select', options: ['A','B','C','D'].map(v => ({ label: v, value: v })) },
  { key: 'source', label: 'Source', type: 'select', options: [
    'website','manual','linkedin','google','instagram','alibaba','exhibition','referral','import','other'
  ].map(v => ({ label: v, value: v })) },
];

const COLUMNS: Column<ConsoleLead>[] = [
  { key: 'companyName', label: 'Company', width: '20%',
    render: (l) => (
      <div className="flex flex-col">
        <span className="font-medium text-ceramic-graphite">{l.companyName}</span>
        <span className="text-[11px] text-ceramic-ash">{l.country || '—'} {l.industry ? `· ${l.industry}` : ''}</span>
      </div>
    ) },
  { key: 'contactName', label: 'Contact', width: '15%',
    render: (l) => (
      <div className="flex flex-col">
        <span>{l.contactName || '—'}</span>
        <span className="text-[11px] text-ceramic-ash">{l.jobTitle || ''}</span>
      </div>
    ) },
  { key: 'email', label: 'Email', width: '16%' },
  { key: 'whatsapp', label: 'WhatsApp', width: '12%' },
  { key: 'source', label: 'Source', width: '8%',
    render: (l) => <span className="inline-block px-2 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[11px] text-ceramic-graphite">{l.source || '—'}</span> },
  { key: 'status', label: 'Status', width: '10%',
    render: (l) => <StatusChip status={l.status} /> },
  { key: 'grade', label: 'Grade', width: '8%',
    render: (l) => <GradeChip grade={l.grade} score={l.score} /> },
  { key: 'createdAt', label: 'Created', width: '10%',
    render: (l) => l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '' },
];

function StatusChip({ status }: { status: ConsoleLead['status'] }) {
  const map: Record<ConsoleLead['status'], string> = {
    NEW: 'bg-gray-100 text-gray-700 border-gray-200',
    RESEARCHING: 'bg-blue-50 text-blue-700 border-blue-200',
    QUALIFIED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    CONTACTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    REPLIED:   'bg-sky-50 text-sky-700 border-sky-200',
    INTERESTED:'bg-purple-50 text-purple-700 border-purple-200',
    INQUIRY:   'bg-amber-50 text-amber-800 border-amber-200',
    CONVERTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LOST:      'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${map[status] || ''}`}>{status}</span>;
}

function GradeChip({ grade, score }: { grade: ConsoleLead['grade']; score: number }) {
  const color = grade === 'A' ? 'text-amber-600' : grade === 'B' ? 'text-cyan-700' : grade === 'C' ? 'text-slate-600' : 'text-slate-400';
  return (
    <div className="flex items-center gap-1">
      <Star size={12} className={color} fill={grade === 'A' ? 'currentColor' : 'none'} />
      <span className={`font-semibold ${color}`}>{grade}</span>
      <span className="text-[11px] text-ceramic-ash">{score}</span>
    </div>
  );
}

const Leads: React.FC = () => {
  const { showToast } = useApp();
  const [edit, setEdit] = useState<ConsoleLead | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [convertTarget, setConvertTarget] = useState<ConsoleLead | null>(null);

  return (
    <>
      <ConsoleListPageView<ConsoleLead>
        testId="console-leads"
        pageTitle="Leads"
        pageSubtitle="Potential overseas buyers. Create, qualify, and convert them into Customers."
        Icon={Users2}
        newCtaLabel="Add Lead"
        fetcher={(p) => Console.listLeads(p)}
        columns={COLUMNS}
        filters={FILTERS}
        onCreate={() => { setEdit(null); setShowCreate(true); }}
        onEdit={(row) => { setEdit(row); setShowCreate(true); }}
        onDelete={async (row) => {
          await Console.deleteLead(String(row._id || row.id));
          return true;
        }}
        extraRowActions={[
          {
            key: 'convert', label: 'Convert', icon: ArrowRightLeft,
            className: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
            show: (l) => l.status !== 'CONVERTED' || !l.customerId,
            onClick: (l) => setConvertTarget(l),
          },
          {
            key: 'setScore', label: 'Score',
            onClick: async (l) => {
              const cur = String(l.score ?? 0);
              const v = window.prompt(`Set score (0-100) for "${l.companyName}"`, cur);
              if (v == null) return;
              const n = Math.max(0, Math.min(100, Number(v)));
              if (!Number.isFinite(n)) return showToast({ type: 'error', text: 'Invalid score' });
              await Console.updateLead(String(l._id || l.id), { score: n });
              showToast({ type: 'success', text: 'Score updated' });
            },
          },
          {
            key: 'setStatus', label: 'Status', icon: UserCheck,
            onClick: async (l) => {
              const v = window.prompt(`Set status (NEW/RESEARCHING/QUALIFIED/CONTACTED/REPLIED/INTERESTED/INQUIRY/CONVERTED/LOST) for "${l.companyName}"`, l.status);
              if (!v) return;
              await Console.updateLead(String(l._id || l.id), { status: v.toUpperCase() as any });
              showToast({ type: 'success', text: 'Status updated' });
            },
          },
        ]}
      />
      <LeadFormModal
        open={showCreate}
        initial={edit || undefined}
        onClose={() => { setShowCreate(false); setEdit(null); }}
        onSaved={() => setShowCreate(false)}
      />
      <CustomerConvertModal
        open={!!convertTarget}
        lead={convertTarget}
        onClose={() => setConvertTarget(null)}
        onDone={() => setConvertTarget(null)}
      />
    </>
  );
};
export default Leads;

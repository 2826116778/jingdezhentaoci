/**
 * PHASE 2-A：Customers 列表页（真实 CRUD + 搜索 + 筛选 + 分页 + 详情 + FollowUp）
 */
import React, { useState } from 'react';
import { UserCheck, Star, MessageCircle, Eye, Plus } from 'lucide-react';
import ConsoleListPageView, { Column, ListFilter } from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleCustomer, ConsoleCustomerDetail, ConsoleFollowUp } from '../../types';
import CustomerFormModal from './components/CustomerFormModal';
import FollowUpFormModal from './components/FollowUpFormModal';
import CustomerDetailModal from './components/CustomerDetailModal';

const FILTERS: ListFilter[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Company / Code / Tags' },
  { key: 'country', label: 'Country', type: 'text', placeholder: 'e.g. UAE' },
  { key: 'customerLevel', label: 'Level', type: 'select', options: [
    'PLATINUM','GOLD','SILVER','BRONZE','PROSPECT'
  ].map(v => ({ label: v, value: v })) },
  { key: 'status', label: 'Status', type: 'select', options: [
    'ACTIVE','PENDING','AT_RISK','INACTIVE','CHURNED'
  ].map(v => ({ label: v, value: v })) },
  { key: 'source', label: 'Source', type: 'select', options: [
    'website','manual','linkedin','google','instagram','alibaba','exhibition','referral','lead_converted','other'
  ].map(v => ({ label: v, value: v })) },
];

const COLUMNS: Column<ConsoleCustomer>[] = [
  { key: 'customerCode', label: 'Code', width: '10%',
    render: (c) => <span className="font-mono text-[12px] text-ceramic-gold-matte font-semibold">{c.customerCode || '---'}</span> },
  { key: 'companyId', label: 'Company', width: '22%',
    render: (c) => (
      <div className="flex flex-col">
        <span className="font-medium text-ceramic-graphite">{(c as any).company?.name || (c as any).company || (c as any).name || '---'}</span>
        <span className="text-[11px] text-ceramic-ash">{(c as any).company?.country || c.country || ''}</span>
      </div>
    ) },
  { key: 'customerLevel', label: 'Level', width: '10%',
    render: (c) => <LevelChip level={c.customerLevel} /> },
  { key: 'status', label: 'Status', width: '10%',
    render: (c) => <StatusChip status={c.status} /> },
  { key: 'score', label: 'Score', width: '8%',
    render: (c) => <ScoreCell score={c.score} /> },
  { key: 'source', label: 'Source', width: '12%',
    render: (c) => <span className="inline-block px-2 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[11px]">{c.source || '---'}</span> },
  { key: 'lastContactAt', label: 'Last Contact', width: '12%',
    render: (c) => c.lastContactAt ? new Date(c.lastContactAt).toLocaleDateString() : '---' },
  { key: 'createdAt', label: 'Created', width: '10%',
    render: (c) => c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '' },
];

function LevelChip({ level }: { level: ConsoleCustomer['customerLevel'] }) {
  const colorMap: Record<string, string> = {
    PLATINUM: 'bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 border-slate-400',
    GOLD: 'bg-amber-50 text-amber-800 border-amber-300',
    SILVER: 'bg-gray-100 text-gray-700 border-gray-300',
    BRONZE: 'bg-orange-50 text-orange-800 border-orange-300',
    PROSPECT: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border font-semibold ${colorMap[level] || ''}`}>{level}</span>;
}
function StatusChip({ status }: { status: ConsoleCustomer['status'] }) {
  const m: Record<string, string> = {
    ACTIVE:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
    AT_RISK:  'bg-orange-50 text-orange-700 border-orange-200',
    INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
    CHURNED:  'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${m[status] || ''}`}>{status}</span>;
}
function ScoreCell({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-700' : score >= 60 ? 'text-amber-700' : score >= 40 ? 'text-orange-700' : 'text-slate-500';
  return (
    <div className="flex items-center gap-1">
      <Star size={12} className={color} fill={score >= 70 ? 'currentColor' : 'none'} />
      <span className={`font-semibold ${color}`}>{score ?? 0}</span>
    </div>
  );
}

const Customers: React.FC = () => {
  const { showToast } = useApp();
  const [edit, setEdit] = useState<ConsoleCustomer | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConsoleCustomerDetail | null>(null);
  const [showFU, setShowFU] = useState(false);
  const [fuTargetId, setFuTargetId] = useState<string | undefined>(undefined);

  const loadDetail = async (id: string) => {
    try {
      const d = await Console.customerDetail(id);
      setDetail(d);
      setDetailId(id);
    } catch (e: any) { showToast({ type: 'error', text: e?.message || 'Load detail failed' }); }
  };

  return (
    <>
      <ConsoleListPageView<ConsoleCustomer>
        testId="console-customers"
        pageTitle="Customers"
        pageSubtitle="Converted & long-term customers. Manage 360-degree profiles, follow-ups, inquiries, quotes, and orders."
        Icon={UserCheck}
        newCtaLabel="Add Customer"
        fetcher={(p) => Console.listCustomers(p)}
        columns={COLUMNS}
        filters={FILTERS}
        onCreate={() => { setEdit(null); setShowCreate(true); }}
        onEdit={(row) => { setEdit(row); setShowCreate(true); }}
        onDelete={async (row) => { await Console.deleteCustomer(String(row._id || row.id)); return true; }}
        onView={(row) => loadDetail(String(row._id || row.id))}
        extraRowActions={[
          {
            key: 'addFU', label: 'Follow-Up', icon: MessageCircle,
            className: 'bg-ceramic-cream border-ceramic-border text-ceramic-graphite hover:border-ceramic-gold',
            onClick: (c) => { setFuTargetId(String(c._id || c.id)); setShowFU(true); },
          },
        ]}
      />

      <CustomerFormModal
        open={showCreate}
        initial={edit || undefined}
        onClose={() => { setShowCreate(false); setEdit(null); }}
        onSaved={() => setShowCreate(false)}
      />

      <FollowUpFormModal
        open={showFU}
        defaultCustomerId={fuTargetId}
        onClose={() => { setShowFU(false); setFuTargetId(undefined); }}
        onSaved={() => { setShowFU(false); showToast({ type: 'success', text: 'Follow-up logged' }); }}
      />

      {detailId && (
        <CustomerDetailModal
          open={!!detailId}
          detail={detail}
          onLoad={() => detailId && loadDetail(detailId)}
          onClose={() => { setDetailId(null); setDetail(null); }}
          onAddFollowUp={(cid) => { setFuTargetId(cid); setShowFU(true); }}
        />
      )}
    </>
  );
};

export default Customers;

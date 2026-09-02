/**
 * PHASE 2-A：Inquiries 列表页（真实 CRUD + 搜索 + 筛选 + 分页）
 * 复用现有 Inquiry Model + 扩展字段
 */
import React from 'react';
import { MessageSquare, FileText as QuoteIcon } from 'lucide-react';
import ConsoleListPageView, { Column, ListFilter } from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleInquiry } from '../../types';

const FILTERS: ListFilter[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Name / Email / Company / Subject' },
  { key: 'stage', label: 'Stage', type: 'select', options: [
    'NEW','PROCESSING','QUALIFIED','QUOTED','NEGOTIATING','WON','LOST'
  ].map(v => ({ label: v, value: v })) },
  { key: 'status', label: 'Legacy Status', type: 'select', options: [
    'new','read','replied','closed','archived'
  ].map(v => ({ label: v, value: v })) },
  { key: 'priority', label: 'Priority', type: 'select', options: [
    'LOW','MEDIUM','HIGH','URGENT'
  ].map(v => ({ label: v, value: v })) },
  { key: 'source', label: 'Source', type: 'select', options: [
    'contact','product','quote','oem','website'
  ].map(v => ({ label: v, value: v })) },
  { key: 'country', label: 'Country', type: 'text', placeholder: 'e.g. UAE' },
];

const COLUMNS: Column<ConsoleInquiry>[] = [
  { key: 'name', label: 'Contact', width: '16%',
    render: (i) => (
      <div className="flex flex-col">
        <span className="font-medium text-ceramic-graphite">{i.name || '---'}</span>
        <span className="text-[11px] text-ceramic-ash">{i.email || ''}</span>
        {i.company && <span className="text-[11px] text-ceramic-ash">{i.company}</span>}
      </div>
    ) },
  { key: 'subject', label: 'Subject / Product', width: '22%',
    render: (i) => (
      <div className="flex flex-col">
        <span className="text-[13px] text-ceramic-graphite line-clamp-1">{i.subject || i.productName || 'Inquiry'}</span>
        <span className="text-[11px] text-ceramic-ash line-clamp-2">{i.message || i.customDemand || ''}</span>
      </div>
    ) },
  { key: 'stage', label: 'Stage', width: '11%',
    render: (i) => <StageChip stage={i.stage || (i.status as any)} /> },
  { key: 'priority', label: 'Priority', width: '9%',
    render: (i) => <PriorityChip priority={i.priority || 'MEDIUM'} /> },
  { key: 'source', label: 'Source', width: '9%',
    render: (i) => <span className="inline-block px-2 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[11px]">{i.source}</span> },
  { key: 'estimatedValue', label: 'Est. Value', width: '9%',
    render: (i) => i.estimatedValue ? <span className="font-semibold text-ceramic-graphite">${i.estimatedValue.toLocaleString()}</span> : <span className="text-[12px] text-ceramic-ash">---</span> },
  { key: 'country', label: 'Country', width: '8%',
    render: (i) => <span className="text-[12px] text-ceramic-ash">{i.country || '---'}</span> },
  { key: 'createdAt', label: 'Created', width: '10%',
    render: (i) => i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '' },
];

function StageChip({ stage }: { stage: any }) {
  const s = String(stage || 'NEW').toUpperCase();
  const m: Record<string, string> = {
    NEW:         'bg-gray-100 text-gray-700 border-gray-200',
    PROCESSING:  'bg-blue-50 text-blue-700 border-blue-200',
    QUALIFIED:   'bg-cyan-50 text-cyan-700 border-cyan-200',
    QUOTED:      'bg-amber-50 text-amber-800 border-amber-200',
    NEGOTIATING: 'bg-purple-50 text-purple-700 border-purple-200',
    WON:         'bg-emerald-50 text-emerald-700 border-emerald-200',
    LOST:        'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${m[s] || m.NEW}`}>{s}</span>;
}
function PriorityChip({ priority }: { priority: string }) {
  const p = String(priority).toUpperCase();
  const colorMap: Record<string, string> = {
    URGENT: 'bg-red-50 text-red-700 border-red-200',
    HIGH:   'bg-orange-50 text-orange-700 border-orange-200',
    MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
    LOW:    'bg-gray-100 text-gray-600 border-gray-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border font-semibold ${colorMap[p] || colorMap.MEDIUM}`}>{p}</span>;
}

const Inquiries: React.FC = () => {
  const { showToast } = useApp();
  return (
    <ConsoleListPageView<ConsoleInquiry>
      testId="console-inquiries"
      pageTitle="Inquiries"
      pageSubtitle="All inbound B2B/B2C inquiries: Contact form, OEM, Product detail, and manual entries. Assign stages, priorities, estimated value and expected close dates."
      Icon={MessageSquare}
      newCtaLabel="Manual Inquiry"
      fetcher={(p) => Console.listInquiries(p)}
      columns={COLUMNS}
      filters={FILTERS}
      onEdit={(row) => {
        const ns = window.prompt(`Set Stage (NEW/PROCESSING/QUALIFIED/QUOTED/NEGOTIATING/WON/LOST) for inquiry from "${row.name || row.company || '---'}"`, row.stage || 'NEW');
        if (!ns) return;
        Console.updateInquiry(String(row._id || row.id), { stage: ns.toUpperCase() as any })
          .then(() => showToast({ type: 'success', text: 'Stage updated' }))
          .catch((e: any) => showToast({ type: 'error', text: e?.message || 'Update failed' }));
      }}
      extraRowActions={[
        {
          key: 'createQuote', label: 'Create Quote', icon: QuoteIcon,
          className: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
          onClick: (i) => {
            const customerId = i.customerId ? String(i.customerId) : window.prompt('Customer ID (optional):', '') || undefined;
            const amt = i.estimatedValue ? String(i.estimatedValue) : window.prompt('Quote total amount (USD):', '1000');
            if (!amt) return;
            const amtNum = Number(amt);
            if (isNaN(amtNum) || amtNum <= 0) return showToast({ type: 'error', text: 'Invalid amount' });
            Console.createQuote({
              customerId,
              inquiryId: String(i._id || i.id),
              items: [{ sku: 'MANUAL', name: i.productName || 'Custom Ceramic Products', quantity: i.quantity || 1, unitPrice: Number(amt) / (i.quantity || 1), amount: Number(amt), notes: '' }],
              currency: 'USD',
              subtotal: Number(amt), shippingFee: 0, discount: 0, tax: 0, total: Number(amt),
              incoterm: 'FOB', paymentTerms: 'T/T 30% deposit',
              status: 'DRAFT', notes: i.message || '',
            }).then(() => showToast({ type: 'success', text: 'Quote DRAFT created' }))
              .catch((e: any) => showToast({ type: 'error', text: e?.message || 'Create quote failed' }));
          },
        },
      ]}
    />
  );
};
export default Inquiries;

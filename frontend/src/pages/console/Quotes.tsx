/**
 * PHASE 2-A：Quotes 列表页（真实 CRUD + 搜索 + 筛选 + Quote→Order 转换）
 */
import React from 'react';
import { FileText, ArrowRightLeft } from 'lucide-react';
import ConsoleListPageView, { Column, ListFilter } from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleQuote } from '../../types';

const FILTERS: ListFilter[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Quote No / Notes' },
  { key: 'status', label: 'Status', type: 'select', options: [
    'DRAFT','SENT','VIEWED','NEGOTIATING','ACCEPTED','REJECTED','EXPIRED'
  ].map(v => ({ label: v, value: v })) },
];

const COLUMNS: Column<ConsoleQuote>[] = [
  { key: 'quoteNo', label: 'Quote No.', width: '15%',
    render: (q) => <span className="font-mono font-semibold text-ceramic-gold-matte text-[13px]">{q.quoteNo || '---'}</span> },
  { key: 'status', label: 'Status', width: '13%',
    render: (q) => <StatusChip status={q.status} /> },
  { key: 'customerId', label: 'Customer', width: '10%',
    render: (q) => <span className="text-[12px] text-ceramic-ash">{q.customerId ? String(q.customerId).slice(-6) : '---'}</span> },
  { key: 'inquiryId', label: 'Inquiry', width: '10%',
    render: (q) => <span className="text-[12px] text-ceramic-ash">{q.inquiryId ? String(q.inquiryId).slice(-6) : '---'}</span> },
  { key: 'items', label: 'Items', width: '10%',
    render: (q) => <span className="text-[12px] text-ceramic-graphite">{q.items?.length || 0} items</span> },
  { key: 'total', label: 'Total', width: '13%',
    render: (q) => <span className="font-semibold text-ceramic-graphite">{q.currency || 'USD'} {(q.total || 0).toLocaleString()}</span> },
  { key: 'validUntil', label: 'Valid Until', width: '12%',
    render: (q) => q.validUntil ? <span className={`text-[12px] ${new Date(q.validUntil) < new Date() ? 'text-red-600' : 'text-ceramic-ash'}`}>{new Date(q.validUntil).toLocaleDateString()}</span> : <span className="text-[12px] text-ceramic-ash">---</span> },
  { key: 'createdAt', label: 'Created', width: '12%',
    render: (q) => q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '' },
];

function StatusChip({ status }: { status: ConsoleQuote['status'] }) {
  const m: Record<string, string> = {
    DRAFT:        'bg-gray-100 text-gray-700 border-gray-200',
    SENT:         'bg-sky-50 text-sky-700 border-sky-200',
    VIEWED:       'bg-blue-50 text-blue-700 border-blue-200',
    NEGOTIATING:  'bg-purple-50 text-purple-700 border-purple-200',
    ACCEPTED:     'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED:     'bg-red-50 text-red-700 border-red-200',
    EXPIRED:      'bg-amber-50 text-amber-800 border-amber-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border font-semibold ${m[status] || ''}`}>{status}</span>;
}

const Quotes: React.FC = () => {
  const { showToast } = useApp();
  return (
    <ConsoleListPageView<ConsoleQuote>
      testId="console-quotes"
      pageTitle="Quotes"
      pageSubtitle="Quotation proposals tied to Customers and Inquiries. Manage status, validity, totals and convert accepted quotes to Orders."
      Icon={FileText}
      newCtaLabel="Create Quote"
      fetcher={(p) => Console.listQuotes(p)}
      columns={COLUMNS}
      filters={FILTERS}
      onEdit={(row) => {
        const ns = window.prompt(`Set Status for ${row.quoteNo || 'Quote'} (DRAFT/SENT/VIEWED/NEGOTIATING/ACCEPTED/REJECTED/EXPIRED):`, row.status);
        if (!ns) return;
        Console.updateQuote(String(row._id || row.id), { status: ns.toUpperCase() as any })
          .then(() => showToast({ type: 'success', text: 'Quote status updated' }))
          .catch((e: any) => showToast({ type: 'error', text: e?.message || 'Update failed' }));
      }}
      extraRowActions={[
        {
          key: 'convert', label: 'To Order', icon: ArrowRightLeft,
          className: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
          show: (q) => q.status === 'ACCEPTED' || q.status === 'SENT' || q.status === 'DRAFT',
          onClick: (q) => {
            if (!window.confirm(`Convert quote "${q.quoteNo || 'Quote'}" to Order? This creates a real Order record.`)) return;
            Console.convertQuoteToOrder(String(q._id || q.id))
              .then((ord: any) => {
                showToast({ type: 'success', text: `Order created: ${ord.orderNo || ord._id}` });
              })
              .catch((e: any) => showToast({ type: 'error', text: e?.message || 'Convert failed' }));
          },
        },
      ]}
    />
  );
};
export default Quotes;

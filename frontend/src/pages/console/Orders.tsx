/**
 * PHASE 2-A：Orders 列表页（真实数据 + 复用现有 Order Model，关联 customerId/inquiryId/quoteId）
 */
import React from 'react';
import { ShoppingCart, Package } from 'lucide-react';
import ConsoleListPageView, { Column, ListFilter } from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleOrder } from '../../types';

const FILTERS: ListFilter[] = [
  { key: 'orderNo', label: 'Order No.', type: 'search', placeholder: 'Search by Order No.' },
  { key: 'paymentStatus', label: 'Payment', type: 'select', options: [
    'pending','paid','expired','failed','refunded','cancelled'
  ].map(v => ({ label: v, value: v })) },
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Email / Phone / Company / Contact' },
];

const COLUMNS: Column<ConsoleOrder>[] = [
  { key: 'orderNo', label: 'Order No.', width: '15%',
    render: (o) => <span className="font-mono font-semibold text-ceramic-gold-matte text-[13px]">{o.orderNo || String(o._id).slice(-10)}</span> },
  { key: 'orderType', label: 'Type', width: '8%',
    render: (o) => <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${
      o.orderType === 'dealer' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-sky-50 text-sky-700 border-sky-200'
    }`}>{o.orderType || 'retail'}</span> },
  { key: 'contactInfo', label: 'Contact', width: '18%',
    render: (o) => (
      <div className="flex flex-col">
        <span className="font-medium text-ceramic-graphite">{o.contactInfo?.name || '---'}</span>
        <span className="text-[11px] text-ceramic-ash">{o.contactInfo?.email || ''}</span>
        {o.contactInfo?.company && <span className="text-[11px] text-ceramic-ash">{o.contactInfo.company}</span>}
        {o.contactInfo?.country && <span className="text-[11px] text-ceramic-ash">{o.contactInfo.country}</span>}
      </div>
    ) },
  { key: 'items', label: 'Items', width: '10%',
    render: (o) => <span className="text-[12px] text-ceramic-graphite flex items-center gap-1"><Package size={12} className="text-ceramic-ash" />{o.items?.length || 0}</span> },
  { key: 'totalAmount', label: 'Amount (USD)', width: '12%',
    render: (o) => <span className="font-semibold text-ceramic-graphite">${(o.totalAmount || o.usdtAmount || 0).toLocaleString()}</span> },
  { key: 'paymentStatus', label: 'Payment', width: '11%',
    render: (o) => <PaymentChip s={o.paymentStatus} /> },
  { key: 'relations', label: 'CRM Link', width: '11%',
    render: (o) => (
      <div className="flex gap-1 flex-wrap text-[10px] text-ceramic-ash">
        {o.customerId && <span className="px-1.5 py-0.5 rounded bg-ceramic-cream border border-ceramic-border">C</span>}
        {o.inquiryId && <span className="px-1.5 py-0.5 rounded bg-ceramic-cream border border-ceramic-border">I</span>}
        {o.quoteId && <span className="px-1.5 py-0.5 rounded bg-ceramic-cream border border-ceramic-border">Q</span>}
        {!o.customerId && !o.inquiryId && !o.quoteId && <span className="text-ceramic-ash/70">(store)</span>}
      </div>
    ) },
  { key: 'createdAt', label: 'Created', width: '10%',
    render: (o) => o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '' },
];

function PaymentChip({ s }: { s: string }) {
  const m: Record<string, string> = {
    pending:   'bg-amber-50 text-amber-800 border-amber-200',
    paid:      'bg-emerald-50 text-emerald-700 border-emerald-200',
    expired:   'bg-red-50 text-red-700 border-red-200',
    failed:    'bg-red-50 text-red-700 border-red-200',
    refunded:  'bg-purple-50 text-purple-700 border-purple-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border font-semibold ${m[s] || m.pending}`}>{s || 'pending'}</span>;
}

const Orders: React.FC = () => {
  const { showToast } = useApp();
  return (
    <ConsoleListPageView<ConsoleOrder>
      testId="console-orders"
      pageTitle="Orders"
      pageSubtitle="All orders across public store and CRM sales channels. Retail orders (TRC20-USDT) and Dealer orders are unified here, with CRM links to Customer / Inquiry / Quote where applicable."
      Icon={ShoppingCart}
      fetcher={(p) => Console.listOrders(p)}
      columns={COLUMNS}
      filters={FILTERS}
      onEdit={(row) => {
        const ns = window.prompt(`Set Payment Status for ${row.orderNo || 'Order'} (pending/paid/expired/failed/refunded/cancelled):`, row.paymentStatus);
        if (!ns) return;
        Console.updateOrder(String(row._id || row.id), { paymentStatus: ns.toLowerCase() as any })
          .then(() => showToast({ type: 'success', text: 'Order payment status updated' }))
          .catch((e: any) => showToast({ type: 'error', text: e?.message || 'Update failed' }));
      }}
    />
  );
};
export default Orders;

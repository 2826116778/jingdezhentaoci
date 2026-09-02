/**
 * PHASE 2-A：Orders 列表页（真实数据 + 复用现有 Order Model，关联 customerId/inquiryId/quoteId）
 *
 * 新增：行级"Edit Items"按钮 → 弹窗增删改商品项，调用 PATCH /orders/:id/items 重算金额（仅 pending 可编辑）
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ShoppingCart, Package, Plus, Trash2, X, Loader2 } from 'lucide-react';
import ConsoleListPageView, { Column, ListFilter } from '../../components/console/ConsoleListPage';
import { Console } from '../../api/console';
import { Orders as OrdersApi } from '../../api';
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
  { key: 'orderNo', label: 'Order No.', width: '14%',
    render: (o) => <span className="font-mono font-semibold text-ceramic-gold-matte text-[13px]">{o.orderNo || String(o._id).slice(-10)}</span> },
  { key: 'orderType', label: 'Type', width: '7%',
    render: (o) => <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${
      o.orderType === 'dealer' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-sky-50 text-sky-700 border-sky-200'
    }`}>{o.orderType || 'retail'}</span> },
  { key: 'contactInfo', label: 'Contact', width: '17%',
    render: (o) => (
      <div className="flex flex-col">
        <span className="font-medium text-ceramic-graphite">{o.contactInfo?.name || '---'}</span>
        <span className="text-[11px] text-ceramic-ash">{o.contactInfo?.email || ''}</span>
        {o.contactInfo?.company && <span className="text-[11px] text-ceramic-ash">{o.contactInfo.company}</span>}
        {o.contactInfo?.country && <span className="text-[11px] text-ceramic-ash">{o.contactInfo.country}</span>}
      </div>
    ) },
  { key: 'items', label: 'Items', width: '9%',
    render: (o) => <span className="text-[12px] text-ceramic-graphite flex items-center gap-1"><Package size={12} className="text-ceramic-ash" />{o.items?.length || 0}</span> },
  { key: 'totalAmount', label: 'Amount (USD)', width: '11%',
    render: (o) => <span className="font-semibold text-ceramic-graphite">${(o.totalAmount || o.usdtAmount || 0).toLocaleString()}</span> },
  { key: 'paymentStatus', label: 'Payment', width: '10%',
    render: (o) => <PaymentChip s={o.paymentStatus} /> },
  { key: 'relations', label: 'CRM Link', width: '10%',
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
  const [editing, setEditing] = useState<ConsoleOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const openItemsModal = useCallback((row: ConsoleOrder) => {
    setItems(((row.items || []) as any[]).map(i => ({ ...i })));
    setEditing(row);
  }, []);

  const columns = useMemo<Column<ConsoleOrder>[]>(() => [
    ...COLUMNS,
    { key: '_actions', label: 'Actions', width: '12%',
      render: (o) => {
        const canEdit = o.paymentStatus === 'pending';
        return (
          <div className="flex gap-1">
            <button
              onClick={() => openItemsModal(o)}
              disabled={!canEdit}
              title={canEdit ? 'Edit items' : 'Only pending orders can edit items'}
              className={`text-[11px] px-2 py-1 rounded border ${
                canEdit
                  ? 'border-ceramic-gold-matte text-ceramic-gold-deep hover:bg-ceramic-gold-matte hover:text-white'
                  : 'border-ceramic-border text-ceramic-ash/50 cursor-not-allowed'
              }`}
            >
              Edit Items
            </button>
          </div>
        );
      } },
  ], [openItemsModal]);

  const saveItems = async () => {
    if (!editing) return;
    if (!items.length) return showToast({ type: 'error', text: 'Items cannot be empty' });
    setSaving(true);
    try {
      await OrdersApi.updateItems(String(editing._id || (editing as any).id), items);
      showToast({ type: 'success', text: 'Order items updated, amount recalculated' });
      setEditing(null);
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Update failed' });
    } finally { setSaving(false); }
  };

  const itemsTotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0),
    [items]
  );

  return (
    <>
      <ConsoleListPageView<ConsoleOrder>
        testId="console-orders"
        pageTitle="Orders"
        pageSubtitle="All orders across public store and CRM sales channels. Retail orders (TRC20-USDT) and Dealer orders are unified here, with CRM links to Customer / Inquiry / Quote where applicable."
        Icon={ShoppingCart}
        fetcher={(p) => Console.listOrders(p)}
        columns={columns}
        filters={FILTERS}
        onEdit={(row) => {
          const ns = window.prompt(`Set Payment Status for ${row.orderNo || 'Order'} (pending/paid/expired/failed/refunded/cancelled):`, row.paymentStatus);
          if (!ns) return;
          Console.updateOrder(String(row._id || row.id), { paymentStatus: ns.toLowerCase() as any })
            .then(() => showToast({ type: 'success', text: 'Order payment status updated' }))
            .catch((e: any) => showToast({ type: 'error', text: e?.message || 'Update failed' }));
        }}
      />

      {/* 编辑商品项弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-3xl shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
              <div>
                <h3 className="serif-heading text-[20px]">Edit Items</h3>
                <div className="text-[11px] text-ceramic-ash font-mono">{editing.orderNo} · {editing.paymentStatus}</div>
              </div>
              <button onClick={() => setEditing(null)} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2 items-end border border-ceramic-border p-3 rounded">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-ceramic-ash mb-1">Item Name</div>
                    <input className="input !py-2 text-sm w-full" value={it.name || ''} onChange={e => setItems(arr => arr.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} placeholder="Item name" />
                  </div>
                  <div className="w-28">
                    <div className="text-[10px] text-ceramic-ash mb-1">Price (USD)</div>
                    <input type="number" step="0.01" className="input !py-2 text-sm w-full" value={it.price ?? 0} onChange={e => setItems(arr => arr.map((x, i) => i === idx ? { ...x, price: Number(e.target.value) } : x))} />
                  </div>
                  <div className="w-20">
                    <div className="text-[10px] text-ceramic-ash mb-1">Qty</div>
                    <input type="number" min={1} className="input !py-2 text-sm w-full" value={it.qty ?? 1} onChange={e => setItems(arr => arr.map((x, i) => i === idx ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x))} />
                  </div>
                  <div className="text-right w-24">
                    <div className="text-[10px] text-ceramic-ash mb-1">Subtotal</div>
                    <div className="font-semibold text-ceramic-graphite">${((Number(it.price) || 0) * (Number(it.qty) || 1)).toFixed(2)}</div>
                  </div>
                  <button onClick={() => setItems(arr => arr.filter((_, i) => i !== idx))} className="p-2 text-ceramic-ash hover:text-red-500" aria-label="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button onClick={() => setItems(arr => [...arr, { productId: '', name: '', price: 0, qty: 1, image: '' }])} className="btn-gold-outline !py-2 !text-[11px]">
                <Plus size={14} /> Add Item
              </button>
              <div className="flex justify-between items-center border-t border-ceramic-border pt-4 mt-2">
                <div>
                  <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash">Total (USD)</span>
                  <span className="serif-heading text-[22px] gold-text ms-3">${itemsTotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
                  <button onClick={saveItems} disabled={saving || !items.length} className="btn-gold">
                    {saving ? <Loader2 className="animate-spin" size={16} /> : 'Save Items'}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-ceramic-ash">Note: prices for items with productId will be re-verified against the Product DB on the backend (anti-tampering).</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default Orders;

/**
 * PHASE 2-A：Orders 列表页（真实数据 + 复用现有 Order Model，关联 customerId/inquiryId/quoteId）
 *
 * 新增：行级"Edit Items"按钮 → 弹窗增删改商品项，调用 PATCH /orders/:id/items 重算金额（仅 pending 可编辑）
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ShoppingCart, Package, Plus, Trash2, X, Loader2, Eye } from 'lucide-react';
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
    render: (o) => <span className="font-semibold text-ceramic-graphite">${(o.totalAmount || o.usdtAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
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
    render: (o) => o.createdAt ? new Date(o.createdAt).toLocaleString() : '' },
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

// 详情弹窗辅助组件
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-2 border-b border-ceramic-border pb-1">{title}</h4>
    {children}
  </div>
);
const Grid2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
);
const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="min-w-0">
    <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash mb-0.5">{label}</div>
    <div className={`text-sm text-ceramic-graphite break-words ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
);

const Orders: React.FC = () => {
  const { showToast } = useApp();
  const [editing, setEditing] = useState<ConsoleOrder | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<ConsoleOrder | null>(null);

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
          <div className="flex gap-1 items-center">
            <button
              onClick={() => setViewing(o)}
              className="p-1.5 text-ceramic-ash hover:text-ceramic-gold-deep border border-ceramic-border rounded"
              title="View detail"
              aria-label="View detail"
            >
              <Eye size={14} />
            </button>
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
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!String(it.name || '').trim()) return showToast({ type: 'error', text: `Item ${i + 1}: name is required` });
      if (!(Number(it.price) > 0)) return showToast({ type: 'error', text: `Item ${i + 1}: price must be greater than 0` });
      if (!(Number(it.qty) >= 1)) return showToast({ type: 'error', text: `Item ${i + 1}: qty must be at least 1` });
    }
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
          const valid = ['pending','paid','expired','failed','refunded','cancelled'];
          const status = ns.toLowerCase().trim();
          if (!valid.includes(status)) return showToast({ type: 'error', text: `Invalid status. Valid: ${valid.join(', ')}` });
          Console.updateOrder(String(row._id || row.id), { paymentStatus: status as any })
            .then(() => {
              showToast({ type: 'success', text: 'Order payment status updated' });
              setTimeout(() => window.location.reload(), 800);
            })
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

      {/* 订单详情弹窗 */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-3xl shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
              <div className="min-w-0">
                <h3 className="serif-heading text-[20px]">Order Detail</h3>
                <div className="text-[11px] text-ceramic-ash font-mono truncate">{viewing.orderNo || '---'} · {viewing.orderType}</div>
              </div>
              <button onClick={() => setViewing(null)} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* 基本信息 */}
              <Section title="Basic Info">
                <Grid2>
                  <Field label="Order No." value={viewing.orderNo || '---'} mono />
                  <Field label="Type" value={viewing.orderType || '---'} />
                  <Field label="Payment Status" value={<PaymentChip s={viewing.paymentStatus} />} />
                  <Field label="Created At" value={viewing.createdAt ? new Date(viewing.createdAt).toLocaleString() : '---'} />
                  {viewing.paidAt && <Field label="Paid At" value={new Date(viewing.paidAt).toLocaleString()} />}
                  {(viewing as any).expiredAt && <Field label="Expired At" value={new Date((viewing as any).expiredAt).toLocaleString()} />}
                </Grid2>
              </Section>

              {/* 收货地址 - 重点突出 */}
              <Section title="Shipping Address">
                <div className="bg-ceramic-cream/30 border border-ceramic-gold-matte/30 rounded p-4 space-y-1">
                  <div className="font-medium text-ceramic-graphite">{viewing.contactInfo?.name || '---'}</div>
                  <div className="text-sm text-ceramic-graphite">{viewing.contactInfo?.shippingAddress || '---'}</div>
                  {viewing.contactInfo?.shippingAddress2 && <div className="text-sm text-ceramic-graphite">{viewing.contactInfo.shippingAddress2}</div>}
                  <div className="text-sm text-ceramic-graphite">
                    {[viewing.contactInfo?.shippingCity, viewing.contactInfo?.shippingState, viewing.contactInfo?.shippingZip].filter(Boolean).join(', ') || '---'}
                  </div>
                  {viewing.contactInfo?.shippingCountry && <div className="text-sm text-ceramic-graphite">{viewing.contactInfo.shippingCountry}</div>}
                </div>
              </Section>

              {/* 客户联系信息 */}
              <Section title="Contact Info">
                <Grid2>
                  <Field label="Name" value={viewing.contactInfo?.name || '---'} />
                  <Field label="Email" value={viewing.contactInfo?.email || '---'} />
                  <Field label="Phone" value={viewing.contactInfo?.phone || '---'} />
                  <Field label="WhatsApp" value={viewing.contactInfo?.whatsapp || '---'} />
                  <Field label="Company" value={viewing.contactInfo?.company || '---'} />
                  <Field label="Country" value={viewing.contactInfo?.country || '---'} />
                </Grid2>
              </Section>

              {/* 商品列表 */}
              <Section title={`Items (${viewing.items?.length || 0})`}>
                <div className="border border-ceramic-border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-ceramic-cream/50 text-[11px] tracking-luxury uppercase text-ceramic-ash">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-right p-2 w-24">Price</th>
                        <th className="text-center p-2 w-16">Qty</th>
                        <th className="text-right p-2 w-28">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewing.items || []).map((it, i) => (
                        <tr key={i} className="border-t border-ceramic-border">
                          <td className="p-2 text-ceramic-graphite">{it.name || '---'}</td>
                          <td className="p-2 text-right text-ceramic-graphite">${Number(it.price || 0).toFixed(2)}</td>
                          <td className="p-2 text-center text-ceramic-graphite">{it.qty || 0}</td>
                          <td className="p-2 text-right font-semibold text-ceramic-graphite">${(Number(it.price || 0) * Number(it.qty || 0)).toFixed(2)}</td>
                        </tr>
                      ))}
                      {(viewing.items?.length || 0) === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-ceramic-ash text-sm">No items</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ceramic-gold-matte bg-ceramic-cream/30">
                        <td colSpan={3} className="p-2 text-right text-[11px] tracking-luxury uppercase text-ceramic-ash">Total (USD)</td>
                        <td className="p-2 text-right serif-heading text-[16px] gold-text">${(viewing.totalAmount || 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>

              {/* 支付信息 */}
              <Section title="Payment">
                <Grid2>
                  <Field label="Amount (USD)" value={`$${(viewing.totalAmount || 0).toFixed(2)}`} />
                  <Field label="USDT Amount" value={`${(viewing.usdtAmount || 0).toFixed(6)} USDT`} />
                  <Field label="Wallet Address" value={(viewing as any).walletAddress || '---'} mono />
                  {viewing.txHash && <Field label="Tx Hash" value={viewing.txHash} mono />}
                  {(viewing as any).orderExpireAt && <Field label="Expire At" value={new Date((viewing as any).orderExpireAt).toLocaleString()} />}
                </Grid2>
              </Section>

              {/* CRM 关联 */}
              {(viewing.customerId || viewing.inquiryId || viewing.quoteId) && (
                <Section title="CRM Links">
                  <Grid2>
                    {viewing.customerId && <Field label="Customer" value={viewing.customerId} mono />}
                    {viewing.inquiryId && <Field label="Inquiry" value={viewing.inquiryId} mono />}
                    {viewing.quoteId && <Field label="Quote" value={viewing.quoteId} mono />}
                  </Grid2>
                </Section>
              )}

              {/* 经销商信息 */}
              {viewing.dealerInfo && (
                <Section title="Dealer Info">
                  <Grid2>
                    <Field label="Company" value={viewing.dealerInfo.company || '---'} />
                    <Field label="WhatsApp" value={viewing.dealerInfo.whatsapp || '---'} />
                    <Field label="Country" value={viewing.dealerInfo.country || '---'} />
                  </Grid2>
                </Section>
              )}

              {/* 客户需求 */}
              {viewing.customDemand && (
                <Section title="Customer Demand">
                  <div className="text-sm text-ceramic-graphite bg-ceramic-cream/30 p-3 rounded">{viewing.customDemand}</div>
                </Section>
              )}
            </div>
            <div className="flex justify-end p-5 border-t border-ceramic-border">
              <button onClick={() => setViewing(null)} className="btn-gold">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default Orders;

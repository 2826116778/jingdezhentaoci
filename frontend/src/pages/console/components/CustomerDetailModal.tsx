/**
 * PHASE 2-A: Customer 360 Detail Modal (Timeline + Inquiries + Quotes + Orders + FollowUps + Tasks)
 */
import React, { useEffect, useState } from 'react';
import { X, Clock, MessageSquare, FileText, ShoppingCart, MessageCircle, ListTodo, Plus, History } from 'lucide-react';
import type { ConsoleCustomerDetail, ConsoleInquiry, ConsoleQuote, ConsoleOrder, ConsoleInteraction, ConsoleFollowUp, ConsoleTask } from '../../../types';

interface Props {
  open: boolean;
  detail: ConsoleCustomerDetail | null;
  onLoad: () => void;
  onClose: () => void;
  onAddFollowUp: (customerId: string) => void;
}

type Tab = 'timeline' | 'inquiries' | 'quotes' | 'orders' | 'followups' | 'tasks';

const CustomerDetailModal: React.FC<Props> = ({ open, detail, onLoad, onClose, onAddFollowUp }) => {
  const [tab, setTab] = useState<Tab>('timeline');

  useEffect(() => { if (open && !detail) onLoad(); }, [open, detail, onLoad]);
  useEffect(() => { if (open) setTab('timeline'); }, [open]);

  if (!open) return null;

  const customer = detail;
  const company: any = customer?.company || {};
  const cid = String(customer?._id || '');

  const TABS: Array<{ key: Tab; label: string; icon: any; count: number }> = [
    { key: 'timeline',  label: 'Timeline',  icon: History,       count: customer?.timeline?.length  ?? 0 },
    { key: 'inquiries', label: 'Inquiries', icon: MessageSquare, count: customer?.inquiries?.length ?? 0 },
    { key: 'quotes',    label: 'Quotes',    icon: FileText,      count: customer?.quotes?.length    ?? 0 },
    { key: 'orders',    label: 'Orders',    icon: ShoppingCart,  count: customer?.orders?.length    ?? 0 },
    { key: 'followups', label: 'Follow-Ups',icon: MessageCircle, count: customer?.followups?.length ?? 0 },
    { key: 'tasks',     label: 'Tasks',     icon: ListTodo,      count: customer?.tasks?.length     ?? 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-6xl shadow-xl my-8">
        {/* Header */}
        <div className="p-5 border-b border-ceramic-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="serif-heading text-[22px] truncate">{company?.name || customer?.customerCode || 'Customer'}</h3>
                {customer?.customerCode && (
                  <span className="font-mono text-[11px] text-ceramic-gold-matte border border-ceramic-gold-matte/30 px-2 py-0.5 rounded">{customer.customerCode}</span>
                )}
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${
                  customer?.customerLevel === 'PLATINUM' ? 'bg-slate-200 border-slate-400 text-slate-800 font-semibold' :
                  customer?.customerLevel === 'GOLD' ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold' :
                  customer?.customerLevel === 'SILVER' ? 'bg-gray-100 border-gray-300 text-gray-700 font-semibold' :
                  customer?.customerLevel === 'BRONZE' ? 'bg-orange-50 border-orange-300 text-orange-800' :
                  'bg-cyan-50 border-cyan-200 text-cyan-700'
                }`}>{customer?.customerLevel || 'PROSPECT'}</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${
                  customer?.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  customer?.status === 'AT_RISK' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                  customer?.status === 'CHURNED' ? 'bg-red-50 border-red-200 text-red-700' :
                  'bg-gray-100 border-gray-200 text-gray-700'
                }`}>{customer?.status || 'ACTIVE'}</span>
              </div>
              <div className="mt-2 text-[13px] text-ceramic-ash flex flex-wrap gap-x-4 gap-y-1">
                {company?.country && <span>Country: {company.country}</span>}
                {company?.industry && <span>Industry: {company.industry}</span>}
                {company?.website && <a href={company.website} target="_blank" rel="noreferrer" className="text-ceramic-gold-matte hover:underline truncate">{company.website}</a>}
                {customer?.source && <span>Source: {customer.source}</span>}
                {customer?.score !== undefined && <span>Score: {customer.score}/100</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => cid && onAddFollowUp(cid)} className="btn-gold-outline !py-2 !px-3 text-[12px] flex items-center gap-1.5">
                <Plus size={13} /> Follow-Up
              </button>
              <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 border-b border-ceramic-border bg-ceramic-cream/30 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-[12px] whitespace-nowrap border-b-2 flex items-center gap-1.5 transition-colors ${
                tab === t.key ? 'border-ceramic-gold text-ceramic-graphite font-semibold' : 'border-transparent text-ceramic-ash hover:text-ceramic-graphite'
              }`}>
              <t.icon size={13} />
              {t.label} <span className="px-1.5 py-0.5 rounded bg-white/60 text-[10px]">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {tab === 'timeline'  && <TimelineView items={customer?.timeline || []} />}
          {tab === 'inquiries' && <InquiriesView items={customer?.inquiries || []} />}
          {tab === 'quotes'    && <QuotesView items={customer?.quotes || []} />}
          {tab === 'orders'    && <OrdersView items={customer?.orders || []} />}
          {tab === 'followups' && <FollowUpsView items={customer?.followups || []} />}
          {tab === 'tasks'     && <TasksView items={customer?.tasks || []} />}
        </div>
      </div>
    </div>
  );
};

function Empty({ title }: { title: string }) {
  return (
    <div className="py-12 text-center text-ceramic-ash text-[13px]">
      <Clock size={30} className="mx-auto mb-3 opacity-30" />
      No {title} yet.
    </div>
  );
}

function TimelineView({ items }: { items: ConsoleInteraction[] }) {
  if (items.length === 0) return <Empty title="timeline events" />;
  return (
    <div className="relative pl-6 space-y-5 border-l border-ceramic-border">
      {items.slice().sort((a, b) => +new Date(b.occurredAt || b.createdAt) - +new Date(a.occurredAt || a.createdAt)).map(it => (
        <div key={it._id || it.id || String(Math.random())} className="relative">
          <span className="absolute -left-[30px] top-1 w-3 h-3 rounded-full bg-ceramic-gold-matte border-2 border-white shadow" />
          <div className="text-[11px] text-ceramic-ash mb-1 flex gap-2">
            <span className="font-mono">{new Date(it.occurredAt || it.createdAt).toLocaleString()}</span>
            <span className="px-2 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border font-semibold text-ceramic-graphite">{it.type}</span>
          </div>
          <div className="text-[14px] font-medium text-ceramic-graphite">{it.title}</div>
          {it.content && <div className="text-[13px] text-ceramic-ash mt-1 whitespace-pre-wrap">{it.content}</div>}
        </div>
      ))}
    </div>
  );
}

function InquiriesView({ items }: { items: ConsoleInquiry[] }) {
  if (items.length === 0) return <Empty title="inquiries" />;
  return (
    <table className="w-full text-[13px]">
      <thead><tr className="text-[11px] uppercase text-ceramic-ash">
        <th className="text-left py-2 px-2">Subject / Message</th>
        <th className="text-left py-2 px-2">Stage</th>
        <th className="text-left py-2 px-2">Priority</th>
        <th className="text-left py-2 px-2">Value</th>
        <th className="text-left py-2 px-2">Date</th>
      </tr></thead>
      <tbody>
        {items.map(i => (
          <tr key={i._id || i.id} className="border-t border-ceramic-border">
            <td className="py-2 px-2">
              <div className="font-medium text-ceramic-graphite">{i.subject || i.productName || 'Inquiry'}</div>
              <div className="text-[11px] text-ceramic-ash line-clamp-1">{i.message || i.customDemand}</div>
            </td>
            <td className="py-2 px-2"><span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">{i.stage || i.status}</span></td>
            <td className="py-2 px-2"><span className="text-[11px]">{i.priority || '---'}</span></td>
            <td className="py-2 px-2 text-[12px]">{i.estimatedValue ? `$${i.estimatedValue.toLocaleString()}` : '---'}</td>
            <td className="py-2 px-2 text-[12px] text-ceramic-ash">{new Date(i.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QuotesView({ items }: { items: ConsoleQuote[] }) {
  if (items.length === 0) return <Empty title="quotes" />;
  return (
    <table className="w-full text-[13px]">
      <thead><tr className="text-[11px] uppercase text-ceramic-ash">
        <th className="text-left py-2 px-2">Quote No.</th>
        <th className="text-left py-2 px-2">Status</th>
        <th className="text-left py-2 px-2">Items</th>
        <th className="text-left py-2 px-2">Total</th>
        <th className="text-left py-2 px-2">Valid Until</th>
        <th className="text-left py-2 px-2">Created</th>
      </tr></thead>
      <tbody>
        {items.map(q => (
          <tr key={q._id || q.id} className="border-t border-ceramic-border">
            <td className="py-2 px-2 font-mono text-ceramic-gold-matte font-semibold">{q.quoteNo}</td>
            <td className="py-2 px-2"><span className={`text-[11px] px-2 py-0.5 rounded-full border ${
              q.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              q.status === 'SENT' ? 'bg-sky-50 text-sky-700 border-sky-200' :
              q.status === 'DRAFT' ? 'bg-gray-100 text-gray-700 border-gray-200' :
              q.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
              q.status === 'EXPIRED' ? 'bg-amber-50 text-amber-800 border-amber-200' :
              'bg-purple-50 text-purple-700 border-purple-200'
            }`}>{q.status}</span></td>
            <td className="py-2 px-2 text-[12px]">{q.items?.length || 0} items</td>
            <td className="py-2 px-2 font-semibold">{q.currency || 'USD'} {q.total?.toLocaleString() || 0}</td>
            <td className="py-2 px-2 text-[12px] text-ceramic-ash">{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '---'}</td>
            <td className="py-2 px-2 text-[12px] text-ceramic-ash">{new Date(q.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrdersView({ items }: { items: ConsoleOrder[] }) {
  if (items.length === 0) return <Empty title="orders" />;
  return (
    <table className="w-full text-[13px]">
      <thead><tr className="text-[11px] uppercase text-ceramic-ash">
        <th className="text-left py-2 px-2">Order No.</th>
        <th className="text-left py-2 px-2">Type</th>
        <th className="text-left py-2 px-2">Payment</th>
        <th className="text-left py-2 px-2">Amount</th>
        <th className="text-left py-2 px-2">Items</th>
        <th className="text-left py-2 px-2">Created</th>
      </tr></thead>
      <tbody>
        {items.map(o => (
          <tr key={o._id || o.id} className="border-t border-ceramic-border">
            <td className="py-2 px-2 font-mono text-ceramic-gold-matte font-semibold">{o.orderNo}</td>
            <td className="py-2 px-2 text-[12px]">{o.orderType}</td>
            <td className="py-2 px-2"><span className={`text-[11px] px-2 py-0.5 rounded-full border ${
              o.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              o.paymentStatus === 'pending' ? 'bg-amber-50 text-amber-800 border-amber-200' :
              o.paymentStatus === 'expired' ? 'bg-red-50 text-red-700 border-red-200' :
              'bg-gray-100 text-gray-700 border-gray-200'
            }`}>{o.paymentStatus}</span></td>
            <td className="py-2 px-2 font-semibold">USD {(o.totalAmount || o.usdtAmount || 0).toLocaleString()}</td>
            <td className="py-2 px-2 text-[12px]">{o.items?.length || 0} items</td>
            <td className="py-2 px-2 text-[12px] text-ceramic-ash">{new Date(o.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FollowUpsView({ items }: { items: ConsoleFollowUp[] }) {
  if (items.length === 0) return <Empty title="follow-ups" />;
  return (
    <div className="space-y-3">
      {items.map(f => (
        <div key={f._id || f.id} className="border border-ceramic-border rounded p-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border">{f.type}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
              f.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              f.status === 'PENDING' ? 'bg-sky-50 text-sky-700 border-sky-200' :
              f.status === 'OVERDUE' ? 'bg-red-50 text-red-700 border-red-200' :
              'bg-gray-100 text-gray-700 border-gray-200'
            }`}>{f.status}</span>
            <span className="text-[11px] text-ceramic-ash ml-auto">{f.scheduledAt ? new Date(f.scheduledAt).toLocaleString() : ''}</span>
          </div>
          {f.content && <div className="text-[13px] text-ceramic-graphite whitespace-pre-wrap">{f.content}</div>}
          {f.result && <div className="text-[12px] text-ceramic-ash mt-2 pt-2 border-t border-ceramic-border/50"><strong>Result: </strong>{f.result}</div>}
        </div>
      ))}
    </div>
  );
}

function TasksView({ items }: { items: ConsoleTask[] }) {
  if (items.length === 0) return <Empty title="tasks" />;
  return (
    <div className="space-y-2">
      {items.map(t => (
        <div key={t._id || t.id} className="border border-ceramic-border rounded p-4 flex items-start gap-3">
          <div className={`w-2 h-2 shrink-0 mt-1.5 rounded-full ${
            t.priority === 'URGENT' ? 'bg-red-600' : t.priority === 'HIGH' ? 'bg-orange-500' :
            t.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-400'
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-ceramic-graphite">{t.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-ceramic-cream">{t.type}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                t.status === 'TODO' ? 'bg-sky-100 text-sky-800' :
                t.status === 'BLOCKED' ? 'bg-red-100 text-red-800' :
                'bg-purple-100 text-purple-800'
              }`}>{t.status}</span>
            </div>
            {t.description && <div className="text-[12px] text-ceramic-ash mt-1 line-clamp-2">{t.description}</div>}
            {t.dueAt && <div className="text-[11px] text-ceramic-ash mt-1">Due: {new Date(t.dueAt).toLocaleDateString()}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default CustomerDetailModal;

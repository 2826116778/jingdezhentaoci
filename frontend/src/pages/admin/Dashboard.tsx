import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Package2, FolderKanban, Mail, ArrowUpRight, ArrowDownRight, Clock,
  DollarSign, Users, ShoppingCart, RefreshCw, Download, FileText,
  User2, Building2, Edit3, X, Save, MessageCircle
} from 'lucide-react';
import { Admin, Orders } from '../../api';
import type { DashboardSummary, OrderListItem, DealerInfo } from '../../types';
import { useApp } from '../../context/AppContext';
import { secondsToMMSS } from '../../utils';

const KPI_BOX = ({
  label, value, delta, deltaUp, icon: Icon, accent,
}: { label: string; value: React.ReactNode; delta?: string; deltaUp?: boolean; icon: any; accent: string }) => (
  <div className="gold-card p-6 md:p-7 hover:shadow-gold transition-shadow">
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-2">{label}</div>
        <div className="serif-heading text-[32px] leading-none">{value}</div>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${accent}`}>
        <Icon size={22} />
      </div>
    </div>
    {delta && (
      <div className={`flex items-center gap-1 text-[12px] ${deltaUp ? 'text-emerald-600' : 'text-rose-600'}`}>
        {deltaUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {delta}
      </div>
    )}
  </div>
);

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useApp();
  const [sum, setSum] = useState<DashboardSummary | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dealerModal, setDealerModal] = useState<OrderListItem | null>(null);
  const [dealerEditing, setDealerEditing] = useState(false);
  const [dealerSaving, setDealerSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([Admin.dashboard(), Orders.list({ limit: 8 })]);
      setSum(s);
      setOrders(o.list || []);
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const exportInq = async () => {
    setExporting(true);
    try {
      const blob = await Admin.exportInquiries();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast({ type: 'success', text: t('admin.inquiries.export_ok') });
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setExporting(false); }
  };

  const statusBadge = (st: string) => {
    const map: any = {
      paid:    ['bg-emerald-500 text-white', t('checkout.status_paid')],
      pending: ['bg-amber-500 text-white',   t('checkout.status_pending')],
      expired: ['bg-rose-500 text-white',    t('checkout.status_expired')],
      cancelled: ['bg-zinc-400 text-white',  'Cancelled'],
    };
    const [cls, txt] = map[st] || ['bg-zinc-400 text-white', st];
    return <span className={`badge ${cls}`}>{txt}</span>;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="serif-heading text-[28px] md:text-[34px] leading-tight mb-1">{t('admin.dashboard.title')}</h2>
          <p className="text-ceramic-ash text-sm">{t('admin.dashboard.sub')}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="btn-gold-outline !py-2 !px-4 text-[12px]">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {t('admin.dashboard.btn_refresh')}
          </button>
          <button onClick={exportInq} disabled={exporting} className="btn-gold !py-2 !px-4 text-[12px]">
            <Download size={13} /> {exporting ? '…' : t('admin.inquiries.export')}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI_BOX label={t('admin.dashboard.kpi_revenue')}
          value={loading ? '—' : `$${(sum?.revenuePaid || 0).toFixed(2)}`}
          icon={DollarSign} accent="bg-ceramic-gold-matte/10 text-ceramic-gold-matte"
          delta={sum ? t('admin.dashboard.kpi_paid_orders', { n: sum.ordersPaid }) : undefined} deltaUp />
        <KPI_BOX label={t('admin.dashboard.kpi_orders')}
          value={loading ? '—' : sum?.ordersTotal || 0}
          icon={ShoppingCart} accent="bg-sky-100 text-sky-700"
          delta={sum ? `${sum?.ordersPending || 0} ${t('admin.dashboard.kpi_orders_pending')}` : undefined}
          deltaUp={false} />
        <KPI_BOX label={t('admin.dashboard.kpi_products')}
          value={loading ? '—' : sum?.productsTotal || 0}
          icon={Package2} accent="bg-emerald-100 text-emerald-700" />
        <KPI_BOX label={t('admin.dashboard.kpi_inquiries')}
          value={loading ? '—' : sum?.inquiriesTotal || 0}
          icon={Mail} accent="bg-amber-100 text-amber-700"
          delta={sum ? `${sum?.inquiriesUnread || 0} ${t('admin.inquiries.status_new')}` : undefined} deltaUp={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* 最近订单表 */}
        <div className="gold-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-ceramic-border">
            <h3 className="serif-heading text-[20px] flex items-center gap-2">
              <ShoppingCart size={18} className="text-ceramic-gold-matte" /> {t('admin.dashboard.recent_orders')}
            </h3>
            <Link to="/admin/products" className="text-[12px] tracking-luxury uppercase text-ceramic-gold-matte hover:underline">
              {t('cta.view_all')}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] tracking-luxury uppercase text-ceramic-ash bg-ceramic-offWhite/70">
                  <th className="px-6 py-4 text-start">{t('admin.dashboard.t_order')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.dashboard.t_type')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.dashboard.t_amount')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.dashboard.t_status')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.dashboard.t_created')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.dashboard.t_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="p-10 text-center text-ceramic-ash">{t('common.loading')}</td></tr>}
                {!loading && orders.length === 0 && (
                  <tr><td colSpan={6} className="p-10 text-center text-ceramic-ash">{t('admin.dashboard.no_orders')}</td></tr>
                )}
                {orders.map(o => (
                  <tr key={o._id} className="border-t border-ceramic-border/60 hover:bg-ceramic-offWhite/50">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs">{o.orderNo}</div>
                      <div className="text-ceramic-ash text-[12px] mt-0.5">{o.contactInfo?.name || o.contactInfo?.email || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      {o.orderType === 'dealer' ? (
                        <span className="badge bg-violet-500 text-white whitespace-nowrap"><Building2 size={11} /> {t('checkout.type_dealer')}</span>
                      ) : (
                        <span className="badge bg-sky-500 text-white whitespace-nowrap"><User2 size={11} /> {t('checkout.type_retail')}</span>
                      )}
                      {o.orderType === 'dealer' && o.dealerInfo?.whatsapp && (
                        <div className="text-[11px] text-ceramic-ash mt-1 font-mono truncate max-w-[160px]">
                          <MessageCircle size={10} className="inline mr-1" />{o.dealerInfo.whatsapp}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 serif-heading gold-text text-[16px]">${o.amount.toFixed(2)}</td>
                    <td className="px-6 py-4">{statusBadge(o.paymentStatus)}</td>
                    <td className="px-6 py-4 text-ceramic-ash text-[12px]">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className="btn-gold-outline !py-1 !px-3 !text-[11px] flex items-center gap-1"
                        onClick={() => { setDealerModal(o); setDealerEditing(false); }}
                      >
                        <Edit3 size={12} /> {t('admin.dashboard.btn_dealer')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右侧：待办 + 快捷入口 */}
        <div className="space-y-6">
          <div className="gold-card p-6">
            <h3 className="serif-heading text-[20px] mb-5 flex items-center gap-2">
              <Clock size={18} className="text-ceramic-gold-matte" /> {t('admin.dashboard.actions')}
            </h3>
            <div className="space-y-3">
              <Link to="/admin/inquiries?status=new" className="flex items-center justify-between p-4 border border-ceramic-border hover:border-ceramic-gold-matte rounded-sm transition-colors">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-ceramic-gold-matte" />
                  <div>
                    <div className="text-[14px]">{t('admin.dashboard.a_new_inq')}</div>
                    <div className="text-[11px] text-ceramic-ash">{sum?.inquiriesUnread || 0} {t('admin.inquiries.status_new')}</div>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-ceramic-gold-matte" />
              </Link>
              <Link to="/admin/cases" className="flex items-center justify-between p-4 border border-ceramic-border hover:border-ceramic-gold-matte rounded-sm transition-colors">
                <div className="flex items-center gap-3">
                  <FolderKanban size={18} className="text-ceramic-gold-matte" />
                  <div>
                    <div className="text-[14px]">{t('admin.dashboard.a_manage_cases')}</div>
                    <div className="text-[11px] text-ceramic-ash">{t('cases.title')}</div>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-ceramic-gold-matte" />
              </Link>
              <Link to="/admin/products" className="flex items-center justify-between p-4 border border-ceramic-border hover:border-ceramic-gold-matte rounded-sm transition-colors">
                <div className="flex items-center gap-3">
                  <Package2 size={18} className="text-ceramic-gold-matte" />
                  <div>
                    <div className="text-[14px]">{t('admin.dashboard.a_manage_products')}</div>
                    <div className="text-[11px] text-ceramic-ash">{sum?.productsTotal || 0} {t('nav.products')}</div>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-ceramic-gold-matte" />
              </Link>
            </div>
          </div>

          <div className="gold-card p-6 bg-ceramic-offWhite/60">
            <h3 className="serif-heading text-[20px] mb-5 flex items-center gap-2">
              <FileText size={18} className="text-ceramic-gold-matte" /> {t('admin.dashboard.payment_watch')}
            </h3>
            <div className="text-[12px] text-ceramic-ash leading-relaxed mb-4">{t('admin.dashboard.payment_watch_desc')}</div>
            <div className="flex items-center justify-between text-[12px]">
              <div><span className="text-ceramic-graphite">{sum?.ordersPending || 0}</span> {t('admin.dashboard.kpi_orders_pending')}</div>
              <div><span className="text-ceramic-graphite">{sum?.ordersPaid || 0}</span> {t('checkout.status_paid')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 经销商信息编辑弹窗 */}
      {dealerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="gold-card max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-ceramic-border sticky top-0 bg-white z-10">
              <div>
                <h3 className="serif-heading text-[22px] flex items-center gap-2">
                  <Building2 size={18} className="text-ceramic-gold-matte" />
                  {dealerModal.orderType === 'dealer' ? t('admin.dashboard.dealer_title') : t('admin.dashboard.customer_title')}
                </h3>
                <div className="text-[11px] text-ceramic-ash mt-1 font-mono">{dealerModal.orderNo}</div>
              </div>
              <button onClick={() => setDealerModal(null)} className="btn-ghost !p-2">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 客户类型 */}
              <div>
                <label className="label mb-1.5">{t('admin.dashboard.t_type')}</label>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 py-2 text-sm rounded-sm border transition ${
                      dealerModal.orderType === 'retail'
                        ? 'border-ceramic-gold-matte bg-ceramic-gold-matte/5 text-ceramic-gold-matte'
                        : 'border-ceramic-border text-ceramic-ash'
                    }`}
                    onClick={() => setDealerModal({ ...dealerModal, orderType: 'retail' })}
                  >
                    <User2 size={14} className="inline mr-1" /> {t('checkout.type_retail')}
                  </button>
                  <button
                    className={`flex-1 py-2 text-sm rounded-sm border transition ${
                      dealerModal.orderType === 'dealer'
                        ? 'border-violet-500 bg-violet-500/5 text-violet-600'
                        : 'border-ceramic-border text-ceramic-ash'
                    }`}
                    onClick={() => setDealerModal({ ...dealerModal, orderType: 'dealer' })}
                  >
                    <Building2 size={14} className="inline mr-1" /> {t('checkout.type_dealer')}
                  </button>
                </div>
              </div>

              {dealerModal.orderType === 'dealer' && (
                <>
                  {/* 经销商 WhatsApp */}
                  <div>
                    <label className="label mb-1.5">{t('checkout.c_whatsapp')} <span className="text-rose-500">*</span></label>
                    <input
                      className="input"
                      value={dealerModal.dealerInfo?.whatsapp || dealerModal.contactInfo?.whatsapp || ''}
                      placeholder="+971 xxx xxxxx"
                      onChange={e => setDealerModal({
                        ...dealerModal,
                        dealerInfo: { ...(dealerModal.dealerInfo || {}), whatsapp: e.target.value },
                        contactInfo: { ...dealerModal.contactInfo, whatsapp: e.target.value },
                      })}
                    />
                    <p className="text-[11px] text-ceramic-ash mt-1">{t('admin.dashboard.whatsapp_hint')}</p>
                  </div>

                  {/* 公司名 */}
                  <div>
                    <label className="label mb-1.5">{t('checkout.c_company')}</label>
                    <input
                      className="input"
                      value={dealerModal.dealerInfo?.company || dealerModal.contactInfo?.company || ''}
                      onChange={e => setDealerModal({
                        ...dealerModal,
                        dealerInfo: { ...(dealerModal.dealerInfo || {}), company: e.target.value },
                        contactInfo: { ...dealerModal.contactInfo, company: e.target.value },
                      })}
                    />
                  </div>

                  {/* 国家 */}
                  <div>
                    <label className="label mb-1.5">{t('checkout.c_country')}</label>
                    <input
                      className="input"
                      value={dealerModal.dealerInfo?.country || dealerModal.contactInfo?.country || ''}
                      onChange={e => setDealerModal({
                        ...dealerModal,
                        dealerInfo: { ...(dealerModal.dealerInfo || {}), country: e.target.value },
                        contactInfo: { ...dealerModal.contactInfo, country: e.target.value },
                      })}
                    />
                  </div>

                  {/* 网站 */}
                  <div>
                    <label className="label mb-1.5">{t('admin.dashboard.website')}</label>
                    <input
                      className="input"
                      placeholder="https://..."
                      value={dealerModal.dealerInfo?.website || ''}
                      onChange={e => setDealerModal({
                        ...dealerModal,
                        dealerInfo: { ...(dealerModal.dealerInfo || {}), website: e.target.value },
                      })}
                    />
                  </div>

                  {/* 标签 */}
                  <div>
                    <label className="label mb-1.5">{t('admin.dashboard.tags')}</label>
                    <input
                      className="input"
                      placeholder="Comma separated: VIP, Wholesale, Hotel"
                      value={(dealerModal.dealerInfo?.tags || []).join(', ')}
                      onChange={e => setDealerModal({
                        ...dealerModal,
                        dealerInfo: {
                          ...(dealerModal.dealerInfo || {}),
                          tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                        },
                      })}
                    />
                  </div>

                  {/* 管理员备注 */}
                  <div>
                    <label className="label mb-1.5">{t('admin.dashboard.admin_notes')}</label>
                    <textarea
                      className="input min-h-[80px]"
                      placeholder="Internal notes about this dealer..."
                      value={dealerModal.dealerInfo?.adminNotes || ''}
                      onChange={e => setDealerModal({
                        ...dealerModal,
                        dealerInfo: { ...(dealerModal.dealerInfo || {}), adminNotes: e.target.value },
                      })}
                    />
                  </div>
                </>
              )}

              {/* 客户基础信息（只读） */}
              <div className="pt-4 border-t border-ceramic-border">
                <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-3">{t('admin.dashboard.customer_info')}</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-ceramic-ash">{t('checkout.c_name')}:</span> {dealerModal.contactInfo?.name || '-'}</div>
                  <div><span className="text-ceramic-ash">{t('checkout.c_email')}:</span> {dealerModal.contactInfo?.email || '-'}</div>
                  <div><span className="text-ceramic-ash">{t('checkout.c_phone')}:</span> {dealerModal.contactInfo?.phone || '-'}</div>
                  <div><span className="text-ceramic-ash">{t('checkout.total_usdt')}:</span> ${dealerModal.amount.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-ceramic-border flex items-center justify-between sticky bottom-0 bg-white">
              <button
                onClick={() => { setDealerModal(null); setDealerEditing(false); }}
                className="btn-gold-outline !px-6"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  setDealerSaving(true);
                  try {
                    const payload: any = { orderType: dealerModal.orderType };
                    if (dealerModal.orderType === 'dealer') {
                      payload.dealerInfo = dealerModal.dealerInfo || {};
                    }
                    await Orders.setDealerInfo(dealerModal._id, payload);
                    showToast({ type: 'success', text: t('admin.dashboard.dealer_saved') });
                    setDealerModal(null);
                    setDealerEditing(false);
                    load();
                  } catch (e: any) {
                    showToast({ type: 'error', text: e.message || String(e) });
                  } finally { setDealerSaving(false); }
                }}
                disabled={dealerSaving}
                className="btn-gold flex items-center gap-2"
              >
                {dealerSaving ? <><RefreshCw size={14} className="animate-spin" /> {t('common.saving')}</> : <><Save size={14} /> {t('common.save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

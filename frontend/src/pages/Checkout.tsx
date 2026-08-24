import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Copy, Check, ChevronRight, Eye, EyeOff, Wallet, AlertCircle, FileText,
  Clock, ArrowLeft, ShieldCheck, RefreshCw, Send, QrCode, CheckCircle2,
  ShoppingCart, CreditCard, XCircle, Loader2, User2, Building2
} from 'lucide-react';
import SEO from '../components/common/SEO';
import { Orders, type CreateOrderInput } from '../api';
import { useApp } from '../context/AppContext';
import { copyText, secondsToMMSS, truncateTxHash } from '../utils';
import type { CartItem, CheckoutDraft, ContactInfo, OrderListItem, OrderSummary, OrderType } from '../types';

const PAY_WINDOW_SEC = 60 * 30; // 支付窗口 30 分钟（与后端同步）

type Step = 'draft' | 'placed' | 'recover';

// 从 sessionStorage 读取草稿；如草稿只有一个产品则允许改数量
function readDraft(): CheckoutDraft {
  try {
    const raw = sessionStorage.getItem('luxe.checkoutDraft');
    if (raw) {
      const d = JSON.parse(raw) as CheckoutDraft;
      return d?.items?.length ? d : { items: [], contactInfo: {}, customDemand: '' };
    }
  } catch {}
  return { items: [], contactInfo: {}, customDemand: '' };
}

const Checkout: React.FC = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const params = useParams<{ orderNo?: string }>();
  const { showToast } = useApp();

  const [draft, setDraft] = useState<CheckoutDraft>(() => readDraft());
  const [contact, setContact] = useState<ContactInfo>(() => ({ ...readDraft().contactInfo }));
  const [demand, setDemand] = useState<string>(() => readDraft().customDemand || '');
  const [orderType, setOrderType] = useState<OrderType>(() => readDraft().orderType || 'retail');
  const [agreed, setAgreed] = useState(true);
  const [step, setStep] = useState<Step>('draft');
  const [submitting, setSubmitting] = useState(false);
  // 下单价校验
  const [errors, setErrors] = useState<Record<string, string>>({});

  // --- 已下单并进入支付态 ---
  const [order, setOrder] = useState<OrderListItem | null>(null);
  const [pollTimer, setPollTimer] = useState(PAY_WINDOW_SEC);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [showAmount, setShowAmount] = useState(true);
  const [showTxIdInput, setShowTxIdInput] = useState(false);
  const [txId, setTxId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [statusPolling, setStatusPolling] = useState(true);
  const pollIntervalRef = useRef<number | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // ---------- 关键：URL 带 orderNo 时恢复订单（刷新 / 分享链接都能回到支付页） ----------
  useEffect(() => {
    if (!params.orderNo) return;
    let cancelled = false;
    const recover = async () => {
      setRecovering(true);
      setNetworkError(null);
      try {
        const r = (await Orders.status(params.orderNo!)) as OrderSummary;
        if (cancelled) return;
        setOrder(r);
        setStep('placed');
        const ttl = (r as any).ttlSeconds ?? PAY_WINDOW_SEC;
        setPollTimer(Math.max(0, Math.min(PAY_WINDOW_SEC, Number(ttl) || 0)));
        // 若草稿为空，用订单数据回填（用户可以刷新后回到付款页）
        setDraft(d => d.items.length ? d : {
          items: (r.items || []).map(it => ({
            productId: it.productId as any,
            name: it.name,
            price: it.price,
            qty: it.qty,
            image: it.image,
          })),
          contactInfo: r.contactInfo || {},
          customDemand: r.customDemand || '',
        });
      } catch (e: any) {
        if (cancelled) return;
        setNetworkError(e?.message || String(e));
        // 订单不存在或已过期：保留用户在 draft 页
        setStep('draft');
      } finally {
        if (!cancelled) setRecovering(false);
      }
    };
    recover();
    return () => { cancelled = true; };
  }, [params.orderNo]);

  // 草稿变更 → 持久化到 sessionStorage
  useEffect(() => {
    const items = draft.items.map(it => ({ ...it, qty: Math.max(1, it.qty) }));
    sessionStorage.setItem('luxe.checkoutDraft', JSON.stringify({
      items, contactInfo: contact, customDemand: demand, orderType,
    }));
  }, [draft, contact, demand, orderType]);

  // 计算总价
  const total = useMemo(
    () => draft.items.reduce((s, it) => s + Math.max(1, it.qty) * (it.price || 0), 0),
    [draft.items],
  );
  const usdtAmount = Math.round(total * 100) / 100;

  // --- 更新购物车项数量 / 移除 ---
  const updateQty = (idx: number, nq: number) =>
    setDraft(d => ({ ...d, items: d.items.map((it, i) => i === idx ? { ...it, qty: Math.max(1, nq) } : it) }));
  const removeItem = (idx: number) =>
    setDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }));

  // --- 下单校验（按 orderType 分两套规则） ---
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (draft.items.length === 0) e.items = t('checkout.empty_cart');
    if (!contact.name || contact.name.trim().length < 2) e.name = t('checkout.e_name');
    if (!contact.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) e.email = t('checkout.e_email');

    if (orderType === 'retail') {
      // 散客：电话+收货地址必填
      const phoneOk = contact.phone?.trim() || contact.whatsapp?.trim();
      if (!phoneOk) e.phone = t('checkout.e_phone');
      if (!contact.shippingAddress?.trim()) e.shippingAddress = t('checkout.e_shipping_address');
      if (!contact.shippingCity?.trim()) e.shippingCity = t('checkout.e_shipping_city');
      if (!contact.shippingCountry?.trim()) e.shippingCountry = t('checkout.e_shipping_country');
    } else {
      // 经销商：公司+WhatsApp+国家+项目需求必填
      if (!contact.company?.trim()) e.company = t('checkout.e_company');
      if (!contact.whatsapp?.trim() && !contact.phone?.trim()) e.whatsapp = t('checkout.e_whatsapp');
      if (!contact.country?.trim()) e.country = t('checkout.e_country');
      if (!demand?.trim() || demand.trim().length < 10) e.demand = t('checkout.e_custom');
    }
    if (!agreed) e.tos = t('checkout.e_tos');
    if (total <= 0) e.items = t('checkout.e_amount_zero');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitOrder = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setNetworkError(null);
    try {
      const input: CreateOrderInput = {
        orderType,
        items: draft.items.map(it => ({
          productId: it.productId,
          name: it.name,
          price: it.price,
          qty: Math.max(1, it.qty),
          image: (it as any).image || '',
        })),
        contactInfo: {
          name: contact.name || '',
          email: contact.email || '',
          phone: contact.phone,
          whatsapp: contact.whatsapp || contact.phone,
          country: contact.country,
          company: contact.company,
          shippingAddress: contact.shippingAddress,
          shippingAddress2: contact.shippingAddress2,
          shippingCity: contact.shippingCity,
          shippingState: contact.shippingState,
          shippingZip: contact.shippingZip,
          shippingCountry: contact.shippingCountry,
        },
        customDemand: demand,
      };
      const r = (await Orders.create(input)) as OrderSummary;
      setOrder(r);
      setStep('placed');
      setPollTimer(PAY_WINDOW_SEC);
      // 提交成功 → 替换浏览器地址为 /checkout/:orderNo，刷新不丢
      nav(`/checkout/${r.orderNo}`, { replace: true });
      showToast({ type: 'success', text: t('checkout.pending_sub') });
    } catch (err: any) {
      setNetworkError(err?.message || String(err));
      showToast({ type: 'error', text: String(err?.message || err) });
    } finally { setSubmitting(false); }
  };

  // --- 支付倒计时 & 状态轮询 ---
  useEffect(() => {
    if (step !== 'placed' || !order) return;
    const tick = window.setInterval(() => {
      setPollTimer(v => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [step, order]);

  // 状态轮询：每 12 秒查询订单状态
  useEffect(() => {
    if (step !== 'placed' || !order) return;
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'expired') return;
    if (!statusPolling) return;
    const poll = async () => {
      setLoadingStatus(true);
      try {
        const r = await Orders.detail(order._id);
        setOrder(r);
        setNetworkError(null);
        if (r.paymentStatus === 'paid' || r.paymentStatus === 'expired') {
          if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
        }
      } catch (e: any) { setNetworkError(e.message || String(e)); }
      finally { setLoadingStatus(false); }
    };
    poll();
    pollIntervalRef.current = window.setInterval(poll, 12000) as unknown as number;
    return () => { if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current); };
  }, [step, order?._id, order?.paymentStatus, statusPolling]);

  // 到期：若仍 pending，状态标记 expired
  useEffect(() => {
    if (pollTimer === 0 && order?.paymentStatus === 'pending') {
      setOrder({ ...order, paymentStatus: 'expired' });
      setStatusPolling(false);
    }
  }, [pollTimer, order]);

  // --- 验证 TXID ---
  const verifyTxId = async () => {
    if (!order) return;
    const v = txId.trim();
    if (!/^[A-Za-z0-9]{50,90}$/.test(v)) {
      showToast({ type: 'error', text: t('checkout.e_txid_invalid') });
      return;
    }
    setVerifying(true);
    try {
      const r = await Orders.verifyTx(order._id, v);
      showToast({ type: 'success', text: r.msg });
      if (r.status === 'paid') setOrder({ ...order, paymentStatus: 'paid', txHash: v });
      else setOrder({ ...order, txHash: v });
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setVerifying(false); }
  };

  // --- 手动刷新状态 ---
  const refreshStatus = async () => {
    if (!order) return;
    setLoadingStatus(true);
    try {
      const r = await Orders.detail(order._id);
      setOrder(r);
      showToast({ type: 'success', text: t('checkout.toast_status_updated') });
    } catch (e: any) { setNetworkError(e.message || String(e)); showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setLoadingStatus(false); }
  };

  // --- 已到期的重置按钮 ---
  const resetToDraft = () => {
    setOrder(null);
    setStep('draft');
    setPollTimer(PAY_WINDOW_SEC);
    setShowTxIdInput(false);
    setTxId('');
    nav('/checkout', { replace: true });
  };

  // URL 恢复中：显示 Loading（避免短暂空白白屏被用户当“无跳转支付页”）
  if (recovering) {
    return (
      <section className="section min-h-[70vh] flex flex-col items-center justify-center text-center">
        <SEO titleKey="checkout.pay_title" />
        <Loader2 className="w-10 h-10 text-ceramic-gold-matte animate-spin mb-4" />
        <div className="text-sm tracking-luxury uppercase text-ceramic-ash">{t('checkout.checking')}</div>
      </section>
    );
  }

  // 渲染开始
  if (!order && draft.items.length === 0) {
    return (
      <section className="section min-h-[70vh] flex flex-col items-center justify-center text-center">
        <SEO titleKey="checkout.title" />
        <div className="w-20 h-20 rounded-full bg-ceramic-gold-matte/10 flex items-center justify-center text-ceramic-gold-matte mb-6">
          <ShoppingCart size={30} />
        </div>
        <h1 className="serif-heading text-[36px] md:text-[46px] mb-3">{t('checkout.empty_title')}</h1>
        <p className="text-ceramic-ash mb-8">{t('checkout.empty_sub')}</p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link to="/products" className="btn-gold">{t('cta.browse_products')}</Link>
          <Link to="/" className="btn-gold-outline">{t('nav.home')}</Link>
        </div>
      </section>
    );
  }

  // 状态 Banner
  const statusBadge = (st: string) => {
    switch (st) {
      case 'paid':    return <span className="badge bg-emerald-500 text-white"><CheckCircle2 size={12} /> {t('checkout.status_paid')}</span>;
      case 'expired': return <span className="badge bg-rose-500 text-white"><XCircle size={12} /> {t('checkout.status_expired')}</span>;
      default:        return <span className="badge bg-amber-500 text-white"><Clock size={12} /> {t('checkout.status_pending')}</span>;
    }
  };

  // ---------- 支付成功页 ----------
  if (order?.paymentStatus === 'paid') {
    return (
      <section className="section min-h-[80vh]">
        <SEO titleKey="checkout.paid_title" />
        <div className="max-w-3xl mx-auto gold-card p-10 md:p-14 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto mb-8 flex items-center justify-center">
            <CheckCircle2 size={42} />
          </div>
          <h1 className="serif-heading text-[36px] md:text-[46px] mb-3">{t('checkout.paid_title')}</h1>
          <p className="text-ceramic-ash mb-10 max-w-xl mx-auto">{t('checkout.paid_sub')}</p>

          <div className="grid grid-cols-2 gap-4 text-left max-w-xl mx-auto mb-10">
            <div><div className="label mb-1">{t('checkout.order_no')}</div><div className="text-sm font-mono">{order.orderNo}</div></div>
            <div><div className="label mb-1">{t('checkout.amount')}</div><div className="serif-heading text-[22px] gold-text">${order.amount.toFixed(2)}</div></div>
            <div className="col-span-2"><div className="label mb-1">{t('checkout.txid')}</div>
              {order.txHash
                ? <a href={`https://tronscan.org/#/transaction/${order.txHash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs break-all text-ceramic-gold-matte hover:underline">
                    {order.txHash}
                  </a>
                : <span className="text-ceramic-ash text-sm">{t('checkout.txid_pending')}</span>}
            </div>
            <div className="col-span-2"><div className="label mb-1">{t('checkout.contact_email')}</div><div className="text-sm">{order.contactInfo?.email || '-'}</div></div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/products" className="btn-gold">{t('cta.browse_products')}</Link>
            <Link to="/contact" className="btn-gold-outline">{t('cta.need_help')}</Link>
          </div>
        </div>
      </section>
    );
  }

  // ---------- Draft（填写购物车 + 联系信息） ----------
  if (step === 'draft') {
    return (
      <section className="section max-w-[1400px] mx-auto">
        <SEO titleKey="checkout.title" />
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <button onClick={() => nav(-1)} className="btn-ghost !px-0 mb-2">
              <ArrowLeft size={14} /> {t('checkout.back_products')}
            </button>
            <h1 className="serif-heading text-[34px] md:text-[46px] leading-tight">{t('checkout.title')}</h1>
          </div>
          <div className="flex items-center gap-2 text-[11px] tracking-luxury uppercase text-ceramic-ash">
            <ShieldCheck size={14} className="text-ceramic-gold-matte" /> {t('checkout.secure')}
          </div>
        </div>

        {errors.items && (
          <div className="gold-card p-5 border border-rose-200 bg-rose-50 mb-6 text-rose-700 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5" /> {errors.items}
          </div>
        )}
        {networkError && (
          <div className="gold-card p-5 border border-rose-200 bg-rose-50 mb-6 text-rose-700 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5" /> {networkError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10">
          {/* 左：联系信息 + 需求 */}
          <div className="space-y-8">
            {/* 购物车明细 */}
            <div className="gold-card">
              <h3 className="serif-heading text-[22px] p-7 pb-5 border-b border-ceramic-border flex items-center gap-2">
                <ShoppingCart size={18} /> {t('checkout.cart_title')}
              </h3>
              <ul className="divide-y divide-ceramic-border">
                {draft.items.map((it, i) => (
                  <li key={i} className="p-5 flex items-center gap-4">
                    {it.image && <img src={it.image} className="w-16 h-16 object-cover rounded-md" alt={it.name} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-ceramic-graphite text-sm truncate">{it.name}</div>
                      <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mt-1">${it.price} / {t('checkout.unit')}</div>
                    </div>
                    <div className="flex items-center gap-2 border border-ceramic-border bg-white">
                      <button className="p-2 text-ceramic-ash hover:text-ceramic-graphite" onClick={() => updateQty(i, it.qty - 1)} aria-label="-">-</button>
                      <input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={e => updateQty(i, Number(e.target.value) || 1)}
                        className="w-12 text-center py-2 outline-none bg-transparent text-sm"
                      />
                      <button className="p-2 text-ceramic-ash hover:text-ceramic-graphite" onClick={() => updateQty(i, it.qty + 1)} aria-label="+">+</button>
                    </div>
                    <div className="text-sm w-24 text-end">${(it.price * it.qty).toFixed(2)}</div>
                    <button onClick={() => removeItem(i)} className="text-ceramic-ash hover:text-rose-600 text-xs">
                      <XCircle size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* 联系信息 */}
            <div className="gold-card p-7">
              <h3 className="serif-heading text-[22px] mb-6 flex items-center gap-2">
                <FileText size={18} /> {t('checkout.contact_title')}
              </h3>

              {/* 客户类型切换：散客 / 经销商 */}
              <div className="grid grid-cols-2 gap-3 mb-6 p-1 bg-ceramic-offWhite rounded-sm">
                <button
                  type="button"
                  className={`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all rounded-sm ${
                    orderType === 'retail'
                      ? 'bg-white text-ceramic-gold-matte shadow-sm border border-ceramic-gold-matte/30'
                      : 'text-ceramic-ash hover:text-ceramic-graphite'
                  }`}
                  onClick={() => { setOrderType('retail'); setErrors({}); }}
                >
                  <User2 size={16} /> {t('checkout.type_retail')}
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all rounded-sm ${
                    orderType === 'dealer'
                      ? 'bg-white text-ceramic-gold-matte shadow-sm border border-ceramic-gold-matte/30'
                      : 'text-ceramic-ash hover:text-ceramic-graphite'
                  }`}
                  onClick={() => { setOrderType('dealer'); setErrors({}); }}
                >
                  <Building2 size={16} /> {t('checkout.type_dealer')}
                </button>
              </div>
              <p className="text-[11px] text-ceramic-ash mb-5 leading-relaxed">
                {orderType === 'retail' ? t('checkout.type_retail_desc') : t('checkout.type_dealer_desc')}
              </p>

              {/* 通用：姓名 + 邮箱 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 md:flex md:gap-4">
                  <div className="md:w-1/2 mb-4 md:mb-0">
                    <label className="label mb-1.5">{t('checkout.c_name')} <span className="text-rose-500">*</span></label>
                    <input className={`input ${errors.name ? '!border-rose-300 !focus:!border-rose-500' : ''}`} placeholder="Your full name"
                      value={contact.name || ''} onChange={e => setContact({ ...contact, name: e.target.value })} />
                    {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name}</p>}
                  </div>
                  <div className="md:w-1/2">
                    <label className="label mb-1.5">{t('checkout.c_email')} <span className="text-rose-500">*</span></label>
                    <input className={`input ${errors.email ? '!border-rose-300' : ''}`} placeholder="you@company.com"
                      value={contact.email || ''} onChange={e => setContact({ ...contact, email: e.target.value })} />
                    {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email}</p>}
                  </div>
                </div>

                {/* 散客模式：电话 + 收货地址 */}
                {orderType === 'retail' ? (
                  <>
                    <div className="md:col-span-2 md:flex md:gap-4">
                      <div className="md:w-1/2 mb-4 md:mb-0">
                        <label className="label mb-1.5">{t('checkout.c_phone')} <span className="text-rose-500">*</span></label>
                        <input className={`input ${errors.phone ? '!border-rose-300' : ''}`} placeholder="+971 xx xxx xxxx"
                          value={contact.phone || ''} onChange={e => setContact({ ...contact, phone: e.target.value })} />
                        {errors.phone && <p className="text-rose-500 text-xs mt-1">{errors.phone}</p>}
                      </div>
                      <div className="md:w-1/2">
                        <label className="label mb-1.5">{t('checkout.c_whatsapp')}</label>
                        <input className="input" placeholder="Optional"
                          value={contact.whatsapp || ''} onChange={e => setContact({ ...contact, whatsapp: e.target.value })} />
                      </div>
                    </div>
                    {/* 收货地址区块（散客必填） */}
                    <div className="md:col-span-2 pt-4 border-t border-dashed border-ceramic-gold-matte/30">
                      <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-4 flex items-center gap-2">
                        📦 {t('checkout.shipping_title')}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="label mb-1.5">{t('checkout.shipping_address')} <span className="text-rose-500">*</span></label>
                          <input className={`input ${errors.shippingAddress ? '!border-rose-300' : ''}`} placeholder="Street address"
                            value={contact.shippingAddress || ''} onChange={e => setContact({ ...contact, shippingAddress: e.target.value })} />
                          {errors.shippingAddress && <p className="text-rose-500 text-xs mt-1">{errors.shippingAddress}</p>}
                        </div>
                        <div className="md:col-span-2">
                          <label className="label mb-1.5">{t('checkout.shipping_address2')}</label>
                          <input className="input" placeholder="Apartment, suite, unit (optional)"
                            value={contact.shippingAddress2 || ''} onChange={e => setContact({ ...contact, shippingAddress2: e.target.value })} />
                        </div>
                        <div>
                          <label className="label mb-1.5">{t('checkout.shipping_city')} <span className="text-rose-500">*</span></label>
                          <input className={`input ${errors.shippingCity ? '!border-rose-300' : ''}`} placeholder="City"
                            value={contact.shippingCity || ''} onChange={e => setContact({ ...contact, shippingCity: e.target.value })} />
                          {errors.shippingCity && <p className="text-rose-500 text-xs mt-1">{errors.shippingCity}</p>}
                        </div>
                        <div>
                          <label className="label mb-1.5">{t('checkout.shipping_state')}</label>
                          <input className="input" placeholder="State / Province (optional)"
                            value={contact.shippingState || ''} onChange={e => setContact({ ...contact, shippingState: e.target.value })} />
                        </div>
                        <div>
                          <label className="label mb-1.5">{t('checkout.shipping_zip')}</label>
                          <input className="input" placeholder="Postal / Zip code (optional)"
                            value={contact.shippingZip || ''} onChange={e => setContact({ ...contact, shippingZip: e.target.value })} />
                        </div>
                        <div>
                          <label className="label mb-1.5">{t('checkout.shipping_country')} <span className="text-rose-500">*</span></label>
                          <input className={`input ${errors.shippingCountry ? '!border-rose-300' : ''}`} placeholder="Country"
                            value={contact.shippingCountry || ''} onChange={e => setContact({ ...contact, shippingCountry: e.target.value })} />
                          {errors.shippingCountry && <p className="text-rose-500 text-xs mt-1">{errors.shippingCountry}</p>}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 经销商模式：公司 + WhatsApp + 国家 + 项目需求 */}
                    <div className="md:col-span-2 md:flex md:gap-4">
                      <div className="md:w-1/2 mb-4 md:mb-0">
                        <label className="label mb-1.5">{t('checkout.c_company')} <span className="text-rose-500">*</span></label>
                        <input className={`input ${errors.company ? '!border-rose-300' : ''}`} placeholder="Your company / organization"
                          value={contact.company || ''} onChange={e => setContact({ ...contact, company: e.target.value })} />
                        {errors.company && <p className="text-rose-500 text-xs mt-1">{errors.company}</p>}
                      </div>
                      <div className="md:w-1/2">
                        <label className="label mb-1.5">{t('checkout.c_whatsapp')} <span className="text-rose-500">*</span></label>
                        <input className={`input ${errors.whatsapp ? '!border-rose-300' : ''}`} placeholder="+971 xxx xxxxx"
                          value={contact.whatsapp || ''} onChange={e => setContact({ ...contact, whatsapp: e.target.value })} />
                        {errors.whatsapp && <p className="text-rose-500 text-xs mt-1">{errors.whatsapp}</p>}
                      </div>
                    </div>
                    <div className="md:col-span-2 md:flex md:gap-4">
                      <div className="md:w-1/2 mb-4 md:mb-0">
                        <label className="label mb-1.5">{t('checkout.c_phone')}</label>
                        <input className="input" placeholder="Alternate phone (optional)"
                          value={contact.phone || ''} onChange={e => setContact({ ...contact, phone: e.target.value })} />
                      </div>
                      <div className="md:w-1/2">
                        <label className="label mb-1.5">{t('checkout.c_country')} <span className="text-rose-500">*</span></label>
                        <input className={`input ${errors.country ? '!border-rose-300' : ''}`} placeholder="e.g. UAE, Saudi Arabia..."
                          value={contact.country || ''} onChange={e => setContact({ ...contact, country: e.target.value })} />
                        {errors.country && <p className="text-rose-500 text-xs mt-1">{errors.country}</p>}
                      </div>
                    </div>
                    {/* 收货地址（经销商可选） */}
                    <div className="md:col-span-2 pt-4 border-t border-dashed border-ceramic-gold-matte/30">
                      <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-3">
                        📦 {t('checkout.shipping_title')} <span className="normal-case tracking-normal text-ceramic-ash">({t('checkout.optional')})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="label mb-1.5">{t('checkout.shipping_address')}</label>
                          <input className="input" placeholder="Street address (optional)"
                            value={contact.shippingAddress || ''} onChange={e => setContact({ ...contact, shippingAddress: e.target.value })} />
                        </div>
                        <div>
                          <label className="label mb-1.5">{t('checkout.shipping_city')}</label>
                          <input className="input" placeholder="City (optional)"
                            value={contact.shippingCity || ''} onChange={e => setContact({ ...contact, shippingCity: e.target.value })} />
                        </div>
                        <div>
                          <label className="label mb-1.5">{t('checkout.shipping_country')}</label>
                          <input className="input" placeholder="Country (optional)"
                            value={contact.shippingCountry || ''} onChange={e => setContact({ ...contact, shippingCountry: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    {/* 项目需求（经销商必填） */}
                    <div className="md:col-span-2">
                      <label className="label mb-1.5">{t('checkout.c_custom')} <span className="text-rose-500">*</span></label>
                      <textarea
                        className={`input min-h-[120px] ${errors.demand ? '!border-rose-300' : ''}`}
                        placeholder={t('checkout.c_custom_ph')}
                        value={demand} onChange={e => setDemand(e.target.value)}
                      />
                      {errors.demand && <p className="text-rose-500 text-xs mt-1">{errors.demand}</p>}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-start gap-2">
                <input id="agreeTos" type="checkbox" className="mt-1 accent-ceramic-gold-matte" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                <label htmlFor="agreeTos" className={`text-sm ${errors.tos ? 'text-rose-500' : 'text-ceramic-ash'}`}>
                  {t('checkout.tos')}
                  {errors.tos && <div className="text-xs mt-1">{errors.tos}</div>}
                </label>
              </div>
            </div>
          </div>

          {/* 右：订单摘要 + 支付方式 */}
          <div className="lg:sticky lg:top-28 self-start space-y-6">
            <div className="gold-card p-7">
              <h3 className="serif-heading text-[22px] mb-6">{t('checkout.summary_title')}</h3>
              <div className="space-y-3 text-sm mb-6">
                {draft.items.map((it, i) => (
                  <div key={i} className="flex justify-between gap-3 text-ceramic-ash">
                    <span className="truncate">{it.name} × {it.qty}</span>
                    <span>${(it.price * it.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-ceramic-border pt-5 space-y-3 text-sm mb-6">
                <div className="flex justify-between text-ceramic-ash">
                  <span>{t('checkout.subtotal')}</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-ceramic-ash">
                  <span>{t('checkout.shipping_fee')}</span>
                  <span>{t('checkout.shipping_quote')}</span>
                </div>
                <div className="flex justify-between text-ceramic-ash">
                  <span>{t('checkout.network')}</span>
                  <span>USDT · TRC20 (Tron)</span>
                </div>
              </div>
              <div className="flex justify-between items-end border-t border-dashed border-ceramic-gold-matte/50 pt-5 mb-8">
                <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('checkout.total_usdt')}</span>
                <span className="serif-heading text-[34px] gold-text">${usdtAmount.toFixed(2)}</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 px-4 py-3 bg-ceramic-gold-matte/5 border border-ceramic-gold-matte/30 text-ceramic-graphite text-sm">
                  <Wallet size={16} className="text-ceramic-gold-matte" /> {t('checkout.pay_method_title')}
                </div>
                <button
                  className="btn-gold w-full justify-center gap-2"
                  onClick={submitOrder}
                  disabled={submitting}
                >
                  {submitting
                    ? <><RefreshCw className="animate-spin" size={16} /> {t('checkout.btn_submitting')}</>
                    : <><CreditCard size={16} /> {t('checkout.btn_place')} — ${usdtAmount.toFixed(2)}</>}
                </button>
                <div className="text-[11px] text-ceramic-ash text-center leading-relaxed">
                  {t('checkout.btn_tip')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------- Placed：已下单、进入支付态 ----------
  return (
    <section className="section max-w-[1400px] mx-auto">
      <SEO titleKey="checkout.pay_title" />
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="serif-heading text-[34px] md:text-[46px] leading-tight flex items-center gap-3">
          {t('checkout.pay_title')}
          {order && statusBadge(order.paymentStatus)}
        </h1>
        <div className="flex items-center gap-3">
          {networkError && (
            <span className="badge bg-rose-500 text-white">{networkError.slice(0, 60)}</span>
          )}
          <button
            className="btn-gold-outline !px-4 !py-2 text-[11px]"
            onClick={refreshStatus}
            disabled={loadingStatus || !order}
          >
            <RefreshCw size={13} className={loadingStatus ? 'animate-spin' : ''} />
            {t('checkout.btn_refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-12">
        {/* 左：二维码 + 收款信息 */}
        <div className="gold-card p-8 md:p-10">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-2">{t('checkout.pay_step_title')}</div>
              <h3 className="serif-heading text-[28px]">
                {order?.paymentStatus === 'expired' ? t('checkout.expired_title') : t('checkout.pay_howto')}
              </h3>
            </div>
            {order?.paymentStatus !== 'expired' && (
              <div className="flex items-center gap-2 badge bg-amber-500 text-white text-[13px]">
                <Clock size={14} /> {secondsToMMSS(pollTimer)}
              </div>
            )}
          </div>

          {/* 过期提示 */}
          {order?.paymentStatus === 'expired' && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-sm p-5 text-sm flex items-start gap-3 mb-8">
              <AlertCircle size={18} className="mt-0.5" />
              <div>
                <div className="serif-heading text-[18px] mb-1">{t('checkout.expired_title')}</div>
                <p>{t('checkout.expired_sub')}</p>
                <button className="btn-gold mt-5" onClick={resetToDraft}>{t('checkout.btn_restart')}</button>
              </div>
            </div>
          )}

          {/* 金额 */}
          <div className="gold-card !bg-ceramic-offWhite p-6 mb-8 flex items-center justify-between gap-6 flex-wrap">
            <div>
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-2">{t('checkout.amount')}</div>
              <div className="flex items-baseline gap-2">
                <button onClick={() => setShowAmount(s => !s)} className="text-ceramic-ash">
                  {showAmount ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <span className="serif-heading text-[36px] gold-text">
                  {showAmount ? `$${order?.amount.toFixed(2) || '0.00'}` : '******'}
                </span>
                <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash">USDT · TRC20</span>
              </div>
            </div>
            <button
              className="btn-gold-outline !py-2 !px-4 text-[11px]"
              onClick={() => copyText(`${order?.amount.toFixed(2) || '0.00'}`, showToast, { ok: 'checkout.copied' })
                .then(() => { setCopiedAmount(true); window.setTimeout(() => setCopiedAmount(false), 1600); })}
              disabled={order?.paymentStatus === 'expired'}
            >
              {copiedAmount ? <Check size={13} /> : <Copy size={13} />}
              {t('checkout.copy_amount')}
            </button>
          </div>

          {/* 二维码：使用公共 QR 生成服务，可离线/离线失败降级为纯地址展示 */}
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="w-[240px] h-[240px] shrink-0 p-4 bg-white border border-ceramic-gold-light shadow-gold">
              {order?.merchantAddress ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=1&data=${encodeURIComponent(order.merchantAddress)}`}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  alt="USDT TRC20 address"
                  className="w-full h-full"
                  loading="lazy"
                />
              ) : <div className="w-full h-full flex items-center justify-center text-ceramic-ash text-xs">
                    <QrCode size={60} className="mx-auto mb-3 text-ceramic-gold-matte" />
                    QR
                  </div>}
            </div>
            <div className="flex-1 w-full">
              <div className="label mb-2">{t('checkout.recipient_address')}</div>
              <div className="gold-card !bg-white p-4 break-all font-mono text-[13px] flex items-center justify-between gap-3">
                <span>{order?.merchantAddress || '—'}</span>
                <button
                  className="shrink-0 btn-gold-outline !py-2 !px-3 !text-[11px]"
                  onClick={() => copyText(order?.merchantAddress || '', showToast, { ok: 'checkout.copied' })
                    .then(() => { setCopiedAddr(true); window.setTimeout(() => setCopiedAddr(false), 1600); })}
                  disabled={order?.paymentStatus === 'expired'}
                >
                  {copiedAddr ? <Check size={12} /> : <Copy size={12} />} {t('checkout.copy_address')}
                </button>
              </div>
              <div className="mt-5 text-[11px] text-ceramic-ash leading-relaxed">
                {t('checkout.address_note')}
              </div>
            </div>
          </div>
        </div>

        {/* 右：订单明细 + 手动 TX ID 输入 */}
        <div className="space-y-6">
          <div className="gold-card p-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h3 className="serif-heading text-[28px]">{t('checkout.order_details')}</h3>
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">
                {t('checkout.order_no')}: <span className="text-ceramic-graphite font-mono">{order?.orderNo}</span>
              </div>
            </div>
            <ul className="divide-y divide-ceramic-border mb-6">
              {order?.items?.map((it: any, i: number) => (
                <li key={i} className="py-4 flex items-center gap-4">
                  {it.image && <img src={it.image} className="w-14 h-14 object-cover rounded-sm" alt="" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-ceramic-graphite text-sm truncate">{it.name}</div>
                    <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">× {it.qty}</div>
                  </div>
                  <div className="text-sm">${((it.price || 0) * (it.qty || 0)).toFixed(2)}</div>
                </li>
              ))}
            </ul>
            <div className="border-t border-dashed border-ceramic-gold-matte/50 pt-5 flex items-center justify-between">
              <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('checkout.total_usdt')}</span>
              <span className="serif-heading text-[30px] gold-text">${order?.amount.toFixed(2)}</span>
            </div>
          </div>

          <div className="gold-card p-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h3 className="serif-heading text-[22px] flex items-center gap-2">
                <Send size={16} className="text-ceramic-gold-matte" /> {t('checkout.txid_verify_title')}
              </h3>
              {order?.txHash && (
                <a
                  href={`https://tronscan.org/#/transaction/${order.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ceramic-gold-matte hover:underline font-mono"
                >
                  {truncateTxHash(order.txHash)} ↗
                </a>
              )}
            </div>
            <p className="text-sm text-ceramic-ash leading-relaxed mb-6">{t('checkout.txid_verify_sub')}</p>

            {!showTxIdInput ? (
              <button
                className="btn-gold w-full justify-center"
                onClick={() => setShowTxIdInput(true)}
                disabled={order?.paymentStatus === 'expired'}
              >
                <ChevronRight size={16} /> {t('checkout.btn_fill_txid')}
              </button>
            ) : (
              <div>
                <label className="label mb-1.5">{t('checkout.txid_label')}</label>
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    className="input flex-1 font-mono text-sm"
                    placeholder="TRC20 TXID（50~90 字符 16 进制串）"
                    value={txId}
                    onChange={e => setTxId(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') verifyTxId(); }}
                  />
                  <button
                    className="btn-gold !px-6 justify-center"
                    onClick={verifyTxId}
                    disabled={verifying || order?.paymentStatus === 'expired'}
                  >
                    {verifying ? <><RefreshCw className="animate-spin" size={14} /> {t('checkout.btn_verifying')}</>
                      : <><Check size={14} /> {t('checkout.btn_verify')}</>}
                  </button>
                </div>
                <p className="text-[11px] text-ceramic-ash mt-3 leading-relaxed">{t('checkout.txid_hint')}</p>
              </div>
            )}
          </div>

          {/* 支付小技巧 / 自动到账提示 */}
          <div className="gold-card p-6 !bg-ceramic-offWhite">
            <ul className="text-sm text-ceramic-ash space-y-2.5 leading-relaxed">
              <li className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 text-ceramic-gold-matte shrink-0" /> {t('checkout.tip_1')}</li>
              <li className="flex gap-2"><Clock size={16} className="mt-0.5 text-ceramic-gold-matte shrink-0" /> {t('checkout.tip_2')}</li>
              <li className="flex gap-2"><AlertCircle size={16} className="mt-0.5 text-ceramic-gold-matte shrink-0" /> {t('checkout.tip_3')}</li>
            </ul>
          </div>

          <div className="text-center text-xs text-ceramic-ash leading-relaxed">
            {t('checkout.footer_help')} · <Link to="/contact" className="text-ceramic-gold-matte hover:underline">{t('nav.contact')}</Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Checkout;

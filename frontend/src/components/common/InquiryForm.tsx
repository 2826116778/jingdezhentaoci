/**
 * 通用询盘表单（联系页 / OEM页 / 产品详情 内嵌）
 * 参数：
 *  - defaultProduct: {id, name} 自动选中产品（产品详情页时传入）
 *  - source: 'contact' | 'product' | 'oem'
 *  - compact: 紧凑模式（产品详情页用，隐藏不关键字段）
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2 } from 'lucide-react';
import { Inquiries, Products } from '../../api';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { pickBilingual } from '../../utils';

interface Props {
  defaultProduct?: { id?: string; name?: string };
  source?: 'contact' | 'product' | 'quote' | 'oem';
  compact?: boolean;
  showProductSelect?: boolean;
  titleKey?: string;
  subKey?: string;
  className?: string;
}

const InquiryForm: React.FC<Props> = ({
  defaultProduct, source = 'contact', compact, showProductSelect = true,
  titleKey = 'contact.form_title', subKey = 'contact.form_sub', className = '',
}) => {
  const { t } = useTranslation();
  const { showToast, lang } = useApp();

  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    country: '',
    company: '',
    quantity: '',
    customDemand: '',
    productId: defaultProduct?.id || '',
    productName: defaultProduct?.name || '',
  });
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const openProductList = async () => {
    if (products) return;
    try {
      const r = await Products.list({ limit: 50 });
      setProducts(r.list || []);
    } catch (e: any) { /* ignore */ }
  };

  const bind = (k: keyof typeof form) => ({
    value: (form as any)[k],
    onChange: (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value }),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 基础校验
    if (!form.name || !form.email || !form.whatsapp) return showToast({ type: 'error', text: t('form.required') });
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(form.email)) return showToast({ type: 'error', text: t('form.invalid_email') });
    try {
      setLoading(true);
      await Inquiries.submit({
        ...form,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        productId: form.productId || undefined,
        productName: form.productName || undefined,
        source,
      });
      setSubmitted(true);
      showToast({ type: 'success', text: t('form.success') });
    } catch (e: any) {
      showToast({ type: 'error', text: e.message || t('form.error') });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className={`gold-card p-10 text-center ${className}`}>
        <div className="w-16 h-16 rounded-full border-2 border-ceramic-gold-matte flex items-center justify-center text-ceramic-gold-matte mx-auto mb-5">
          <Send size={28} />
        </div>
        <h3 className="serif-heading text-[26px] mb-3">{t('form.success').split('!')[0]}!</h3>
        <p className="text-ceramic-ash max-w-md mx-auto leading-relaxed">{t('form.success')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`gold-card p-7 md:p-10 ${className}`}>
      <h3 className="serif-heading text-[26px] mb-2">{t(titleKey)}</h3>
      <p className="text-ceramic-ash text-sm mb-7">{t(subKey)}</p>

      <div className={`grid gap-5 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        <div>
          <label className="label">{t('form.name')} *</label>
          <input className="input" required {...bind('name')} />
        </div>
        <div>
          <label className="label">{t('form.email')} *</label>
          <input className="input" required type="email" {...bind('email')} />
        </div>
        <div>
          <label className="label">{t('form.whatsapp')} *</label>
          <input className="input" required placeholder="+971 50 123 4567" {...bind('whatsapp')} />
        </div>
        <div>
          <label className="label">{t('form.country')}</label>
          <input className="input" placeholder="UAE" {...bind('country')} />
        </div>
        {!compact && (
          <>
            <div>
              <label className="label">{t('form.company')}</label>
              <input className="input" {...bind('company')} />
            </div>
            <div>
              <label className="label">{t('form.qty')}</label>
              <input className="input" type="number" min={1} placeholder="100" {...bind('quantity')} />
            </div>
          </>
        )}
        {compact && (
          <div className="md:col-span-1">
            <label className="label">{t('form.qty')}</label>
            <input className="input" type="number" min={1} {...bind('quantity')} />
          </div>
        )}

        {showProductSelect && (
          <div className={`${compact ? '' : 'md:col-span-2'}`}>
            <label className="label">{t('form.product')}</label>
            <select
              className="input cursor-pointer"
              onFocus={openProductList}
              {...bind('productId')}
              onChange={(e) => {
                const id = e.target.value;
                const p = products?.find(x => x._id === id);
                setForm({
                  ...form,
                  productId: id,
                  productName: p ? (lang === 'ar' ? p.nameAr : p.nameEn) : '',
                });
              }}
            >
              <option value="">{t('form.product_none')}</option>
              {defaultProduct?.id && <option value={defaultProduct.id} selected>{defaultProduct.name || t('form.product_placeholder')}</option>}
              {(products || []).map(p => (
                <option key={p._id} value={p._id}>
                  [{p.sku}] {pickBilingual(p, lang)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={`${compact ? '' : 'md:col-span-2'}`}>
          <label className="label">{t('form.custom')}</label>
          <textarea
            rows={5}
            className="input resize-none"
            placeholder={t('form.custom_placeholder') as any}
            {...bind('customDemand')}
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-6 flex-wrap">
        <label className="text-xs text-ceramic-ash flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" className="accent-ceramic-gold-matte" defaultChecked />
          {t('form.agree')}
        </label>
        <button type="submit" className="btn-gold" disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? t('common.loading') : t('cta.send')}
        </button>
      </div>
    </form>
  );
};

export default InquiryForm;

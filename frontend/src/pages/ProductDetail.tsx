import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MessageCircle, Check, Plus, Minus, ZoomIn } from 'lucide-react';
import SEO from '../components/common/SEO';
import InquiryForm from '../components/common/InquiryForm';
import ProductCard from '../components/common/ProductCard';
import { Products } from '../api';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { buildWhatsAppLink, CATEGORY_I18N, copyText, MATERIAL_I18N, pickBilingual, secondsToMMSS } from '../utils';

const ROWS: { k: keyof Product | 'price'; labelK: string; format?: (p: Product) => string }[] = [
  { k: 'sku', labelK: 'products.sku', format: p => p.sku },
  { k: 'category', labelK: 'products.category', format: p => CATEGORY_I18N[p.category] || '-' },
  { k: 'material', labelK: 'products.material', format: p => MATERIAL_I18N[p.material] || p.material },
  { k: 'glazeColor', labelK: 'products.glaze' },
  { k: 'size', labelK: 'products.size' },
  { k: 'moq', labelK: 'products.moq', format: p => `${p.moq} pcs` },
  { k: 'price', labelK: 'products.price_range', format: p => `$${p.priceMin} – $${p.priceMax} USD` },
];

const ProductDetail: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { lang, showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [imgIdx, setImgIdx] = useState(0);
  const [tab, setTab] = useState<'desc' | 'care' | 'ship' | 'oem'>('desc');
  const [qty, setQty] = useState(1);

  // 放大镜：悬停坐标
  const zoomWrapRef = useRef<HTMLDivElement | null>(null);
  const [[xPct, yPct, show], setZoom] = useState<[number, number, boolean]>([0, 0, false]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        setLoading(true);
        const { product: p, related: r } = await Products.detail(id);
        setProduct(p);
        setRelated(r || []);
      } catch (e: any) {
        showToast({ type: 'error', text: e.message || 'Product not found' });
      } finally { setLoading(false); }
    })();
  }, [id, showToast]);

  if (loading) {
    return <div className="section"><div className="w-full h-[520px] bg-ceramic-pearl animate-pulse gold-card" /></div>;
  }
  if (!product) {
    return <div className="section text-center">
      <div className="serif-heading text-3xl mb-4">Product not found</div>
      <button className="btn-gold-outline" onClick={() => nav('/products')}>{t('cta.back_products')}</button>
    </div>;
  }

  const name = pickBilingual(product, lang);
  const descL = lang === 'ar' ? product.descAr : product.descEn;
  const careL = lang === 'ar' ? product.careAr : product.careEn;
  const shipL = lang === 'ar' ? product.shippingNoteAr : product.shippingNoteEn;
  const images = [...product.images];
  const allImgs = [...images, ...product.detailImages];

  // 放大镜：mouseMove 换算 %
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = zoomWrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setZoom([Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)), true]);
  };

  // "快速支付（U）"：构造临时订单，跳到 /checkout 并在 sessionStorage 存草稿
  const goCheckout = () => {
    const payload = {
      items: [{ productId: product._id, name, price: product.priceMax, qty: Math.max(1, qty) }],
      contactInfo: {},
      customDemand: '',
    };
    sessionStorage.setItem('luxe.checkoutDraft', JSON.stringify(payload));
    nav('/checkout');
  };

  return (
    <>
      <SEO rawTitle={`${name} — ${t('brand.name')}`} rawDescription={descL} ogImage={product.images[0]} />

      {/* 面包屑 */}
      <div className="section !pt-8 !pb-4">
        <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-2 flex items-center gap-2">
          <Link to="/" className="hover:text-ceramic-graphite">{t('nav.home')}</Link> /
          <Link to="/products" className="hover:text-ceramic-graphite">{t('nav.products')}</Link> /
          <span className="text-ceramic-graphite">{name}</span>
        </div>
        <button onClick={() => nav(-1)} className="btn-ghost !px-0">
          <ArrowLeft size={14} /> {t('cta.back_products')}
        </button>
      </div>

      <section className="section !pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 items-start">

          {/* ---------- 图（轮播+放大镜） ---------- */}
          <div className="space-y-4">
            <div
              ref={zoomWrapRef}
              className="relative gold-card overflow-hidden aspect-[4/3] bg-ceramic-pearl group cursor-crosshair"
              onMouseMove={onMove}
              onMouseLeave={() => setZoom([xPct, yPct, false])}
            >
              <img
                src={allImgs[imgIdx]}
                alt={name}
                className="w-full h-full object-cover transition-transform duration-300"
                style={{
                  transform: show ? `scale(2.2)` : 'scale(1)',
                  transformOrigin: `${xPct}% ${yPct}%`,
                }}
              />
              <div className="absolute top-4 end-4 flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-1.5 text-[11px] tracking-luxury uppercase text-ceramic-ash">
                <ZoomIn size={14} /> Hover to zoom
              </div>
            </div>
            {/* 缩略图 */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {allImgs.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`shrink-0 w-24 h-20 md:w-28 md:h-24 gold-card overflow-hidden
                    ${i === imgIdx ? 'ring-2 ring-ceramic-gold-matte' : ''}`}
                >
                  <img src={src} alt={`${name}-${i}`} loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* ---------- 右侧：参数 + 按钮 ---------- */}
          <div className="lg:sticky lg:top-28">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-3">{t(CATEGORY_I18N[product.category] || 'footer.p_oem')} · SKU {product.sku}</div>
            <h1 className="serif-heading text-[34px] md:text-[42px] leading-[1.1] mb-5">{name}</h1>
            <p className="text-ceramic-ash leading-[2] mb-8 min-h-[5rem]">{descL || '—'}</p>

            {/* 工艺参数表 */}
            <div className="gold-card overflow-hidden mb-8">
              <table className="w-full text-sm">
                <tbody>
                  {ROWS.map((r, i) => {
                    const v = (r.format ? r.format(product) : String((product as any)[r.k] || ''));
                    return (
                      <tr key={r.k} className={i % 2 ? 'bg-ceramic-offWhite/60' : ''}>
                        <td className="px-5 py-3 text-ceramic-ash w-1/2 text-[11px] tracking-luxury uppercase">{t(r.labelK)}</td>
                        <td className="px-5 py-3 text-ceramic-graphite">
                          {r.k === 'category' ? t(v as string) : v}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* OEM 选项 Tag */}
            {product.oemOptions?.length > 0 && (
              <div className="mb-8">
                <h4 className="label">{t('products.oem_options')}</h4>
                <div className="flex flex-wrap gap-2">
                  {product.oemOptions.map(o => (
                    <span key={o} className="badge border border-ceramic-gold-light text-ceramic-gold-deep bg-ceramic-cream hover:bg-ceramic-gold-light transition-colors">
                      <Check size={11} /> {o}
                    </span>
                  ))}
                </div>
                {product.isCustom && (
                  <p className="text-[12px] text-ceramic-gold-matte mt-3 flex items-center gap-1">
                    <Check size={13} /> {t('products.oem_available')}
                  </p>
                )}
              </div>
            )}

            {/* 数量 & 动作 */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('products.qty')}</div>
              <div className="inline-flex items-center border border-ceramic-border bg-white">
                <button className="p-3 text-ceramic-ash hover:text-ceramic-graphite" onClick={() => setQty(q => Math.max(1, q - 1))}><Minus size={14} /></button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 text-center py-3 outline-none bg-transparent text-ceramic-graphite"
                />
                <button className="p-3 text-ceramic-ash hover:text-ceramic-graphite" onClick={() => setQty(q => q + 1)}><Plus size={14} /></button>
              </div>
              <div className="ms-auto text-right">
                <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('products.price_range')}</div>
                <div className="serif-heading text-[28px] gold-text">${product.priceMin} – ${product.priceMax}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <a
                href={buildWhatsAppLink({ preset: 'product', t, productName: name, sku: product.sku })}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold-outline justify-center"
              >
                <MessageCircle size={15} /> {t('cta.whatsapp_inquire')}
              </a>
              <button className="btn-gold justify-center" onClick={goCheckout}>
                {t('cta.pay_with_u')}
              </button>
            </div>
          </div>
        </div>

        {/* ---------- Tabs：详细说明 / 保养 / 物流 / OEM 定制 ---------- */}
        <div className="mt-20">
          <div className="flex gap-1 md:gap-6 overflow-x-auto border-b border-ceramic-border mb-8">
            {(
              [
                ['desc', 'Description'],
                ['care', t('products.care')],
                ['ship', t('products.shipping')],
                ['oem', t('products.custom_title')],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`whitespace-nowrap px-4 py-4 text-sm transition-colors tracking-wide border-b-2 -mb-px
                  ${tab === k ? 'border-ceramic-gold-matte text-ceramic-graphite' : 'border-transparent text-ceramic-ash hover:text-ceramic-graphite'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'desc' && (
            <div className="gold-card p-8 md:p-12 leading-[2] whitespace-pre-wrap text-ceramic-ash">
              <p className="serif-heading text-[22px] text-ceramic-graphite mb-4">{name}</p>
              {descL || t('products.description')}
            </div>
          )}
          {tab === 'care' && (
            <div className="gold-card p-8 md:p-12 leading-[2] text-ceramic-ash">
              <h4 className="serif-heading text-[22px] text-ceramic-graphite mb-4">{t('products.care')}</h4>
              {careL || t('products.care_text')}
            </div>
          )}
          {tab === 'ship' && (
            <div className="gold-card p-8 md:p-12 leading-[2] text-ceramic-ash">
              <h4 className="serif-heading text-[22px] text-ceramic-graphite mb-4">{t('products.shipping')}</h4>
              {shipL || t('products.shipping_text')}
            </div>
          )}
          {tab === 'oem' && (
            <InquiryForm
              defaultProduct={{ id: product._id, name }}
              source="product"
              compact
              showProductSelect={false}
              titleKey="products.custom_title"
              subKey="products.custom_sub"
            />
          )}
        </div>

        {/* ---------- 相关产品 ---------- */}
        {related.length > 0 && (
          <div className="mt-20">
            <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
              <h3 className="serif-heading text-[30px] md:text-[36px]">{t('products.related_products')}</h3>
              <Link to="/products" className="btn-ghost">{t('cta.view_all')}</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
              {related.slice(0, 4).map(p => <ProductCard key={p._id} product={p} />)}
            </div>
          </div>
        )}
      </section>
    </>
  );
};

export default ProductDetail;

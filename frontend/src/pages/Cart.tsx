/**
 * 购物车页面 /cart
 * - 列表展示 cart items（图、名、单价、数量加减、小计、删除）
 * - 空购物车提示 + 去逛逛入口
 * - 结算汇总 + 去结算按钮（写入 sessionStorage 草稿后跳 /checkout，兼容现有 Checkout 流程）
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import SEO from '../components/common/SEO';
import { useCart } from '../context/AppContext';

const Cart: React.FC = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { items, count, total, updateQty, remove, clear } = useCart();

  const goCheckout = () => {
    // cart.items → sessionStorage 草稿，兼容现有 Checkout 流程
    const draft = {
      items: items.map(i => ({ ...i })),
      contactInfo: {},
      customDemand: '',
    };
    sessionStorage.setItem('luxe.checkoutDraft', JSON.stringify(draft));
    nav('/checkout');
  };

  return (
    <>
      <SEO titleKey="cart.title" descriptionKey="cart.sub" />
      <section className="section !pt-16 !pb-10">
        <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-3">
          <Link to="/" className="hover:text-ceramic-graphite">{t('nav.home')}</Link>
          <span className="mx-3">/</span>
          {t('cart.title')}
        </div>
        <h1 className="serif-heading text-[40px] md:text-[48px] mb-3">{t('cart.title')}</h1>
        <p className="text-ceramic-ash">{t('cart.sub')}</p>
      </section>

      {items.length === 0 ? (
        <section className="section !pt-4 !pb-24">
          <div className="gold-card p-16 text-center">
            <ShoppingBag size={48} className="mx-auto text-ceramic-ash mb-6" />
            <div className="serif-heading text-[26px] mb-3">{t('cart.empty')}</div>
            <p className="text-ceramic-ash mb-8">{t('cart.empty_hint')}</p>
            <Link to="/products" className="btn-gold">{t('cart.browse')}</Link>
          </div>
        </section>
      ) : (
        <section className="section !pt-4 !pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
            {/* 商品列表 */}
            <div className="space-y-4">
              {items.map(it => (
                <div key={it.productId} className="gold-card p-4 flex gap-4 items-center">
                  <Link to={`/products/${it.productId}`} className="shrink-0 w-24 h-24 bg-ceramic-pearl overflow-hidden">
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/products/${it.productId}`} className="serif-heading text-[17px] text-ceramic-graphite hover:text-ceramic-gold-deep line-clamp-1">
                      {it.name}
                    </Link>
                    {it.sku && <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mt-1">SKU {it.sku}</div>}
                    <div className="text-sm gold-text mt-1">${it.price.toFixed(2)}</div>
                  </div>
                  {/* 数量加减 */}
                  <div className="inline-flex items-center border border-ceramic-border">
                    <button className="p-2 text-ceramic-ash hover:text-ceramic-graphite" onClick={() => updateQty(it.productId, it.qty - 1)}><Minus size={14} /></button>
                    <span className="w-10 text-center text-sm text-ceramic-graphite">{it.qty}</span>
                    <button className="p-2 text-ceramic-ash hover:text-ceramic-graphite" onClick={() => updateQty(it.productId, it.qty + 1)}><Plus size={14} /></button>
                  </div>
                  {/* 小计 */}
                  <div className="text-right shrink-0 w-24">
                    <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash">{t('cart.subtotal')}</div>
                    <div className="serif-heading text-[18px] gold-text">${(it.price * it.qty).toFixed(2)}</div>
                  </div>
                  <button onClick={() => remove(it.productId)} className="p-2 text-ceramic-ash hover:text-red-500" aria-label="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <button onClick={clear} className="btn-ghost !px-0 text-ceramic-ash hover:text-red-500">
                  <Trash2 size={14} /> {t('cart.clear')}
                </button>
                <Link to="/products" className="btn-gold-outline !px-4 !py-2.5 !text-[11px]">
                  {t('cart.continue_shopping')}
                </Link>
              </div>
            </div>

            {/* 结算汇总 */}
            <aside className="lg:sticky lg:top-28 self-start">
              <div className="gold-card p-6 space-y-4">
                <h3 className="serif-heading text-[22px]">{t('cart.summary')}</h3>
                <div className="flex justify-between text-sm text-ceramic-ash">
                  <span>{t('cart.items_count')}</span>
                  <span className="text-ceramic-graphite">{count}</span>
                </div>
                <div className="flex justify-between items-end border-t border-ceramic-border pt-4">
                  <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('cart.total')}</span>
                  <span className="serif-heading text-[28px] gold-text">${total.toFixed(2)}</span>
                </div>
                <button onClick={goCheckout} className="btn-gold w-full justify-center">
                  {t('cart.checkout')} <ArrowRight size={16} />
                </button>
                <p className="text-[11px] text-ceramic-ash text-center">{t('cart.secure_pay')}</p>
              </div>
            </aside>
          </div>
        </section>
      )}
    </>
  );
};

export default Cart;

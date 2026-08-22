/**
 * 产品卡片（列表/首页通用）
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { CATEGORY_I18N, buildWhatsAppLink, pickBilingual } from '../../utils';

interface Props {
  product: Product;
  imgClassName?: string;
}

export const ProductCard: React.FC<Props> = ({ product }) => {
  const { t } = useTranslation();
  const { lang } = useApp();
  const name = pickBilingual(product, lang);
  const desc = lang === 'ar' ? product.descAr : product.descEn;
  const catKey = CATEGORY_I18N[product.category] || 'footer.p_oem';

  return (
    <article className="gold-card group flex flex-col overflow-hidden">
      {/* 图片 */}
      <Link to={`/products/${product._id}`} className="block overflow-hidden relative aspect-[4/3] bg-ceramic-pearl">
        <img
          src={product.images[0]}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
        />
        {product.featured && (
          <span className="badge absolute top-4 start-4 bg-ceramic-gold-matte text-white">Featured</span>
        )}
        {product.isCustom && (
          <span className="badge absolute top-4 end-4 bg-ceramic-cream/90 text-ceramic-gold-deep border border-ceramic-gold-light">
            {t('products.oem_available')}
          </span>
        )}
      </Link>

      <div className="p-6 flex-1 flex flex-col">
        <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash mb-2">{t(catKey)}</div>
        <Link to={`/products/${product._id}`} className="serif-heading text-[19px] leading-snug text-ceramic-graphite hover:text-ceramic-gold-deep transition-colors mb-3 line-clamp-2">
          {name}
        </Link>
        <p className="text-sm text-ceramic-ash leading-relaxed line-clamp-2 mb-5 min-h-[3rem]">{desc || '—'}</p>
        <div className="mt-auto">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash">{t('products.price_range')}</div>
              <div className="serif-heading text-[20px] gold-text">
                ${product.priceMin} – ${product.priceMax}
              </div>
            </div>
            <div className="text-[11px] text-ceramic-ash">
              MOQ: <b className="text-ceramic-graphite">{product.moq}</b>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to={`/products/${product._id}`} className="btn-gold-outline flex-1 !px-4 !py-2.5 !text-[11px]">
              {t('cta.view_detail')}
              <ArrowRight size={14} />
            </Link>
            <a
              href={buildWhatsAppLink({ preset: 'product', productName: name, sku: product.sku, t })}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold !px-4 !py-2.5 !text-[11px]"
              aria-label="WhatsApp"
            >
              <MessageCircle size={14} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;

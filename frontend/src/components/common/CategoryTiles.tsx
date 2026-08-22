/**
 * 首页产品分类入口卡片（6 个）
 * 纯静态，点击跳到 /products?category=xxx
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const CATS = [
  { key: 'tableware',    pic: '/images/cat-tableware.jpg', titleKey: 'footer.p_tableware',    sub: 'Fine Tableware' },
  { key: 'vase',         pic: '/images/cat-vase.jpg',      titleKey: 'footer.p_vase',         sub: 'Art Vases' },
  { key: 'art-sculpture',pic: '/images/cat-sculpture.jpg', titleKey: 'footer.p_sculpture',    sub: 'Art Sculptures' },
  { key: 'hotel-ware',   pic: '/images/cat-hotelware.jpg', titleKey: 'footer.p_hotelware',    sub: 'Hotel Collections' },
  { key: 'tiles',        pic: '/images/cat-tiles.jpg',     titleKey: 'footer.p_tiles',        sub: 'Ceramic Tiles' },
  { key: 'oem-sample',   pic: '/images/cat-oem.jpg',       titleKey: 'footer.p_oem',          sub: 'OEM Customization' },
];

export const CategoryTiles: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-5 lg:gap-7">
      {CATS.map((c, idx) => (
        <Link
          key={c.key}
          to={`/products?category=${c.key}`}
          className={`group relative aspect-[4/3] overflow-hidden bg-ceramic-pearl gold-card ${idx === 5 ? 'md:col-span-3 lg:col-span-1' : ''}`}
        >
          <img
            src={c.pic}
            alt={t(c.titleKey)}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-[1500ms] ease-out group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-6 text-white">
            <div className="text-[11px] tracking-luxury uppercase opacity-80 mb-2">{c.sub}</div>
            <div className="flex items-end justify-between gap-4">
              <h3 className="serif-heading text-[22px] md:text-[24px] leading-snug">{t(c.titleKey)}</h3>
              <span className="flex items-center justify-center w-10 h-10 rounded-full border border-white/40 text-white group-hover:bg-ceramic-gold-matte group-hover:border-ceramic-gold-matte transition-all duration-500 shrink-0">
                <ArrowUpRight size={18} />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default CategoryTiles;

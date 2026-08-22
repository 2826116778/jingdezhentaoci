import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { SlidersHorizontal, X, SortAsc } from 'lucide-react';
import SEO from '../components/common/SEO';
import ProductCard from '../components/common/ProductCard';
import { Products } from '../api';
import { Product } from '../types';
import { useApp } from '../context/AppContext';

// 价格区间（Slider 双滑块用 HTML5 input range 简化实现）
const CATEGORY_OPTIONS = [
  { v: 'tableware', k: 'footer.p_tableware' },
  { v: 'vase', k: 'footer.p_vase' },
  { v: 'art-sculpture', k: 'footer.p_sculpture' },
  { v: 'hotel-ware', k: 'footer.p_hotelware' },
  { v: 'tiles', k: 'footer.p_tiles' },
  { v: 'oem-sample', k: 'footer.p_oem' },
];
const MAT_OPTIONS = [
  { v: 'bone-china', label: 'Bone China' },
  { v: 'porcelain', label: 'Porcelain' },
  { v: 'stoneware', label: 'Stoneware' },
  { v: 'ceramic', label: 'Ceramic' },
];
const SORT_OPTIONS: { v: string; k: string }[] = [
  { v: 'new', k: 'products.sort_new' },
  { v: 'price_asc', k: 'products.sort_price_asc' },
  { v: 'price_desc', k: 'products.sort_price_desc' },
];

const ProductList: React.FC = () => {
  const { t } = useTranslation();
  const loc = useLocation();
  const nav = useNavigate();
  const { lang } = useApp();

  // URL query 同步
  const qs = new URLSearchParams(loc.search);
  const [category, setCategory] = useState<string[]>(() => qs.get('category') ? [qs.get('category') as string] : []);
  const [material, setMaterial] = useState<string[]>([]);
  const [availability, setAvailability] = useState<'all' | 'custom' | 'stock'>('all');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(5000);
  const [sort, setSort] = useState<string>(qs.get('sort') || 'new');

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [list, setList] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 监听 category 跳页（从首页分类入口传入）
  useEffect(() => {
    const c = qs.get('category');
    if (c && !category.includes(c)) setCategory([c]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search]);

  // 每次过滤条件变化 -> 刷新
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const params: any = { sort, page: 1, limit: 48 };
        if (category.length) { params.category = category.join(','); }
        if (material.length) { params.material = material.join(','); }
        if (availability === 'custom') params.isCustom = 1;
        if (availability === 'stock') params.isStock = 1;
        if (minPrice > 0) params.minPrice = minPrice;
        if (maxPrice < 5000) params.maxPrice = maxPrice;
        const r = await Products.list(params);
        if (!alive) return;
        setList(r.list || []);
        setTotal(r.total);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [category, material, availability, minPrice, maxPrice, sort]);

  const toggleInArr = (arr: string[], v: string, setter: (s: string[]) => void) =>
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const clearAll = () => {
    setCategory([]); setMaterial([]); setAvailability('all');
    setMinPrice(0); setMaxPrice(5000); setSort('new');
    nav('/products', { replace: true });
  };

  const filtersCount = useMemo(
    () => category.length + material.length + (availability !== 'all' ? 1 : 0) + ((minPrice > 0 || maxPrice < 5000) ? 1 : 0),
    [category, material, availability, minPrice, maxPrice],
  );

  return (
    <>
      <SEO titleKey="products.title" descriptionKey="products.sub" />
      {/* 页头 */}
      <section className="relative bg-ceramic-offWhite border-b border-ceramic-border">
        <div className="section !pt-16 !pb-14">
          <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-3">
            <span className="hover:text-ceramic-graphite cursor-pointer" onClick={() => nav('/')}>{t('nav.home')}</span>
            <span className="mx-3 text-ceramic-border">/</span>
            {t('nav.products')}
          </div>
          <h1 className="serif-heading text-[40px] md:text-[54px] leading-tight mb-3">{t('products.title')}</h1>
          <p className="text-ceramic-ash max-w-3xl leading-relaxed">{t('products.sub')}</p>
        </div>
      </section>

      <section className="section !pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-10">

          {/* 筛选栏（移动端：滑出抽屉；LTR 左 RTL 右 → tailwindcss-flip 处理） */}
          {mobileFilterOpen && (
            <div className="fixed inset-0 bg-black/40 z-50 lg:hidden" onClick={() => setMobileFilterOpen(false)} />
          )}
          <aside className={`
            fixed top-0 bottom-0 ${lang === 'ar' ? 'end-0' : 'start-0'} z-50 w-[88%] max-w-sm bg-ceramic-cream p-7 shadow-gold overflow-y-auto
            transition-transform duration-500
            ${mobileFilterOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}
            lg:static lg:!transform-none lg:!bg-transparent lg:!shadow-none lg:p-0 lg:!w-auto lg:!overflow-visible
          `}>
            <div className="flex items-center justify-between mb-6 lg:hidden">
              <h3 className="serif-heading text-[22px]">{t('products.filters')}</h3>
              <button onClick={() => setMobileFilterOpen(false)} className="p-2 text-ceramic-ash"><X size={20} /></button>
            </div>
            <div className="hidden lg:block mb-6">
              <h3 className="serif-heading text-[22px] mb-1">{t('products.filters')}</h3>
              {filtersCount > 0 && (
                <button className="btn-ghost !px-0" onClick={clearAll}>
                  <X size={13} /> {t('products.clear_all')} ({filtersCount})
                </button>
              )}
            </div>

            {/* 品类 */}
            <div className="mb-8">
              <h4 className="label">{t('products.f_category')}</h4>
              <ul className="flex flex-col gap-2">
                {CATEGORY_OPTIONS.map(o => (
                  <li key={o.v}>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-ceramic-graphite hover:text-ceramic-gold-matte transition-colors">
                      <input
                        type="checkbox"
                        className="accent-ceramic-gold-matte"
                        checked={category.includes(o.v)}
                        onChange={() => toggleInArr(category, o.v, setCategory)}
                      />
                      {t(o.k)}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {/* 材质 */}
            <div className="mb-8">
              <h4 className="label">{t('products.f_material')}</h4>
              <ul className="flex flex-col gap-2">
                {MAT_OPTIONS.map(o => (
                  <li key={o.v}>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-ceramic-graphite hover:text-ceramic-gold-matte">
                      <input
                        type="checkbox"
                        className="accent-ceramic-gold-matte"
                        checked={material.includes(o.v)}
                        onChange={() => toggleInArr(material, o.v, setMaterial)}
                      />
                      {o.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {/* 定制/现货 */}
            <div className="mb-8">
              <h4 className="label">{t('products.f_stock')}</h4>
              <div className="flex flex-col gap-2 text-sm">
                {(['all', 'custom', 'stock'] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-ceramic-graphite hover:text-ceramic-gold-matte">
                    <input
                      type="radio"
                      name="stock"
                      className="accent-ceramic-gold-matte"
                      checked={availability === v}
                      onChange={() => setAvailability(v)}
                    />
                    {t(v === 'all' ? 'products.f_all' : v === 'custom' ? 'products.f_custom' : 'products.f_stock_only')}
                  </label>
                ))}
              </div>
            </div>

            {/* 价格区间 */}
            <div className="mb-8">
              <h4 className="label">{t('products.f_price_range')}</h4>
              <div className="flex items-center gap-3 mb-3 text-sm text-ceramic-graphite">
                <input className="input !py-2 !text-center" type="number" value={minPrice} onChange={e => setMinPrice(Math.max(0, +e.target.value || 0))} />
                <span className="text-ceramic-ash">–</span>
                <input className="input !py-2 !text-center" type="number" value={maxPrice} onChange={e => setMaxPrice(Math.max(minPrice, +e.target.value || 0))} />
                <span className="text-ceramic-ash">$</span>
              </div>
              <input type="range" min={0} max={5000} step={50} value={minPrice}
                onChange={e => setMinPrice(Math.min(maxPrice, +e.target.value))}
                className="w-full accent-ceramic-gold-matte mb-2" />
              <input type="range" min={0} max={5000} step={50} value={maxPrice}
                onChange={e => setMaxPrice(Math.max(minPrice, +e.target.value))}
                className="w-full accent-ceramic-gold-matte" />
            </div>

            <button className="lg:hidden btn-gold w-full mb-3" onClick={() => setMobileFilterOpen(false)}>
              {t('common.loading')} · {filtersCount} {t('products.results')}
            </button>
            <button className="lg:hidden btn-gold-outline w-full" onClick={clearAll}>{t('products.clear_all')}</button>
          </aside>

          {/* 主区：顶栏排序 + 网格 */}
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <button className="lg:hidden btn-gold-outline !px-4 !py-2 !text-[11px]" onClick={() => setMobileFilterOpen(true)}>
                  <SlidersHorizontal size={14} /> {t('products.filters')} ({filtersCount})
                </button>
                <div className="text-sm text-ceramic-ash">
                  <b className="text-ceramic-graphite">{total}</b> {t('products.results')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SortAsc size={14} className="text-ceramic-ash" />
                <select className="input !w-auto !py-2 text-xs" value={sort} onChange={e => setSort(e.target.value)}>
                  {SORT_OPTIONS.map(o => <option key={o.v} value={o.v}>{t(o.k)}</option>)}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-7">
                {[...Array(12)].map((_, i) => <div key={i} className="gold-card aspect-[4/5] animate-pulse" />)}
              </div>
            ) : list.length === 0 ? (
              <div className="gold-card p-16 text-center">
                <div className="serif-heading text-[28px] mb-3">No products found</div>
                <p className="text-ceramic-ash mb-8">Try clearing some filters.</p>
                <button className="btn-gold-outline" onClick={clearAll}>{t('products.clear_all')}</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-7">
                {list.map(p => <ProductCard key={p._id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default ProductList;

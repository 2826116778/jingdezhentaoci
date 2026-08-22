import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, Factory, Award, Quote } from 'lucide-react';
import SEO from '../components/common/SEO';
import CategoryTiles from '../components/common/CategoryTiles';
import ProductCard from '../components/common/ProductCard';
import CaseCard from '../components/common/CaseCard';
import { Products, Cases } from '../api';
import { Case, Product } from '../types';
import { useApp } from '../context/AppContext';
import { pickBilingual } from '../utils';

const HERO_BG = [
  '/images/hero-tableware-gold.jpg',
  '/images/hero-vase-artisan.jpg',
  '/images/hero-middle-east-platter.jpg',
];

const FACT_STATS = [
  { num: 30, suffix: '+', labelKey: 'home.f_years' },
  { num: 500, suffix: '+', labelKey: 'home.f_projects' },
  { num: 20000, suffix: '', labelKey: 'home.f_factory' },
  { num: 100, suffix: '%', labelKey: 'home.f_handmade' },
];

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { lang } = useApp();
  const [slideIdx, setSlideIdx] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  // Banner 自动轮播 6s
  useEffect(() => {
    const t = setInterval(() => setSlideIdx(i => (i + 1) % HERO_BG.length), 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [ps, cs] = await Promise.all([Products.featured(), Cases.featured()]);
        setProducts(ps || []);
        setCases(cs || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const heroImg = useMemo(() => HERO_BG[slideIdx], [slideIdx]);

  return (
    <>
      <SEO
        rawTitle={`${t('brand.name')} — ${t('home.hero_title_1')} ${t('home.hero_title_2')}`}
        rawDescription={t('brand.tagline') + ' ' + t('footer.about_text')}
      />

      {/* ==================================
          首屏 Hero：100vh + 大图渐变遮罩
          ================================== */}
      <section className="relative h-[100svh] min-h-[600px] w-full overflow-hidden">
        {HERO_BG.map((bg, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-[1800ms] ease-out
              ${i === slideIdx ? 'opacity-100 scale-105' : 'opacity-0 scale-100'}`}
            style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/25 to-ceramic-cream/70" />
        {/* 装饰金线 */}
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-ceramic-gold-matte/70 to-transparent" />

        <div className="section relative z-10 h-full flex flex-col justify-center text-white pt-28 pb-20 max-w-[1400px] mx-auto">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-luxury uppercase mb-8 px-4 py-2 border border-white/30 bg-white/5 backdrop-blur">
            <Sparkles size={14} className="text-ceramic-gold-soft" />
            {t('brand.tagline')}
          </div>
          <h1 className="serif-heading font-semibold leading-[1.08] mb-6">
            <span className="block text-[46px] md:text-[72px] lg:text-[88px]">{t('home.hero_title_1')}</span>
            <span className="block text-[56px] md:text-[92px] lg:text-[112px] gold-text">{t('home.hero_title_2')}</span>
          </h1>
          <p className="max-w-2xl text-[16px] md:text-[18px] leading-relaxed text-white/85 mb-10">
            {t('home.hero_subtitle')}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/products" className="btn-gold">
              {t('home.hero_cta_1')} <ArrowRight size={16} />
            </Link>
            <Link to="/oem" className="btn-gold-outline border-white/60 text-white hover:bg-white hover:text-ceramic-graphite">
              {t('home.hero_cta_2')}
            </Link>
          </div>

          {/* 底部三个小圆点（轮播） */}
          <div className="absolute bottom-10 start-1/2 -translate-x-1/2 flex items-center gap-3">
            {HERO_BG.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIdx(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-[3px] transition-all duration-500
                  ${i === slideIdx ? 'w-14 bg-ceramic-gold-matte' : 'w-7 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ==================================
          品牌简介（2 列：文字 + 图）
          ================================== */}
      <section className="section bg-ceramic-cream">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-[1400px] mx-auto">
          <div className="animate-fade-in">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-4 flex items-center gap-2">
              <span className="w-8 h-[1px] bg-ceramic-gold-matte inline-block" />
              {t('home.brand_intro_title')}
            </div>
            <h2 className="serif-heading text-[38px] md:text-[52px] leading-[1.1] mb-8 text-ceramic-graphite">
              {t('home.brand_intro_title')}
              <span className="block gold-text mt-2">Since 1995</span>
            </h2>
            <p className="text-ceramic-ash leading-[2] text-[16px] mb-5">{t('home.brand_intro_p1')}</p>
            <p className="text-ceramic-ash leading-[2] text-[16px] mb-10">{t('home.brand_intro_p2')}</p>
            <div className="flex flex-wrap gap-4">
              <Link to="/about" className="btn-dark">{t('common.learn_more')} <ArrowRight size={16} /></Link>
              <Link to="/contact" className="btn-gold-outline">{t('cta.get_quote')}</Link>
            </div>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <img src="/images/about-artisan-handmade.jpg" alt="Master artisan hand-throwing porcelain" loading="lazy" className="w-full h-[360px] md:h-[520px] object-cover gold-card" />
              <div className="flex flex-col gap-4">
                <img src="/images/about-glaze-color.jpg" alt="Glaze mixing" loading="lazy" className="w-full h-[250px] object-cover gold-card" />
                <div className="gold-card p-7 flex-1 flex flex-col justify-center">
                  <Award className="text-ceramic-gold-matte mb-4" size={30} />
                  <div className="serif-heading text-[22px] mb-2">72 Steps</div>
                  <div className="text-sm text-ceramic-ash leading-relaxed">Every piece passes 72 meticulous handcraft steps from raw clay to final inspection.</div>
                </div>
              </div>
            </div>
            {/* 装饰金色方块 */}
            <div className="absolute -bottom-6 -end-6 w-24 h-24 bg-ceramic-gold-matte/20 -z-10 hidden md:block" />
          </div>
        </div>
      </section>

      {/* ==================================
          产品分类入口
          ================================== */}
      <section className="section bg-ceramic-offWhite">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-14 animate-fade-in">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-4">{t('brand.tagline')}</div>
            <h2 className="serif-heading text-[36px] md:text-[46px] mb-3">{t('home.category_title')}</h2>
            <p className="text-ceramic-ash max-w-2xl mx-auto">{t('home.category_sub')}</p>
          </div>
          <CategoryTiles />
        </div>
      </section>

      {/* ==================================
          推荐产品（8 条）
          ================================== */}
      <section className="section bg-ceramic-cream">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-end justify-between mb-12 gap-6 flex-wrap">
            <div className="animate-fade-in">
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-3">Featured</div>
              <h2 className="serif-heading text-[36px] md:text-[44px]">{t('nav.products')}</h2>
            </div>
            <Link to="/products" className="btn-ghost">{t('cta.view_all')} <ArrowRight size={14} /></Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="gold-card aspect-[4/3] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
              {products.map(p => <ProductCard key={p._id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* ==================================
          工程案例展示（4 条，首页卡片模态框跳转 /cases）
          ================================== */}
      <section className="section bg-ceramic-offWhite">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-end justify-between mb-12 gap-6 flex-wrap">
            <div className="animate-fade-in">
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-3">Portfolio</div>
              <h2 className="serif-heading text-[36px] md:text-[44px]">{t('home.case_title')}</h2>
              <p className="text-ceramic-ash mt-3 max-w-xl">{t('home.case_sub')}</p>
            </div>
            <Link to="/cases" className="btn-ghost">{t('cta.view_all')} <ArrowRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {cases.map(c => (
              <Link key={c._id} to="/cases">
                <CaseCard data={c} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================
          工厂实力（4 项数字卡片）
          ================================== */}
      <section className="section bg-ceramic-cream">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-3 flex items-center justify-center gap-2">
              <Factory size={14} /> {t('home.factory_title')}
            </div>
            <h2 className="serif-heading text-[36px] md:text-[44px]">{t('home.factory_title')}</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {FACT_STATS.map((s, i) => (
              <div key={i} className="gold-card p-8 md:p-10 text-center">
                <div className="serif-heading gold-text text-[60px] md:text-[72px] leading-none mb-2">
                  {s.num}<span className="text-[40px] align-top">{s.suffix}</span>
                </div>
                <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t(s.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================
          底部 CTA 条（哑光黑底+金字）
          ================================== */}
      <section className="bg-ceramic-graphite text-white">
        <div className="section !py-20 max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div>
            <Quote className="text-ceramic-gold-matte mb-6" size={40} />
            <h3 className="serif-heading text-[30px] md:text-[40px] leading-snug mb-3">
              {t('home.bottom_title')}
            </h3>
            <p className="text-white/70 max-w-2xl leading-relaxed">{t('home.bottom_sub')}</p>
          </div>
          <Link to="/contact" className="btn-gold !bg-ceramic-gold-matte !text-white shrink-0">
            {t('cta.get_quote')} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
};

export default Home;

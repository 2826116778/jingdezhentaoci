import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Globe, MessageCircle, ShoppingBag } from 'lucide-react';
import { useApp, useCart } from '../../context/AppContext';

const linkBase = 'transition-colors duration-300 text-sm tracking-luxury uppercase hover:text-ceramic-gold-deep';
const active = ({ isActive }: { isActive: boolean }) =>
  `${linkBase} ${isActive ? 'text-ceramic-gold-matte border-b border-ceramic-gold-matte pb-1' : 'text-ceramic-graphite'}`;

const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { lang, setLang, isRTL } = useApp();
  const { count } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // 路由切换关抽屉
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  const toggleLang = () => setLang(lang === 'en' ? 'ar' : 'en');
  const otherLangLabel = lang === 'en' ? 'عربي' : 'EN';

  if (isAdmin) return null; // 后台页面使用独立 AdminLayout

  return (
    <header
      className={`fixed top-0 start-0 end-0 z-40 transition-all duration-500
        ${scrolled
          ? 'bg-ceramic-cream/90 backdrop-blur border-b border-ceramic-border shadow-soft'
          : 'bg-transparent'}`}
    >
      <nav className="section !py-0 h-[84px] flex items-center justify-between">
        {/* 品牌 LOGO */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full border border-ceramic-gold-matte/70 flex items-center justify-center text-ceramic-gold-deep font-serif-bold serif-heading group-hover:bg-ceramic-gold-matte group-hover:text-white transition-colors">
            <span className="text-lg -mb-1">LC</span>
          </div>
          <div className="leading-tight">
            <div className="serif-heading text-[20px] md:text-[22px] text-ceramic-graphite group-hover:gold-text transition-all">{t('brand.name')}</div>
            <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash hidden md:block">{t('brand.tagline')}</div>
          </div>
        </Link>

        {/* 桌面菜单 */}
        <ul className="hidden lg:flex items-center gap-8">
          <li><NavLink to="/" end className={active}>{t('nav.home')}</NavLink></li>
          <li><NavLink to="/products" className={active}>{t('nav.products')}</NavLink></li>
          <li><NavLink to="/cases" className={active}>{t('nav.cases')}</NavLink></li>
          <li><NavLink to="/oem" className={active}>{t('nav.oem')}</NavLink></li>
          <li><NavLink to="/about" className={active}>{t('nav.about')}</NavLink></li>
          <li><NavLink to="/contact" className={active}>{t('nav.contact')}</NavLink></li>
        </ul>

        {/* 右上：购物车 + 语言 + Get Quote + 菜单 */}
        <div className="flex items-center gap-2 md:gap-4">
          <Link to="/cart" className="relative p-2 text-ceramic-graphite hover:text-ceramic-gold-deep transition-colors" aria-label="Cart">
            <ShoppingBag size={20} />
            {count > 0 && (
              <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-ceramic-gold-matte text-white text-[10px] rounded-full">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 px-3 py-2 text-xs tracking-luxury uppercase border border-ceramic-border hover:border-ceramic-gold-matte text-ceramic-ash hover:text-ceramic-graphite transition-colors"
            aria-label="Toggle language"
          >
            <Globe size={14} />
            {otherLangLabel}
          </button>
          <Link to="/contact" className="btn-gold hidden md:inline-flex !px-5 !py-2.5 !text-[11px]">
            <MessageCircle size={14} />
            {t('nav.get_quote')}
          </Link>
          <button onClick={() => setOpen(o => !o)} className="lg:hidden p-2 text-ceramic-graphite" aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* 移动端抽屉（RTL 自动右对齐） */}
      {open && (
        <div className="lg:hidden border-t border-ceramic-border bg-ceramic-cream/95 backdrop-blur">
          <ul className="flex flex-col p-6 gap-5">
            <li><NavLink to="/" end className={active}>{t('nav.home')}</NavLink></li>
            <li><NavLink to="/products" className={active}>{t('nav.products')}</NavLink></li>
            <li><NavLink to="/cases" className={active}>{t('nav.cases')}</NavLink></li>
            <li><NavLink to="/oem" className={active}>{t('nav.oem')}</NavLink></li>
            <li><NavLink to="/about" className={active}>{t('nav.about')}</NavLink></li>
            <li><NavLink to="/contact" className={active}>{t('nav.contact')}</NavLink></li>
            <li className="pt-3"><Link to="/contact" className="btn-gold w-full">{t('nav.get_quote')}</Link></li>
          </ul>
        </div>
      )}
    </header>
  );
};

export default Navbar;

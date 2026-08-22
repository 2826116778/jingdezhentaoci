import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../components/common/SEO';

const NotFound: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="section min-h-[75vh] flex items-center justify-center">
      <SEO titleKey="404.title" />
      <div className="text-center max-w-2xl">
        <div className="serif-heading text-[140px] md:text-[200px] leading-none gold-text mb-3 font-black tracking-tighter">404</div>
        <h1 className="serif-heading text-[30px] md:text-[42px] leading-tight mb-4">{t('404.title')}</h1>
        <p className="text-ceramic-ash leading-relaxed mb-10">{t('404.sub')}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/" className="btn-gold">{t('nav.home')}</Link>
          <Link to="/products" className="btn-gold-outline">{t('nav.products')}</Link>
          <Link to="/contact" className="btn-gold-outline">{t('nav.contact')}</Link>
        </div>
      </div>
    </section>
  );
};

export default NotFound;

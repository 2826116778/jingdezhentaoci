/**
 * SEO 组件（react-helmet-async） — 每页面包裹一次即可
 * en/ar 自动根据当前语言选 title/description
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';

interface Props {
  titleKey?: string;       // 可选翻译 key（不含 brand）；也可直接传 rawTitle
  descriptionKey?: string;
  rawTitle?: string;
  rawDescription?: string;
  ogImage?: string;
  canonical?: string;
}

export const SEO: React.FC<Props> = ({ titleKey, descriptionKey, rawTitle, rawDescription, ogImage, canonical }) => {
  const { t, i18n } = useTranslation();
  const { lang, isRTL } = useApp();

  const brand = t('brand.name');
  const pageTitle = rawTitle || (titleKey ? `${t(titleKey)} — ${brand}` : `${t('brand.tagline')} | ${brand}`);
  const desc = rawDescription || (descriptionKey ? t(descriptionKey) : t('footer.about_text'));
  const image = ogImage || `https://picsum.photos/seed/luxeceramics-og/1200/630`;
  const href = canonical || (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <Helmet prioritizeSeoTags>
      <html lang={lang} dir={isRTL ? 'rtl' : 'ltr'} />
      <title>{pageTitle}</title>
      <meta name="description" content={desc} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={lang === 'ar' ? 'ar_AE' : 'en_US'} />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="canonical" href={href} />
    </Helmet>
  );
};

export default SEO;

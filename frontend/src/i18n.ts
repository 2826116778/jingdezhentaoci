/**
 * i18n 初始化（i18next + browser detector + resources 从 public/locales JSON 懒加载）
 * 初始化后通过 useTranslation/ react-i18next 在组件中消费
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../public/locales/en/translation.json';
import ar from '../public/locales/ar/translation.json';

export const SUPPORTED_LANGS = ['en', 'ar'] as const;
export type Lang = typeof SUPPORTED_LANGS[number];

export const isRTL = (lang: Lang) => lang === 'ar';

/** 首次应用方向 & 语言（初始化 i18n 前立即执行一次，避免首屏闪） */
function applyLangDirection(lang: Lang) {
  if (typeof document === 'undefined') return;
  const isR = isRTL(lang);
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', isR ? 'rtl' : 'ltr');
  document.body.setAttribute('dir', isR ? 'rtl' : 'ltr');
  document.title = lang === 'ar' ? 'لوكس سيراميك — سيراميك فاخر وخدمة OEM' : 'LuxeCeramics — Luxury Ceramics & OEM';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en as any },
      ar: { translation: ar as any },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'luxeceramics.lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

// 语言切换同步 RTL
i18n.on('languageChanged', (lng) => {
  const lang = (SUPPORTED_LANGS as readonly string[]).includes(lng) ? (lng as Lang) : 'en';
  applyLangDirection(lang);
});

// 启动时立即应用
{
  const detected = (i18n.resolvedLanguage || i18n.language || 'en').substring(0, 2);
  const lang: Lang = (SUPPORTED_LANGS as readonly string[]).includes(detected) ? (detected as Lang) : 'en';
  applyLangDirection(lang);
  if (i18n.resolvedLanguage !== lang) i18n.changeLanguage(lang);
}

export default i18n;

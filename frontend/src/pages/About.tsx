import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/common/SEO';

const PIC = (s: string, w = 1200, h = 900) => `https://picsum.photos/seed/${encodeURIComponent(s)}/${w}/${h}`;

const HISTORY = [
  { year: '1995', k: 'about.h_1995' },
  { year: '2008', k: 'about.h_2008' },
  { year: '2015', k: 'about.h_2015' },
  { year: '2019', k: 'about.h_2019' },
  { year: '2024', k: 'about.h_2024' },
];
const FACTORY = [
  { pic: 'about-factory-throwing', capK: 'about.f_cap1', descK: 'about.f_cap1_desc' },
  { pic: 'about-factory-lab',     capK: 'about.f_cap2', descK: 'about.f_cap2_desc' },
  { pic: 'about-factory-kiln',    capK: 'about.f_cap3', descK: 'about.f_cap3_desc' },
  { pic: 'about-factory-qc',      capK: 'about.f_cap4', descK: 'about.f_cap4_desc' },
];
const CERTS = ['ISO 9001', 'CE', 'FDA Food Contact', 'GCC Mark', 'BSCI', 'SGS Audit', 'Sedex', 'Intertek'];

const About: React.FC = () => {
  const { t } = useTranslation();
  return (
    <>
      <SEO titleKey="nav.about" />
      {/* Story */}
      <section className="section grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center max-w-[1400px] mx-auto">
        <div>
          <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-4">{t('brand.name')}</div>
          <h1 className="serif-heading text-[40px] md:text-[52px] leading-[1.08] mb-8">
            {t('about.story_title')}
            <span className="block gold-text mt-2">Since 1995</span>
          </h1>
          <p className="text-ceramic-ash leading-[2] mb-5">{t('about.story_p1')}</p>
          <p className="text-ceramic-ash leading-[2] mb-5">{t('about.story_p2')}</p>
          <p className="text-ceramic-ash leading-[2]">{t('about.story_p3')}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <img src={PIC('about-founder-1', 1000, 1300)} className="aspect-[3/4] w-full object-cover gold-card" alt="Founder / master artisan" loading="lazy" />
          <div className="flex flex-col gap-4">
            <img src={PIC('about-workshop-1', 1000, 800)} className="aspect-[4/3] w-full object-cover gold-card" alt="Workshop" loading="lazy" />
            <img src={PIC('about-workshop-2', 1000, 900)} className="aspect-[4/3] w-full object-cover gold-card" alt="Glaze room" loading="lazy" />
          </div>
        </div>
      </section>

      {/* 工厂能力 */}
      <section className="section bg-ceramic-offWhite">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-14">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-3">Factory</div>
            <h2 className="serif-heading text-[36px] md:text-[44px] mb-3">{t('about.factory_title')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FACTORY.map((f, i) => (
              <div key={i} className="gold-card overflow-hidden group">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={PIC(f.pic, 900, 700)} className="w-full h-full object-cover transition-transform duration-[1500ms] group-hover:scale-105" alt={t(f.capK)} loading="lazy" />
                </div>
                <div className="p-6">
                  <h4 className="serif-heading text-[20px] mb-2">{t(f.capK)}</h4>
                  <p className="text-sm text-ceramic-ash leading-relaxed">{t(f.descK)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 资质证书 */}
      <section className="section">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-12">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-3">Certifications</div>
            <h2 className="serif-heading text-[36px] md:text-[44px] mb-3">{t('about.cert_title')}</h2>
            <p className="text-ceramic-ash max-w-2xl mx-auto">{t('about.cert_sub')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {CERTS.map(c => (
              <div key={c} className="gold-card aspect-[4/3] flex flex-col items-center justify-center p-6 text-center group hover:bg-ceramic-offWhite transition-colors">
                <div className="w-14 h-14 rounded-full bg-ceramic-gold-matte/10 flex items-center justify-center text-ceramic-gold-matte mb-4 group-hover:bg-ceramic-gold-matte group-hover:text-white transition-colors">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="5" />
                    <path d="M8.5 12.5L5 21l7-4 7 4-3.5-8.5" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="serif-heading text-[17px]">{c}</div>
                <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash mt-2">Certified</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 发展历程时间线 */}
      <section className="section bg-ceramic-offWhite">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-16">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-3">History</div>
            <h2 className="serif-heading text-[36px] md:text-[44px]">{t('about.history_title')}</h2>
          </div>
          <ol className="relative">
            <div className="absolute start-6 md:start-1/2 top-0 bottom-0 w-[1px] bg-ceramic-gold-light -translate-x-1/2 md:hidden" />
            <div className="absolute start-1/2 top-0 bottom-0 w-[1px] bg-ceramic-gold-light -translate-x-1/2 hidden md:block" />
            {HISTORY.map((h, i) => (
              <li key={i} className={`relative flex ${i % 2 === 0 ? 'md:justify-start' : 'md:justify-end'} mb-12 ps-16 md:ps-0`}>
                <div className="absolute start-6 md:start-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-ceramic-gold-matte border-4 border-ceramic-cream top-2 z-10" />
                <div className={`gold-card p-7 md:w-[45%] ${i % 2 === 0 ? '' : 'md:ms-auto'}`}>
                  <div className="serif-heading text-[26px] gold-text mb-2">{h.year}</div>
                  <p className="text-ceramic-ash leading-relaxed">{t(h.k)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
};

export default About;

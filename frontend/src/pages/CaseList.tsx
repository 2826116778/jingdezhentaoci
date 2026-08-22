import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import SEO from '../components/common/SEO';
import CaseCard from '../components/common/CaseCard';
import { Cases } from '../api';
import { Case } from '../types';
import { useApp } from '../context/AppContext';
import { pickBilingual } from '../utils';

const TABS = [
  { v: 'all', k: 'cases.tab_all' },
  { v: 'hotel', k: 'cases.tab_hotel' },
  { v: 'villa', k: 'cases.tab_villa' },
  { v: 'commercial', k: 'cases.tab_commercial' },
];

const CaseList: React.FC = () => {
  const { t } = useTranslation();
  const { lang } = useApp();
  const [tab, setTab] = useState('all');
  const [all, setAll] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Case | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await Cases.list({ limit: 50 });
        setAll(list || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const list = tab === 'all' ? all : all.filter(c => c.category === tab);

  return (
    <>
      <SEO titleKey="cases.title" descriptionKey="cases.sub" />
      <section className="bg-ceramic-offWhite border-b border-ceramic-border">
        <div className="section !pb-12">
          <h1 className="serif-heading text-[40px] md:text-[54px] leading-tight mb-3">{t('cases.title')}</h1>
          <p className="text-ceramic-ash max-w-3xl leading-relaxed">{t('cases.sub')}</p>
        </div>
      </section>

      <section className="section !pt-10">
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          {TABS.map(tt => (
            <button
              key={tt.v}
              onClick={() => setTab(tt.v)}
              className={`px-6 py-3 text-xs tracking-luxury uppercase transition-all duration-300
                ${tab === tt.v
                  ? 'bg-ceramic-gold-matte text-white shadow-gold'
                  : 'border border-ceramic-border text-ceramic-ash hover:text-ceramic-graphite hover:border-ceramic-gold-matte'}`}
            >
              {t(tt.k)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[...Array(6)].map((_, i) => <div key={i} className="gold-card aspect-[4/3] animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {list.map(c => <CaseCard key={c._id} data={c} onOpen={setActive} />)}
          </div>
        )}
      </section>

      {/* 详情模态框 */}
      {active && (
        <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex items-start md:items-center justify-center p-4 md:p-8 overflow-y-auto animate-fade-in" onClick={() => setActive(null)}>
          <div className="bg-ceramic-cream w-full max-w-5xl my-auto gold-card overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <img src={active.coverImage} alt={pickBilingual(active, lang)} className="w-full h-[380px] md:h-[520px] object-cover" />
              <button onClick={() => setActive(null)} className="absolute top-5 end-5 w-10 h-10 rounded-full bg-white/90 text-ceramic-graphite hover:bg-ceramic-gold-matte hover:text-white transition-colors flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            <div className="p-8 md:p-12">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div>
                  <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-2">
                    {active.year} · {lang === 'ar' ? active.locationAr : active.locationEn}
                  </div>
                  <h2 className="serif-heading text-[32px] md:text-[42px] leading-tight mb-2">{pickBilingual(active, lang)}</h2>
                  <div className="text-ceramic-ash">{lang === 'ar' ? active.clientNameAr : active.clientNameEn}</div>
                </div>
                <span className="badge bg-ceramic-gold-matte text-white">
                  {active.category === 'hotel' ? t('cases.tab_hotel') : active.category === 'villa' ? t('cases.tab_villa') : t('cases.tab_commercial')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <h4 className="label mb-3">{t('cases.overview')}</h4>
                  <p className="leading-[2] text-ceramic-ash">{lang === 'ar' ? active.descAr : active.descEn}</p>
                </div>
                <div>
                  <h4 className="label mb-3">{t('cases.scope')}</h4>
                  <p className="leading-[2] text-ceramic-ash">{lang === 'ar' ? active.scopeAr : active.scopeEn}</p>
                </div>
              </div>

              {active.images?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
                  {active.images.map((src, i) => (
                    <img key={i} src={src} alt={`project-${i}`} loading="lazy" className="w-full aspect-[4/3] object-cover gold-card" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CaseList;

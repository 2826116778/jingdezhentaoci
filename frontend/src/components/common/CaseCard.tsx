import React from 'react';
import { Case } from '../../types';
import { useApp } from '../../context/AppContext';
import { pickBilingual } from '../../utils';
import { useTranslation } from 'react-i18next';

export const CaseCard: React.FC<{
  data: Case;
  onOpen?: (c: Case) => void;
  className?: string;
}> = ({ data, onOpen, className = '' }) => {
  const { lang } = useApp();
  const { t } = useTranslation();
  const title = pickBilingual(data, lang);
  const client = lang === 'ar' ? data.clientNameAr || data.clientNameEn : data.clientNameEn || data.clientNameAr;
  const loc = lang === 'ar' ? data.locationAr : data.locationEn;

  const catLabel =
    data.category === 'hotel' ? t('cases.tab_hotel') :
    data.category === 'villa' ? t('cases.tab_villa') : t('cases.tab_commercial');

  return (
    <article
      onClick={() => onOpen && onOpen(data)}
      className={`gold-card overflow-hidden group cursor-pointer ${className}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-ceramic-pearl">
        <img
          src={data.coverImage}
          alt={title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-[1500ms] ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
        <div className="absolute top-4 start-4">
          <span className="badge bg-ceramic-cream/90 text-ceramic-gold-deep border border-ceramic-gold-light">{catLabel}</span>
        </div>
        <div className="absolute bottom-0 inset-x-0 p-6 text-white">
          <div className="text-[11px] tracking-luxury uppercase opacity-90 mb-1">{client} · {data.year}</div>
          <h3 className="serif-heading text-[22px] leading-snug mb-2">{title}</h3>
          <div className="text-[12px] opacity-90">{loc}</div>
        </div>
      </div>
    </article>
  );
};

export default CaseCard;

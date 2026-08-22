import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PenTool, Image as ImageIcon, Box, Gift, Check, ArrowRight, Sparkles } from 'lucide-react';
import SEO from '../components/common/SEO';
import InquiryForm from '../components/common/InquiryForm';

const PIC = (s: string) => `https://picsum.photos/seed/${encodeURIComponent(s)}/1400/900`;

const SERVICES = [
  { icon: PenTool,  kTitle: 'oem.s1_title', kDesc: 'oem.s1_desc', pic: 'oem-service-privatelabel' },
  { icon: ImageIcon, kTitle: 'oem.s2_title', kDesc: 'oem.s2_desc', pic: 'oem-service-design' },
  { icon: Box,      kTitle: 'oem.s3_title', kDesc: 'oem.s3_desc', pic: 'oem-service-mold' },
  { icon: Gift,     kTitle: 'oem.s4_title', kDesc: 'oem.s4_desc', pic: 'oem-service-package' },
];
const FLOW = [
  { k: 'oem.flow_1', d: 'oem.flow_1_desc' },
  { k: 'oem.flow_2', d: 'oem.flow_2_desc' },
  { k: 'oem.flow_3', d: 'oem.flow_3_desc' },
  { k: 'oem.flow_4', d: 'oem.flow_4_desc' },
  { k: 'oem.flow_5', d: 'oem.flow_5_desc' },
  { k: 'oem.flow_6', d: 'oem.flow_6_desc' },
];
const MOQ = [
  { titleK: 'oem.moq_level1',  qty: '100 pcs', noteK: 'oem.moq_level1_note' },
  { titleK: 'oem.moq_level2',  qty: '500 pcs', noteK: 'oem.moq_level2_note' },
  { titleK: 'oem.moq_level3',  qty: '2000+ pcs', noteK: 'oem.moq_level3_note' },
];

const OEMService: React.FC = () => {
  const { t } = useTranslation();
  return (
    <>
      <SEO titleKey="nav.oem" />
      {/* Hero */}
      <section
        className="relative h-[68vh] min-h-[480px] w-full bg-cover bg-center flex items-center"
        style={{ backgroundImage: `linear-gradient(to bottom right, rgba(12,10,8,0.6), rgba(12,10,8,0.3), rgba(250,247,242,0.75)), url(${PIC('oem-hero-main')})` }}
      >
        <div className="section max-w-[1400px] mx-auto text-white">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-luxury uppercase mb-8 px-4 py-2 border border-white/30 bg-white/5 backdrop-blur">
            <Sparkles size={14} className="text-ceramic-gold-soft" /> OEM / ODM Service
          </div>
          <h1 className="serif-heading text-[42px] md:text-[64px] leading-[1.1] mb-5 max-w-3xl">
            {t('oem.hero_title')}
          </h1>
          <p className="max-w-2xl text-[16px] md:text-[18px] leading-relaxed text-white/90">{t('oem.hero_sub')}</p>
        </div>
      </section>

      {/* 4 服务 */}
      <section className="section">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SERVICES.map((s, i) => (
              <div key={i} className="gold-card flex flex-col md:flex-row overflow-hidden">
                <img src={PIC(s.pic)} alt={t(s.kTitle)} loading="lazy" className="md:w-1/2 aspect-[4/3] md:aspect-auto object-cover" />
                <div className="p-8 flex-1 flex flex-col justify-center">
                  <div className="w-12 h-12 rounded-full bg-ceramic-gold-matte/10 flex items-center justify-center text-ceramic-gold-matte mb-6">
                    <s.icon size={22} />
                  </div>
                  <h3 className="serif-heading text-[26px] mb-3">{t(s.kTitle)}</h3>
                  <p className="text-ceramic-ash leading-[2]">{t(s.kDesc)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MOQ 阶梯表 */}
      <section className="section bg-ceramic-offWhite">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-14">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-3">Transparent Pricing</div>
            <h2 className="serif-heading text-[36px] md:text-[44px] mb-3">{t('oem.moq_title')}</h2>
            <p className="text-ceramic-ash">{t('oem.moq_sub')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MOQ.map((m, i) => (
              <div key={i} className={`gold-card p-10 text-center ${i === 1 ? 'relative border-ceramic-gold-matte shadow-gold' : ''}`}>
                {i === 1 && <span className="absolute -top-3 inset-x-0 flex justify-center">
                  <span className="badge bg-ceramic-gold-matte text-white px-3">MOST POPULAR</span>
                </span>}
                <h4 className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-4">{t(m.titleK)}</h4>
                <div className="serif-heading text-[52px] gold-text mb-6">{m.qty}</div>
                <p className="text-sm text-ceramic-ash leading-relaxed">{t(m.noteK)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 合作流程时间线 */}
      <section className="section">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-3">How we work</div>
            <h2 className="serif-heading text-[36px] md:text-[44px]">{t('oem.flow_title')}</h2>
          </div>
          <ol className="relative grid gap-10 md:grid-cols-3">
            {FLOW.map((f, i) => (
              <li key={i} className="relative gold-card p-8">
                <div className="absolute -top-5 start-8 w-10 h-10 rounded-full bg-ceramic-gold-matte text-white flex items-center justify-center font-semibold shadow-gold">
                  {i + 1}
                </div>
                <div className="pt-4">
                  <h4 className="serif-heading text-[20px] mb-3">{t(f.k)}</h4>
                  <p className="text-sm text-ceramic-ash leading-[2]">{t(f.d)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 底部 OEM 表单 */}
      <section className="section bg-ceramic-offWhite">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-12 items-center">
          <div>
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-3 flex items-center gap-2">
              <Check size={14} /> {t('oem.form_title')}
            </div>
            <h2 className="serif-heading text-[36px] md:text-[44px] leading-[1.1] mb-5">{t('oem.form_title')}</h2>
            <p className="text-ceramic-ash leading-[2] mb-8">{t('oem.form_sub')}</p>
            <ul className="space-y-3 text-sm text-ceramic-graphite">
              <li className="flex items-center gap-2"><Check size={16} className="text-ceramic-gold-matte" /> Free concept consultation</li>
              <li className="flex items-center gap-2"><Check size={16} className="text-ceramic-gold-matte" /> Response within 24 hours via WhatsApp</li>
              <li className="flex items-center gap-2"><Check size={16} className="text-ceramic-gold-matte" /> Sample shipped worldwide by DHL</li>
            </ul>
            <div className="mt-10">
              <Link to="/contact" className="btn-ghost">{t('contact_title')} <ArrowRight size={14} /></Link>
            </div>
          </div>
          <InquiryForm source="oem" showProductSelect={true} titleKey="oem.form_title" subKey="oem.form_sub" />
        </div>
      </section>
    </>
  );
};

export default OEMService;

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, MessageCircle, MapPin } from 'lucide-react';
import SEO from '../components/common/SEO';
import InquiryForm from '../components/common/InquiryForm';
import { buildWhatsAppLink } from '../utils';

const Contact: React.FC = () => {
  const { t } = useTranslation();
  return (
    <>
      <SEO titleKey="nav.contact" descriptionKey="contact.sub" />

      <section className="bg-ceramic-offWhite border-b border-ceramic-border">
        <div className="section !pb-12">
          <h1 className="serif-heading text-[40px] md:text-[54px] leading-tight mb-3">{t('contact.title')}</h1>
          <p className="text-ceramic-ash max-w-3xl leading-relaxed">{t('contact.sub')}</p>
        </div>
      </section>

      <section className="section !pt-12 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16">
        {/* 左：联系方式 + 地图占位 */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <a href={`mailto:${t('footer.email')}`} className="gold-card p-6 group flex flex-col gap-2 hover:text-ceramic-gold-matte transition-colors">
              <Mail size={22} className="text-ceramic-gold-matte" />
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('contact.email_title')}</div>
              <div className="serif-heading text-[18px]">{t('footer.email')}</div>
            </a>
            <a href={`tel:${t('footer.phone').replace(/\s+/g, '')}`} className="gold-card p-6 group flex flex-col gap-2 hover:text-ceramic-gold-matte transition-colors">
              <Phone size={22} className="text-ceramic-gold-matte" />
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('contact.phone_title')}</div>
              <div className="serif-heading text-[18px]">{t('footer.phone')}</div>
            </a>
            <a href={buildWhatsAppLink({ preset: 'general', t })} target="_blank" rel="noopener noreferrer" className="gold-card p-6 group flex flex-col gap-2 hover:text-ceramic-gold-matte transition-colors">
              <MessageCircle size={22} className="text-ceramic-gold-matte" />
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('contact.whatsapp_title')}</div>
              <div className="serif-heading text-[18px]">{t('footer.whatsapp')}</div>
            </a>
            <div className="gold-card p-6 group flex flex-col gap-2">
              <MapPin size={22} className="text-ceramic-gold-matte" />
              <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('contact.address_title')}</div>
              <div className="text-[15px] text-ceramic-graphite leading-relaxed">{t('footer.address')}</div>
            </div>
          </div>

          {/* 谷歌地图占位：浅灰色块 + 地址文字；生产环境把 src 换成真实 Google Maps Embed API 链接（替换 YOUR_API_KEY） */}
          <div className="gold-card overflow-hidden !p-0">
            <div className="relative w-full aspect-[16/10] bg-ceramic-pearl">
              {/*
                PROD: 真实嵌入（把下面的 iframe 注释打开，填入 https://www.google.com/maps/embed?... 链接）
                <iframe
                  title="LuxeCeramics Office"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.google.com/maps/embed/v1/place?key=YOUR_GOOGLE_MAPS_API_KEY&q=Dubai+Design+District+Building+7+Office+402"
                ></iframe>
              */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-ceramic-ash text-center p-8">
                <MapPin size={50} className="mb-5 text-ceramic-gold-matte/70" />
                <div className="serif-heading text-[22px] mb-2 text-ceramic-graphite">{t('contact.address_title')}</div>
                <div className="max-w-md leading-relaxed text-sm">
                  {t('footer.address')}
                </div>
                <div className="text-[11px] tracking-luxury uppercase mt-8 border border-ceramic-border px-4 py-2">
                  {t('contact.map_placeholder')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右：表单 */}
        <InquiryForm
          source="contact"
          showProductSelect
          titleKey="contact.form_title"
          subKey="contact.form_sub"
        />
      </section>
    </>
  );
};

export default Contact;

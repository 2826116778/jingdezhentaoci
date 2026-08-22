import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const { lang } = useApp();
  const year = new Date().getFullYear();

  const Col = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-4">
      <h4 className="serif-heading text-ceramic-graphite text-[17px]">{title}</h4>
      <ul className="flex flex-col gap-2 text-sm text-ceramic-ash">{children}</ul>
    </div>
  );

  const clients = ['Hilton', 'Marriott', 'Ritz-Carlton', 'Four Seasons', 'Emaar', 'Nakheel', 'Dubai Holding', 'Meraas'];

  return (
    <footer className="bg-ceramic-offWhite border-t border-ceramic-border mt-20">
      <div className="section">
        {/* 4 列 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-14">
          <Col title={t('footer.about')}>
            <p className="leading-relaxed">{t('footer.about_text')}</p>
          </Col>
          <Col title={t('footer.products')}>
            <li><Link to="/products?category=tableware" className="hover:text-ceramic-gold-deep transition">{t('footer.p_tableware')}</Link></li>
            <li><Link to="/products?category=vase" className="hover:text-ceramic-gold-deep transition">{t('footer.p_vase')}</Link></li>
            <li><Link to="/products?category=art-sculpture" className="hover:text-ceramic-gold-deep transition">{t('footer.p_sculpture')}</Link></li>
            <li><Link to="/products?category=hotel-ware" className="hover:text-ceramic-gold-deep transition">{t('footer.p_hotelware')}</Link></li>
            <li><Link to="/products?category=tiles" className="hover:text-ceramic-gold-deep transition">{t('footer.p_tiles')}</Link></li>
            <li><Link to="/oem" className="hover:text-ceramic-gold-deep transition">{t('footer.p_oem')}</Link></li>
          </Col>
          <Col title={t('footer.services')}>
            <li><Link to="/oem" className="hover:text-ceramic-gold-deep transition">{t('footer.s_oem')}</Link></li>
            <li><Link to="/oem" className="hover:text-ceramic-gold-deep transition">{t('footer.s_mold')}</Link></li>
            <li><Link to="/oem" className="hover:text-ceramic-gold-deep transition">{t('footer.s_custom')}</Link></li>
            <li><Link to="/oem" className="hover:text-ceramic-gold-deep transition">{t('footer.s_package')}</Link></li>
            <li><Link to="/cases" className="hover:text-ceramic-gold-deep transition">{t('footer.s_hotel')}</Link></li>
            <li><Link to="/admin/login" className="hover:text-ceramic-gold-deep transition opacity-60">{t('nav.admin')}</Link></li>
          </Col>
          <Col title={t('footer.contact_title')}>
            <li className="flex items-center gap-2"><Mail size={14} className="text-ceramic-gold-matte" />{t('footer.email')}</li>
            <li className="flex items-center gap-2"><Phone size={14} className="text-ceramic-gold-matte" />{t('footer.phone')}</li>
            <li className="flex items-center gap-2"><MessageCircle size={14} className="text-ceramic-gold-matte" />{t('footer.whatsapp')}</li>
            <li className="flex items-start gap-2 leading-relaxed"><MapPin size={14} className="text-ceramic-gold-matte mt-1" />{t('footer.address')}</li>
          </Col>
        </div>

        {/* 合作客户 LOGO */}
        <div className="mt-16 pt-10 border-t border-ceramic-border">
          <p className="text-[11px] tracking-luxury uppercase text-ceramic-ash text-center mb-8">{t('home.client_title')}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {clients.map(name => (
              <span key={name} className="serif-heading text-[22px] md:text-[26px] text-ceramic-ash/70 hover:text-ceramic-gold-deep transition-colors duration-500 cursor-default select-none" title={name}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 版权条 */}
      <div className="border-t border-ceramic-border">
        <div className="px-6 md:px-12 lg:px-20 py-5 flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-ceramic-ash">
          <div>{t('footer.copyright', { year })}</div>
          <div className="flex items-center gap-6">
            <a className="hover:text-ceramic-graphite" href="#">{t('footer.privacy')}</a>
            <a className="hover:text-ceramic-graphite" href="#">{t('footer.terms')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

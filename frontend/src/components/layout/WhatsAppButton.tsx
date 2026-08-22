/**
 * 悬浮 WhatsApp 按钮
 *  - 右下角（LTR）/左下角（RTL）自动翻转（用 end-6 而不是 right-6 → RTL 自动变 left-6）
 *  - 哑光金渐变 + 波纹脉冲动画
 */
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buildWhatsAppLink } from '../../utils';

const WhatsAppButton: React.FC = () => {
  const { t } = useTranslation();
  const href = buildWhatsAppLink({ preset: 'general', t });
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsapp.button_aria')}
      className="fixed bottom-6 end-6 z-[60] group"
    >
      {/* 脉冲外环 */}
      <span className="absolute inset-0 rounded-full bg-ceramic-gold-matte/60 animate-pulse-ring" />
      <span className="absolute -inset-1 rounded-full bg-ceramic-gold-soft/50 animate-pulse-ring [animation-delay:700ms]" />
      {/* 按钮 */}
      <span
        className="relative block w-14 h-14 md:w-[60px] md:h-[60px] rounded-full shadow-gold
          flex items-center justify-center text-white
          bg-gradient-to-br from-[#B89778] via-[#D4B896] to-[#8A6E4F]
          group-hover:scale-110 transition-transform duration-500"
      >
        <MessageCircle size={26} className="drop-shadow" />
      </span>
    </a>
  );
};

export default WhatsAppButton;

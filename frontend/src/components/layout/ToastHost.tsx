import React from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const ToastHost: React.FC = () => {
  const { toasts } = useApp();
  return (
    <div className="fixed top-24 end-6 z-[70] flex flex-col gap-3 max-w-[320px]">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`animate-fade-in flex items-start gap-3 p-4 shadow-gold
            ${t.type === 'success' ? 'bg-ceramic-offWhite border-l-4 border-emerald-500 text-ceramic-graphite' : ''}
            ${t.type === 'error' ? 'bg-white border-l-4 border-rose-500 text-ceramic-graphite' : ''}
            ${!t.type || t.type === 'info' ? 'bg-white border-l-4 border-ceramic-gold-matte text-ceramic-graphite' : ''}
          `}
        >
          {t.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />}
          {t.type === 'error' && <XCircle size={18} className="text-rose-500 mt-0.5 flex-shrink-0" />}
          {(!t.type || t.type === 'info') && <Info size={18} className="text-ceramic-gold-matte mt-0.5 flex-shrink-0" />}
          <div className="text-sm leading-relaxed">{t.text}</div>
        </div>
      ))}
    </div>
  );
};

export default ToastHost;

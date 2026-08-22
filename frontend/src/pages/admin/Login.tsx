import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Admin } from '../../api';
import { useApp } from '../../context/AppContext';
import SEO from '../../components/common/SEO';

const AdminLogin: React.FC = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { adminAuth, setAdminAuth, showToast } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  if (adminAuth?.token) {
    return <Navigate to="/admin" replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      showToast({ type: 'error', text: t('admin.login.empty') });
      return;
    }
    setLoading(true);
    try {
      const r = await Admin.login({ username, password });
      setAdminAuth({ token: r.token, admin: { ...r.admin, token: undefined } as any });
      showToast({ type: 'success', text: t('admin.login.ok') });
      nav('/admin', { replace: true });
    } catch (err: any) {
      showToast({ type: 'error', text: err.message || t('admin.login.fail') });
    } finally { setLoading(false); }
  };

  return (
    <section className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-ceramic-offWhite via-ceramic-cream to-ceramic-pearl p-6">
      <SEO titleKey="admin.login.title" />
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full bg-ceramic-gold-matte/10 flex items-center justify-center text-ceramic-gold-matte mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="serif-heading text-[32px] mb-2">{t('admin.login.title')}</h1>
          <p className="text-ceramic-ash text-sm">{t('admin.login.sub')}</p>
        </div>

        <form onSubmit={submit} className="gold-card p-8 space-y-5">
          <div>
            <label className="label mb-1.5">{t('admin.login.username')}</label>
            <input className="input" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" />
          </div>
          <div>
            <label className="label mb-1.5">{t('admin.login.password')}</label>
            <div className="relative">
              <input className="input !pe-12" type={showPwd ? 'text' : 'password'}
                autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" className="absolute top-1/2 -translate-y-1/2 end-3 text-ceramic-ash hover:text-ceramic-graphite" onClick={() => setShowPwd(s => !s)}>
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className="btn-gold w-full justify-center !py-4" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
            {loading ? t('common.loading') : t('admin.login.btn')}
          </button>

          <div className="pt-2 text-[11px] text-ceramic-ash text-center leading-relaxed">
            {t('admin.login.tip')}
          </div>
        </form>
      </div>
    </section>
  );
};

export default AdminLogin;

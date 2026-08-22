import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Package2, FolderKanban, Mail, LogOut, Download,
  ChevronDown, Menu, X, Sparkles
} from 'lucide-react';
import { Admin } from '../../api';
import { useApp } from '../../context/AppContext';

const NAV = [
  { to: '/admin',          key: 'admin.nav.dashboard', Icon: LayoutDashboard, end: true },
  { to: '/admin/products', key: 'admin.nav.products',  Icon: Package2 },
  { to: '/admin/cases',    key: 'admin.nav.cases',     Icon: FolderKanban },
  { to: '/admin/inquiries',key: 'admin.nav.inquiries', Icon: Mail },
];

const AdminLayout: React.FC = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { adminAuth, setAdminAuth, showToast } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    // 刷新令牌有效性：简单调用 me()
    (async () => {
      try { if (adminAuth?.token) await Admin.me(); }
      catch { setAdminAuth(null); nav('/admin/login', { replace: true }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!adminAuth?.token) return <div className="section">Loading…</div>;

  const doLogout = () => {
    setAdminAuth(null);
    nav('/admin/login', { replace: true });
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const blob = await Admin.exportInquiries();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showToast({ type: 'success', text: t('admin.inquiries.export_ok') });
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setExporting(false); }
  };

  return (
    <div className="min-h-screen bg-ceramic-cream/70 text-ceramic-graphite flex flex-col md:flex-row lg:flex-row">
      {/* 移动顶栏 */}
      <div className="md:hidden bg-white border-b border-ceramic-border flex items-center justify-between px-5 py-4">
        <div className="serif-heading text-[18px] flex items-center gap-2">
          <Sparkles size={16} className="text-ceramic-gold-matte" /> Admin Panel
        </div>
        <button className="p-2" onClick={() => setMobileOpen(s => !s)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && <div className="md:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setMobileOpen(false)} />}

      {/* 侧栏 */}
      <aside className={`
        fixed inset-y-0 start-0 z-40 w-72 bg-white border-e border-ceramic-border px-6 py-8
        transition-transform duration-300
        md:static md:!transform-none
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="hidden md:flex items-center gap-2 mb-10">
          <Sparkles size={18} className="text-ceramic-gold-matte" />
          <div className="serif-heading text-[20px]">Admin Panel</div>
        </div>

        <ul className="space-y-1.5">
          {NAV.map(({ to, key, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-[14px] rounded-sm transition-all
                  ${isActive
                    ? 'bg-ceramic-gold-matte/10 text-ceramic-gold-matte border-e-2 border-ceramic-gold-matte font-medium'
                    : 'text-ceramic-graphite hover:bg-ceramic-offWhite'}`
                }
              >
                <Icon size={18} /> {t(key)}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-8 pt-8 border-t border-ceramic-border space-y-3">
          <button
            className="w-full btn-gold-outline !justify-start !py-3"
            onClick={exportCSV}
            disabled={exporting}
          >
            <Download size={14} /> {exporting ? '…' : t('admin.inquiries.export')}
          </button>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-ceramic-border flex items-center justify-between px-6 md:px-10 py-5">
          <div>
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">{t('brand.name')}</div>
            <div className="serif-heading text-[22px]">{t('admin.nav.dashboard')}</div>
          </div>

          <div className="relative">
            <button className="flex items-center gap-3 hover:bg-ceramic-offWhite px-3 py-2 rounded-sm" onClick={() => setUserOpen(o => !o)}>
              <div className="w-9 h-9 rounded-full bg-ceramic-gold-matte text-white flex items-center justify-center font-semibold">
                {adminAuth?.admin?.username?.[0] || 'A'}
              </div>
              <div className="hidden md:block text-start">
                <div className="text-[14px] leading-none">{adminAuth.admin?.username || 'Admin'}</div>
                <div className="text-[11px] text-ceramic-ash mt-1">{adminAuth.admin?.role || 'admin'}</div>
              </div>
              <ChevronDown size={16} className="text-ceramic-ash" />
            </button>
            {userOpen && (
              <div className="absolute top-full mt-2 end-0 z-20 bg-white border border-ceramic-border shadow-gold rounded-sm min-w-[180px] py-2">
                <button className="w-full text-start px-4 py-2.5 text-sm hover:bg-ceramic-offWhite text-rose-600" onClick={doLogout}>
                  <span className="inline-flex items-center gap-2"><LogOut size={14} /> {t('admin.nav.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 md:p-10 overflow-x-auto">
          <Outlet />
        </main>

        <footer className="border-t border-ceramic-border px-6 md:px-10 py-5 text-[11px] tracking-luxury uppercase text-ceramic-ash flex items-center justify-between">
          <span>© {new Date().getFullYear()} {t('brand.name')}</span>
          <span>Admin CMS</span>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;

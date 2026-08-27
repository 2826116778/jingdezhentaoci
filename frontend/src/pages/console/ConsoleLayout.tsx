/**
 * PHASE 1 外贸业务工作台 Layout。
 * 9 个页面（dashboard / leads / customers / inquiries / quotes / orders / followups / tasks / analytics）
 * 共享以下 UI 框架：
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ Topbar : Global Search / Notifications / User Menu        │ ← md+ inline, sm 折叠
 *   ├────────┬──────────────────────────────────────────────────┤
 *   │        │ Page Heading + (Tabs / Filters 占位 — Phase 2)   │
 *   │ Sidebar├──────────────────────────────────────────────────┤
 *   │ (Nav)  │ <Outlet />                                        │
 *   │        │                                                  │
 *   └────────┴──────────────────────────────────────────────────┘
 *
 * 严格不实现：Lead爬虫入口 / AI 聊天 / 群发工具 等 Phase 2+。
 * 仅留入口 icon，点击后 showToast("Coming soon in Phase 2")。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  // 主导航
  LayoutDashboard, Users2, UserCheck, MessageSquare, FileText,
  ShoppingCart, MessageCircle, ListTodo, BarChart3,
  // PHASE 2-B 新增导航图标
  Compass, Upload, ListChecks, Target, Gauge,
  // UI
  Search, Bell, Menu, X, ChevronDown, LogOut, Settings,
  // 装饰 / 辅助
  Sparkles, Package, HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, useApp } from '../../context/AppContext';
import { Admin } from '../../api';

// ====== 控制台导航（严格对齐后端 stub；PHASE 2-B 在末尾追加 Customer Acquisition）======
interface NavItem { to: string; label: string; Icon: LucideIcon; tag?: string; group?: string; }
const NAV: NavItem[] = [
  { group: 'Overview',   to: '/console/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  // ===== PHASE 2-B: Customer Acquisition =====
  { group: 'Customer Acquisition', to: '/console/development',          label: 'Lead Discovery',   Icon: Compass     },
  { group: 'Customer Acquisition', to: '/console/leads/import',         label: 'Lead Import',      Icon: Upload      },
  { group: 'Customer Acquisition', to: '/console/leads/lists',          label: 'Prospect Lists',   Icon: ListChecks  },
  { group: 'Customer Acquisition', to: '/console/development/tasks',   label: 'Development Tasks', Icon: Target    },
  { group: 'Customer Acquisition', to: '/console/leads/scoring',       label: 'Lead Scoring',     Icon: Gauge       },
  // ===== 原导航保持 =====
  { group: 'Customers',  to: '/console/leads',     label: 'Leads',     Icon: Users2 },
  { group: 'Customers',  to: '/console/customers', label: 'Customers', Icon: UserCheck },
  { group: 'Operations', to: '/console/inquiries', label: 'Inquiries', Icon: MessageSquare },
  { group: 'Operations', to: '/console/quotes',    label: 'Quotes',    Icon: FileText },
  { group: 'Operations', to: '/console/orders',    label: 'Orders',    Icon: ShoppingCart },
  { group: 'Execution',  to: '/console/followups', label: 'Follow-Ups', Icon: MessageCircle },
  { group: 'Execution',  to: '/console/tasks',     label: 'Tasks',     Icon: ListTodo },
  { group: 'Analytics',  to: '/console/analytics', label: 'Analytics', Icon: BarChart3 },
];

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  dashboard:    { title: 'Dashboard',   sub: 'Sales, leads & operations overview' },
  leads:        { title: 'Leads',       sub: 'Potential overseas customers (Phase 2: LinkedIn / Google / Instagram crawlers)' },
  customers:    { title: 'Customers',   sub: 'Converted customers & company profiles' },
  inquiries:    { title: 'Inquiries',   sub: 'All inbound inquiries from website / OEM / sales channels' },
  quotes:       { title: 'Quotes',      sub: 'Quotation drafts and sent proposals' },
  orders:       { title: 'Orders',      sub: 'Paid, pending, and historical orders (business view)' },
  followups:    { title: 'Follow-Ups',  sub: 'Communication log per lead / inquiry / quote' },
  tasks:        { title: 'Tasks',       sub: 'To-dos assigned to you and the sales team' },
  analytics:    { title: 'Analytics',   sub: 'Funnels, source attribution, sales rep performance' },
  // PHASE 2-B
  development:  { title: 'Lead Discovery',         sub: 'Find, qualify and develop overseas ceramic buyers' },
  'leads/import':       { title: 'Lead Import',    sub: 'Upload, map, validate and dedupe prospect lists' },
  'leads/lists':        { title: 'Prospect Lists', sub: 'Manage prospect lists by country / industry / source' },
  'development/tasks':  { title: 'Development Tasks', sub: 'Campaign-driven development tasks and funnels' },
  'leads/scoring':      { title: 'Lead Scoring',   sub: 'Score leads 0-100, grade A/B/C/D, with reasons' },
};

const ConsoleLayout: React.FC = () => {
  const { admin, logout } = useAuth();
  const { adminAuth, showToast } = useApp();
  const nav = useNavigate();
  const loc = useLocation();

  // 响应式侧栏
  const [mobileOpen, setMobileOpen] = useState(false);
  // Topbar 用户 / 通知下拉
  const [userOpen,   setUserOpen]   = useState(false);
  const [notifOpen,  setNotifOpen]  = useState(false);
  // Global Search 输入（Phase 1：仅 UI 框架；Phase 2 接统一搜索 API）
  const [searchQ,    setSearchQ]    = useState('');

  // 进入 /console 根 → 重定向 dashboard
  useEffect(() => {
    if (loc.pathname === '/console') nav('/console/dashboard', { replace: true });
  }, [loc.pathname, nav]);

  // 刷新登录有效性（简单 me()，失败 → 踢回登录，与 AdminLayout 行为一致）
  useEffect(() => {
    (async () => {
      try { if (adminAuth?.token) await Admin.me(); }
      catch { logout(); nav('/admin/login', { replace: true }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pageKey：优先精确匹配整段相对路径（leads/import / development/tasks），
  // 兜底使用第一段（leads / customers / dashboard），保证不丢标题。
  const pageKey = useMemo(() => {
    const segs = loc.pathname.replace(/^\/+/, '').split('/');
    // segs[0] === 'console'
    const rest = segs.slice(1); // e.g. ['leads','import'] / ['development','tasks'] / ['dashboard']
    if (!rest.length || !rest[0]) return 'dashboard';
    const two = rest.slice(0, 2).join('/');
    return PAGE_TITLES[two] ? two : rest[0];
  }, [loc.pathname]);
  const page = PAGE_TITLES[pageKey] ?? PAGE_TITLES.dashboard;

  const username = admin?.username ?? 'Admin';
  const initial  = (username[0] || 'C').toUpperCase();

  // ===== UI 事件 =====
  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    // Phase 1：不做真正搜索，提示即将到来
    showToast({ type: 'info', text: `Global search for "${searchQ}" will ship in Phase 2.` });
  };

  const groups = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    NAV.forEach(n => {
      const g = n.group || 'Misc';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(n);
    });
    return Array.from(map.entries());
  }, []);

  const doLogout = () => {
    logout();
    setUserOpen(false);
    nav('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-ceramic-graphite flex flex-col md:flex-row" data-testid="console-layout">
      {/* ============ 移动端顶栏 ============ */}
      <div className="md:hidden bg-white border-b border-ceramic-border flex items-center justify-between px-5 py-4">
        <div className="serif-heading text-[18px] flex items-center gap-2">
          <Sparkles size={16} className="text-ceramic-gold-matte" /> Sales Console
        </div>
        <button className="p-2" onClick={() => setMobileOpen(s => !s)} aria-label="Toggle menu">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ============ 侧栏遮罩（mobile） ============ */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-30"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* ============ Sidebar ============ */}
      <aside
        className={`
          fixed inset-y-0 start-0 z-40 w-[272px] bg-white border-e border-ceramic-border px-5 py-7
          transition-transform duration-300
          md:static md:!transform-none md:min-h-screen md:min-h-[100dvh]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        data-testid="console-sidebar"
      >
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-[2px] bg-gradient-to-br from-ceramic-gold-matte to-[#A67C2A]
                          flex items-center justify-center shadow-gold-sm">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="serif-heading text-[17px] leading-none">Sales Console</div>
            <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash mt-1.5">Luxeceramics · B2B</div>
          </div>
        </div>

        {/* 全局搜索（侧栏版：sm 以下只留 Topbar 搜索）
            Phase 1：输入框+占位，真正搜索 Phase 2 接统一 /api/console/search。 */}
        <form onSubmit={onSearchSubmit} className="hidden md:block mb-8">
          <label className="relative block">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-ceramic-ash" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              type="search"
              placeholder="Search leads / customers / orders…"
              className="w-full h-10 rounded-[2px] bg-ceramic-cream/60 border border-ceramic-border
                         ps-10 pe-3 text-[13px] placeholder:text-ceramic-ash
                         focus:border-ceramic-gold-matte focus:outline-none"
            />
          </label>
          <p className="mt-2 text-[10px] text-ceramic-ash leading-snug ps-1">
            Phase 1 · UI skeleton only. Full global search (leads / customers / inquiries / orders / quotes) ships in Phase 2.
          </p>
        </form>

        {/* 导航组（按 Overview / Customers / Operations / Execution / Analytics 分块） */}
        <nav className="space-y-6">
          {groups.map(([group, items]) => (
            <div key={group}>
              <div className="px-2 text-[10px] tracking-luxury uppercase text-ceramic-ash mb-2">{group}</div>
              <ul className="space-y-1">
                {items.map(({ to, label, Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 text-[13.5px] rounded-[2px] transition-all
                         ${isActive
                           ? 'bg-ceramic-gold-matte/10 text-ceramic-graphite font-medium border-s-[3px] border-ceramic-gold-matte'
                           : 'text-ceramic-graphite/80 hover:bg-ceramic-cream/60 border-s-[3px] border-transparent'}`
                      }
                    >
                      <Icon size={17} className="text-ceramic-ash shrink-0" />
                      <span className="truncate">{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* 侧栏底：Phase 2 入口（占位 — 不实现功能） */}
        <div className="mt-10 pt-6 border-t border-ceramic-border space-y-2 text-[13px]">
          <button
            onClick={() => showToast({ type: 'info', text: 'Lead crawlers (LinkedIn / Google / Instagram) ship in Phase 2.' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[2px] text-ceramic-graphite/70 hover:bg-ceramic-cream/60 border border-dashed border-ceramic-border"
          >
            <Users2 size={16} /> Auto Lead Discovery
            <span className="ms-auto text-[10px] tracking-luxury uppercase text-ceramic-ash">Soon</span>
          </button>
          <button
            onClick={() => showToast({ type: 'info', text: 'AI assistant ships in Phase 2.' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[2px] text-ceramic-graphite/70 hover:bg-ceramic-cream/60 border border-dashed border-ceramic-border"
          >
            <Sparkles size={16} /> AI Assistant
            <span className="ms-auto text-[10px] tracking-luxury uppercase text-ceramic-ash">Soon</span>
          </button>
        </div>
      </aside>

      {/* ============ 主区 ============ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header
          data-testid="console-topbar"
          className="bg-white border-b border-ceramic-border px-5 md:px-8 py-4
                     flex items-center gap-3 md:gap-6"
        >
          {/* 页面标题 */}
          <div className="min-w-0 flex-1">
            <div className="hidden md:block text-[10px] tracking-luxury uppercase text-ceramic-ash">
              Luxeceramics · Overseas Sales Workbench
            </div>
            <div className="serif-heading text-[20px] md:text-[24px] leading-tight truncate">{page.title}</div>
            <div className="hidden sm:block text-[12px] text-ceramic-ash mt-1 truncate">{page.sub}</div>
          </div>

          {/* md+ Topbar Global Search */}
          <form onSubmit={onSearchSubmit} className="hidden md:flex w-[340px] lg:w-[420px]">
            <label className="relative block w-full">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-ceramic-ash" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                type="search"
                placeholder="Global search (Phase 2)"
                className="w-full h-10 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border
                           ps-10 pe-3 text-[13px] placeholder:text-ceramic-ash
                           focus:border-ceramic-gold-matte focus:outline-none"
              />
            </label>
          </form>

          {/* Action 快捷入口 (回 CMS 管理后台；保留 /admin/* 全部现有功能) */}
          <button
            title="CMS Admin Panel (/admin)"
            onClick={() => nav('/admin')}
            className="hidden sm:inline-flex items-center gap-2 px-3 h-10 rounded-[2px]
                       border border-ceramic-border hover:bg-ceramic-cream/40 text-[13px] text-ceramic-graphite/80"
          >
            <Package size={15} />
            <span>CMS</span>
          </button>

          {/* 通知入口（Phase 1：入口 + 空状态提示） */}
          <div className="relative">
            <button
              className="relative h-10 w-10 flex items-center justify-center rounded-[2px]
                         border border-ceramic-border hover:bg-ceramic-cream/40"
              aria-label="Notifications"
              onClick={() => { setNotifOpen(o => !o); setUserOpen(false); }}
            >
              <Bell size={17} className="text-ceramic-graphite/80" />
              <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-rose-500" />
            </button>
            {notifOpen && (
              <div className="absolute end-0 top-[110%] w-[320px] z-20
                              bg-white border border-ceramic-border shadow-gold rounded-[2px] py-2">
                <div className="px-4 py-3 border-b border-ceramic-border flex items-center justify-between">
                  <div className="text-[13px] font-medium">Notifications</div>
                  <span className="text-[10px] tracking-luxury uppercase text-ceramic-ash">Phase 1</span>
                </div>
                <div className="px-4 py-6 text-center text-[13px] text-ceramic-ash">
                  No notifications yet.<br />
                  <span className="text-[11px]">
                    Phase 2 will add payment events, new leads, new inquiries here.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 用户下拉（复用后台管理员 — Console 就是管理员的业务工作台） */}
          <div className="relative">
            <button
              className="flex items-center gap-2.5 h-10 px-2.5 rounded-[2px]
                         hover:bg-ceramic-cream/40 border border-ceramic-border"
              onClick={() => { setUserOpen(o => !o); setNotifOpen(false); }}
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-ceramic-gold-matte text-white
                              flex items-center justify-center font-semibold text-[13px]">
                {initial}
              </div>
              <div className="hidden lg:block text-start">
                <div className="text-[13px] leading-none">{username}</div>
                <div className="text-[10px] text-ceramic-ash mt-1">{admin?.role ?? 'admin'}</div>
              </div>
              <ChevronDown size={15} className="text-ceramic-ash hidden sm:block" />
            </button>
            {userOpen && (
              <div className="absolute end-0 top-[110%] w-[240px] z-20
                              bg-white border border-ceramic-border shadow-gold rounded-[2px] py-1.5">
                <div className="px-4 py-3 border-b border-ceramic-border">
                  <div className="text-[13px] font-medium">{username}</div>
                  <div className="text-[11px] text-ceramic-ash mt-0.5">
                    {admin?.role ?? 'admin'} · B2B Console
                  </div>
                </div>
                <button
                  className="w-full text-start px-4 py-2.5 text-[13px] hover:bg-ceramic-cream/60 flex items-center gap-2.5 text-ceramic-graphite"
                  onClick={() => { setUserOpen(false); showToast({ type: 'info', text: 'Console preferences ship in Phase 2.' }); }}
                >
                  <Settings size={15} /> Preferences
                </button>
                <button
                  className="w-full text-start px-4 py-2.5 text-[13px] hover:bg-ceramic-cream/60 flex items-center gap-2.5 text-ceramic-graphite"
                  onClick={() => { setUserOpen(false); showToast({ type: 'info', text: 'Help & docs ship in Phase 2.' }); }}
                >
                  <HelpCircle size={15} /> Help
                </button>
                <div className="border-t border-ceramic-border mt-1 pt-1">
                  <button
                    onClick={doLogout}
                    className="w-full text-start px-4 py-2.5 text-[13px] hover:bg-rose-50 flex items-center gap-2.5 text-rose-600"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* 内容区 */}
        <main className="flex-1 p-5 md:p-8 overflow-x-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-ceramic-border px-5 md:px-8 py-4
                           text-[11px] tracking-luxury uppercase text-ceramic-ash
                           flex items-center justify-between">
          <span>© {new Date().getFullYear()} Luxeceramics</span>
          <span>Sales Console · Phase 1 Foundation</span>
        </footer>
      </div>
    </div>
  );
};

export default ConsoleLayout;

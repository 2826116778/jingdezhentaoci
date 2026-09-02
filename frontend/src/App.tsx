import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider, AuthProvider, CartProvider } from './context/AppContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import WhatsAppButton from './components/layout/WhatsAppButton';
import ToastHost from './components/layout/ToastHost';
import ProtectedAdminRoute from './components/layout/ProtectedAdminRoute';
import ProtectedConsoleRoute from './components/layout/ProtectedConsoleRoute';
import SEO from './components/common/SEO';
import { Loader2 } from 'lucide-react';

// 前台
const Home = lazy(() => import('./pages/Home'));
const ProductList = lazy(() => import('./pages/ProductList'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const CaseList = lazy(() => import('./pages/CaseList'));
const OEMService = lazy(() => import('./pages/OEMService'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Cart = lazy(() => import('./pages/Cart'));
const NotFound = lazy(() => import('./pages/NotFound'));

// 后台（CMS：产品/案例/询盘 CRUD + 导出）
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminCases = lazy(() => import('./pages/admin/Cases'));
const AdminInquiries = lazy(() => import('./pages/admin/Inquiries'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));

// 外贸业务工作台（Phase 1 基础框架 — 9 个模块，不影响 CMS）
const ConsoleLayout    = lazy(() => import('./pages/console/ConsoleLayout'));
const ConsoleDashboard = lazy(() => import('./pages/console/Dashboard'));
const ConsoleLeads     = lazy(() => import('./pages/console/Leads'));
const ConsoleCustomers = lazy(() => import('./pages/console/Customers'));
const ConsoleInquiries = lazy(() => import('./pages/console/Inquiries'));
const ConsoleQuotes    = lazy(() => import('./pages/console/Quotes'));
const ConsoleOrders    = lazy(() => import('./pages/console/Orders'));
const ConsoleFollowUps = lazy(() => import('./pages/console/FollowUps'));
const ConsoleTasks     = lazy(() => import('./pages/console/Tasks'));
const ConsoleAnalytics = lazy(() => import('./pages/console/Analytics'));

// PHASE 2-B 海外客户开发中心 — Customer Acquisition
const LeadDiscovery    = lazy(() => import('./pages/console/development/LeadDiscovery'));
const LeadImportWizard = lazy(() => import('./pages/console/development/LeadImportWizard'));
const ProspectLists    = lazy(() => import('./pages/console/development/ProspectLists'));
const DevelopmentTasks  = lazy(() => import('./pages/console/development/DevelopmentTasks'));
const LeadScoring       = lazy(() => import('./pages/console/development/LeadScoring'));
const AcquisitionAnalytics = lazy(() => import('./pages/console/development/AcquisitionAnalytics'));
const LeadDetail        = lazy(() => import('./pages/console/development/LeadDetail'));
const MessageTemplates   = lazy(() => import('./pages/console/development/MessageTemplates'));
const MarketConfigPage  = lazy(() => import('./pages/console/development/MarketConfigPage'));

// PHASE 2-C AI 海外客户研究 & 开发助手
const AIDashboard  = lazy(() => import('./pages/console/ai/AIDashboard'));
const AIJobs       = lazy(() => import('./pages/console/ai/AIJobs'));
const AIUsage      = lazy(() => import('./pages/console/ai/AIUsage'));
const LeadResearch = lazy(() => import('./pages/console/ai/LeadResearch'));

// PHASE 3-A AI Customer Development Center
const DevelopmentDashboard   = lazy(() => import('./pages/console/ai/DevelopmentDashboard'));
const LeadDevelopmentDetail  = lazy(() => import('./pages/console/ai/LeadDevelopmentDetail'));

const Loading = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-9 h-9 text-ceramic-gold-matte animate-spin" />
      <div className="text-xs tracking-luxury uppercase text-ceramic-ash">LuxeCeramics</div>
    </div>
  </div>
);

const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation();
  React.useEffect(() => {
    if (hash) return; // #anchor 保持不滚
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, hash]);
  return null;
};

/**
 * 前台包裹布局（Navbar / Footer / WhatsApp / Toast）。
 * 后台页面不走这里：
 *   - /admin/*   有独立 AdminLayout（CMS）
 *   - /console/* 有独立 ConsoleLayout（外贸业务工作台）
 * 两者 100% 保留并互相独立。
 */
const PublicShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loc = useLocation();
  const isAdminShell = loc.pathname.startsWith('/admin') || loc.pathname.startsWith('/console');
  if (isAdminShell) return <>{children}</>;
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-[84px]">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AuthProvider>
      <CartProvider>
        <SEO />
        <ToastHost />
        <ScrollToTop />
        <PublicShell>
          <Suspense fallback={<Loading />}>
            <Routes>
              {/* 前台 8 + Checkout + 404 */}
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/cases" element={<CaseList />} />
              <Route path="/oem" element={<OEMService />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout/:orderNo?" element={<Checkout />} />
              <Route path="/404" element={<NotFound />} />

              {/* ====== CMS 后台（原 /admin/* 100% 保留）====== */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedAdminRoute>
                    <AdminLayout />
                  </ProtectedAdminRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="cases" element={<AdminCases />} />
                <Route path="inquiries" element={<AdminInquiries />} />
              </Route>

              {/* ====== 外贸业务工作台 /console/*（Phase 1 基础框架 — JWT 保护）====== */}
              <Route
                path="/console"
                element={
                  <ProtectedConsoleRoute>
                    <ConsoleLayout />
                  </ProtectedConsoleRoute>
                }
              >
                {/* /console → 内部重定向到 /console/dashboard（在 ConsoleLayout 里完成） */}
                <Route index element={<ConsoleDashboard />} />
                <Route path="dashboard" element={<ConsoleDashboard />} />
                <Route path="leads"     element={<ConsoleLeads />} />
                <Route path="leads/import"   element={<LeadImportWizard />} />
                <Route path="leads/lists"    element={<ProspectLists />} />
                <Route path="leads/scoring"  element={<LeadScoring />} />
                <Route path="leads/:id"      element={<LeadDetail />} />
                <Route path="leads/:id/research" element={<LeadResearch />} />
                {/* PHASE 2-C AI 海外客户研究 & 开发助手 */}
                <Route path="ai"       element={<AIDashboard />} />
                <Route path="ai/jobs"  element={<AIJobs />} />
                <Route path="ai/usage" element={<AIUsage />} />
                {/* PHASE 3-A AI Customer Development Center */}
                <Route path="ai/development"            element={<DevelopmentDashboard />} />
                <Route path="ai/development/:leadId"    element={<LeadDevelopmentDetail />} />
                <Route path="customers" element={<ConsoleCustomers />} />
                <Route path="inquiries" element={<ConsoleInquiries />} />
                <Route path="quotes"    element={<ConsoleQuotes />} />
                <Route path="orders"    element={<ConsoleOrders />} />
                <Route path="followups" element={<ConsoleFollowUps />} />
                <Route path="tasks"     element={<ConsoleTasks />} />
                <Route path="analytics" element={<ConsoleAnalytics />} />
                {/* PHASE 2-B 海外客户开发中心 */}
                <Route path="development"        element={<LeadDiscovery />} />
                <Route path="development/tasks"  element={<DevelopmentTasks />} />
                <Route path="development/templates" element={<MessageTemplates />} />
                <Route path="development/markets"   element={<MarketConfigPage />} />
                <Route path="analytics/acquisition" element={<AcquisitionAnalytics />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PublicShell>
      </CartProvider>
      </AuthProvider>
    </AppProvider>
  );
};

export default App;

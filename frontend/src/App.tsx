import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider, AuthProvider } from './context/AppContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import WhatsAppButton from './components/layout/WhatsAppButton';
import ToastHost from './components/layout/ToastHost';
import ProtectedAdminRoute from './components/layout/ProtectedAdminRoute';
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
const NotFound = lazy(() => import('./pages/NotFound'));

// 后台
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminCases = lazy(() => import('./pages/admin/Cases'));
const AdminInquiries = lazy(() => import('./pages/admin/Inquiries'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));

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
 * 前台包裹布局（Navbar / Footer / WhatsApp / Toast）
 * 后台页不走这里（/admin/* 有独立 AdminLayout）
 */
const PublicShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin');
  if (isAdmin) return <>{children}</>;
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
              <Route path="/checkout/:orderNo?" element={<Checkout />} />
              <Route path="/404" element={<NotFound />} />

              {/* 后台 */}
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

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PublicShell>
      </AuthProvider>
    </AppProvider>
  );
};

export default App;

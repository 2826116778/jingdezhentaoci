/**
 * 全局 Context：
 *  - AppContext：
 *      - lang: 'en'|'ar'
 *      - setLang(lang): 切换语言 + 同步 i18next + localStorage
 *      - isRTL: boolean
 *      - toast(text, type, duration) / showToast
 *      - toasts: Toast[] 显示列表
 *  - AuthContext：后台管理员 JWT 状态
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import type { Lang, Admin, ToastOptions } from '../types';
import { Auth as AuthApi } from '../api';

// ===================== Toast =====================
interface Toast { id: number; text: string; type: 'success' | 'error' | 'info'; }

// ===================== App Context =====================
export interface AdminAuthState {
  token: string;
  admin: Admin | null;
}
interface AppCtxValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  isRTL: boolean;
  showToast: (opt: ToastOptions | string) => void;
  toasts: Toast[];
  // 后台登录态（与 localStorage + AuthProvider 同步）
  adminAuth: AdminAuthState | null;
  setAdminAuth: (s: AdminAuthState | null) => void;
}

const AppCtx = createContext<AppCtxValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem('luxeceramics.lang') : '') || i18n.language || 'en';
    return (saved.substring(0, 2) === 'ar' ? 'ar' : 'en') as Lang;
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [adminAuth, setAdminAuthState] = useState<AdminAuthState | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    const token = localStorage.getItem('luxeceramics.adminToken');
    if (!token) return null;
    let admin: Admin | null = null;
    try { admin = JSON.parse(localStorage.getItem('luxeceramics.admin') || 'null'); } catch { admin = null; }
    return { token, admin };
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    i18next.changeLanguage(l); // 触发 i18n.on('languageChanged') 同步 dir
    localStorage.setItem('luxeceramics.lang', l);
  }, []);

  const showToast = useCallback((opt: ToastOptions | string) => {
    const o: ToastOptions = typeof opt === 'string' ? { text: opt, type: 'info' } : opt;
    const id = Date.now() + Math.random();
    setToasts(list => [...list, { id, text: o.text, type: o.type || 'info' }]);
    setTimeout(() => {
      setToasts(list => list.filter(t => t.id !== id));
    }, o.duration || 4000);
  }, []);

  const setAdminAuth = useCallback((s: AdminAuthState | null) => {
    setAdminAuthState(s);
    if (s?.token) {
      localStorage.setItem('luxeceramics.adminToken', s.token);
      if (s.admin) localStorage.setItem('luxeceramics.admin', JSON.stringify(s.admin));
    } else {
      localStorage.removeItem('luxeceramics.adminToken');
      localStorage.removeItem('luxeceramics.admin');
    }
  }, []);

  const isRTL = lang === 'ar';

  const value = useMemo<AppCtxValue>(() => ({
    lang, setLang, isRTL, showToast, toasts,
    adminAuth, setAdminAuth,
  }), [lang, setLang, isRTL, showToast, toasts, adminAuth, setAdminAuth]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
};

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// ===================== Auth Context (后台) =====================
interface AuthCtxValue {
  admin: Admin | null;
  loading: boolean;
  login: (payload: { username: string; password: string }) => Promise<Admin>;
  logout: () => void;
  reload: () => Promise<void>;
}
const AuthCtx = createContext<AuthCtxValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setAdminAuth } = useApp();
  const [admin, setAdmin] = useState<Admin | null>(() => AuthApi.getSavedAdmin());
  const [loading, setLoading] = useState(false);

  const login = async (payload: { username: string; password: string }): Promise<Admin> => {
    setLoading(true);
    try {
      const { token, admin: a } = await AuthApi.login(payload);
      AuthApi.saveAdmin(token, a);
      setAdmin(a);
      setAdminAuth({ token, admin: a });
      return a;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    AuthApi.clear();
    setAdmin(null);
    setAdminAuth(null);
  };

  const reload = async () => {
    if (!AuthApi.getSavedToken()) { setAdmin(null); setAdminAuth(null); return; }
    try {
      setLoading(true);
      const a = await AuthApi.me();
      setAdmin(a);
      setAdminAuth({ token: AuthApi.getSavedToken(), admin: a });
    } catch {
      AuthApi.clear();
      setAdmin(null);
      setAdminAuth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []); // 启动时拉一次（校验 token 有效性）

  const value = useMemo(() => ({ admin, loading, login, logout, reload }), [admin, loading, login, logout, reload]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

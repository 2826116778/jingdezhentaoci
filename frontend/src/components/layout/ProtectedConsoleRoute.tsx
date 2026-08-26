/**
 * Console 路由守卫：复用现有 AuthProvider（admin JWT localStorage 机制）。
 * - 未登录 → 跳 /admin/login，并携带 redirect 到 /console/*
 * - 加载中 → 显示 spinner（与 ProtectedAdminRoute 同视觉）
 * - 已登录 → 渲染 children
 * 与现有 /admin/* 的 ProtectedAdminRoute 完全解耦：两者目标 route 不同，互不影响。
 * /admin/* 原有登录保护 100% 保留。
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AppContext';
import { Loader2 } from 'lucide-react';

export const ProtectedConsoleRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { admin, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-ceramic-gold-matte" />
      </div>
    );
  }
  if (!admin) {
    // 未登录 → 跳到 Login（复用 /admin/login），登录后再回到 Console
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname + loc.search }} />;
  }
  return <>{children}</>;
};

export default ProtectedConsoleRoute;

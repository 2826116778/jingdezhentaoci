import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 中文注释：Vite 配置 — 代理 /api 到后端 5000，支持 @ 路径别名
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 前端调用 /api/** → 转发给后端 Express@5000
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
      // 后端上传静态资源代理（/uploads/**）
      '/uploads': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
  },
});

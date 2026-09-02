/**
 * axios + API 封装
 * 统一 /api 前缀（Vite 代理 → 后端 5000）
 * 响应统一解包：res.data = { code, message, data }，code!=0 抛错
 */
import axios, { AxiosInstance } from 'axios';
import type {
  ApiResponse, Product, Case, Inquiry, OrderSummary, OrderItem, OrderContact, OrderListItem,
  Admin as AdminModel, DashboardSummary,
} from '../types';

export type CreateOrderInput = {
  items: OrderItem[];
  contactInfo: OrderContact;
  customDemand?: string;
  orderType?: 'retail' | 'dealer';
};

let _axios: AxiosInstance;
function client(): AxiosInstance {
  if (_axios) return _axios;
  _axios = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });
  // 自动附带 JWT
  _axios.interceptors.request.use(config => {
    const token = localStorage.getItem('luxeceramics.adminToken');
    if (token && !config.headers?.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  // 统一解包 + 错误信息抛出
  _axios.interceptors.response.use(
    (resp) => {
      const body = resp.data as ApiResponse;
      if (!body || typeof body.code === 'undefined') {
        // CSV 导出等非 JSON，返回原始 resp.data
        return resp as any;
      }
      if (body.code !== 0) {
        const err = new Error(body.message || '请求失败');
        (err as any).code = body.code;
        (err as any).data = body.data;
        return Promise.reject(err);
      }
      return body.data as any;
    },
    (err) => {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || 'Network Error';
      const wrapped = new Error(msg);
      (wrapped as any).status = status;
      (wrapped as any).code = err?.response?.data?.code || status;
      (wrapped as any).data = err?.response?.data?.data;
      return Promise.reject(wrapped);
    },
  );
  return _axios;
}

// ===============================================================
// 公开接口
// ===============================================================

export function get<T>(url: string, params?: any) { return client().get<any, T>(url, { params }); }
export function post<T>(url: string, data?: any) { return client().post<any, T>(url, data); }
export function patch<T>(url: string, data?: any) { return client().patch<any, T>(url, data); }
export function del<T>(url: string) { return client().delete<any, T>(url); }

// ---------- 产品 ----------
export const Products = {
  list: (p?: any) => get<{ list: Product[]; total: number; page: number; limit: number; hasMore: boolean }>('/products', p),
  featured: () => get<Product[]>('/products/featured'),
  detail: (id: string) => get<{ product: Product; related: Product[] }>(`/products/${id}`),
  create: (data: Partial<Product>) => post<Product>('/products', data),
  update: (id: string, data: Partial<Product>) => patch<Product>(`/products/${id}`, data),
  remove: (id: string) => del<void>(`/products/${id}`),
};

// ---------- 案例 ----------
export const Cases = {
  list: (p?: any) => get<Case[]>('/cases', p),
  featured: () => get<Case[]>('/cases/featured'),
  detail: (id: string) => get<Case>(`/cases/${id}`),
  create: (data: Partial<Case>) => post<Case>('/cases', data),
  update: (id: string, data: Partial<Case>) => patch<Case>(`/cases/${id}`, data),
  remove: (id: string) => del<void>(`/cases/${id}`),
};

// ---------- 询盘 ----------
export const Inquiries = {
  submit: (data: any) => post<{ id: string; status: string }>('/inquiries', data),
  list: (p?: any) => get<{ list: Inquiry[]; total: number; page: number; limit: number }>('/inquiries', p),
  export: (): Promise<any> => axios.get('/api/inquiries/export', {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${localStorage.getItem('luxeceramics.adminToken') || ''}` },
  }).then(res => res.data),
  detail: (id: string) => get<Inquiry>(`/inquiries/${id}`),
  setStatus: (id: string, status: string) => patch<Inquiry>(`/inquiries/${id}/status`, { status }),
};

// ---------- 订单（USDT TRC20） ----------
export const Orders = {
  create: (data: CreateOrderInput) => post<OrderSummary>('/orders', data),
  detail: (id: string) => get<OrderSummary>(`/orders/id/${id}`),
  status: (orderNo: string) => get<OrderSummary>(`/orders/${orderNo}`),
  qrcode: (orderNo: string) => get<{ qrcodeBase64: string; walletAddress: string; usdtAmount: number }>(`/orders/${orderNo}/qrcode`),
  verifyTx: (id: string, txHash: string) => post<{ msg: string; status: string; txHash?: string }>(`/orders/id/${id}/verify-tx`, { txHash }),
  list: (p?: any) => get<{ list: OrderListItem[]; total: number; page: number; limit: number }>('/orders', p),
  setStatus: (id: string, status: string) => patch<void>(`/orders/${id}/status`, { status }),
  updateItems: (id: string, items: any[]) => patch<{ _id: string; orderNo: string; items: any[]; totalAmount: number; usdtAmount: number; paymentStatus: string }>(`/orders/${id}/items`, { items }),
  setDealerInfo: (id: string, data: any) => patch<OrderListItem>(`/orders/${id}/dealer`, data),
};

// ---------- 认证 + 后台 CMS（统一命名导出 Admin） ----------
export const Auth = {
  login: (payload: { username: string; password: string }) =>
    post<{ token: string; admin: AdminModel; expiresIn: string }>('/auth/login', payload),
  me: () => get<AdminModel>('/auth/me'),
  saveAdmin(token: string, admin: AdminModel) {
    localStorage.setItem('luxeceramics.adminToken', token);
    localStorage.setItem('luxeceramics.admin', JSON.stringify(admin));
  },
  clear() {
    localStorage.removeItem('luxeceramics.adminToken');
    localStorage.removeItem('luxeceramics.admin');
  },
  getSavedToken() { return localStorage.getItem('luxeceramics.adminToken') || ''; },
  getSavedAdmin(): AdminModel | null {
    try { return JSON.parse(localStorage.getItem('luxeceramics.admin') || 'null'); } catch { return null; }
  },
};

// 后台统一入口：登录/用户信息 + Dashboard + Product/Case CRUD + 询盘管理 + 导出
export const Admin = {
  // Auth
  login: Auth.login,
  me: Auth.me,
  logout: Auth.clear,

  // Dashboard
  dashboard: () => get<DashboardSummary>('/admin/dashboard'),

  // Products
  listProducts: (p?: any) => get<Product[]>('/admin/products', p),
  createProduct: (d: Partial<Product>) => post<Product>('/admin/products', d),
  updateProduct: (id: string, d: Partial<Product>) => patch<Product>(`/admin/products/${id}`, d),
  deleteProduct: (id: string) => del<void>(`/admin/products/${id}`),

  // Cases
  listCases: (p?: any) => get<Case[]>('/admin/cases', p),
  createCase: (d: Partial<Case>) => post<Case>('/admin/cases', d),
  updateCase: (id: string, d: Partial<Case>) => patch<Case>(`/admin/cases/${id}`, d),
  deleteCase: (id: string) => del<void>(`/admin/cases/${id}`),

  // Inquiries
  listInquiries: (p?: any) => get<Inquiry[]>('/admin/inquiries', p),
  updateInquiry: (id: string, d: Partial<Inquiry>) => patch<Inquiry>(`/admin/inquiries/${id}`, d),
  exportInquiries: (): Promise<Blob> =>
    axios.get('/api/admin/inquiries/export', {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${Auth.getSavedToken()}` },
    }).then(r => r.data as any),

  // 图片上传（后台）— 走统一拦截器解包（client() baseURL = /api），返回的 data 是 { url, size, filename, originalName }
  uploadImage: (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    return client().post<any, { url: string; size: number; filename: string }>('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.url);
  },
};

// ---------- 上传（旧名兼容） ----------
export const Upload = {
  file: (file: File) => Admin.uploadImage(file).then(url => ({ url, size: 0, filename: file.name })),
};

const api = {
  get, post, patch, del,
  Products, Cases, Inquiries, Orders, Auth, Upload, Admin,
};
export default api;

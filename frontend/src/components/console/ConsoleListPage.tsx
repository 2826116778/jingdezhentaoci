/**
 * PHASE 2-A：通用 Console 列表页 Hook + 视图。
 *  - 有数据：表格（列描述渲染 + 分页导航 + 搜索框 + 筛选器）
 *  - 无数据：Empty State
 *  - 支持增/改/删 模态回调（由业务页面传入 actions / columns）
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, RefreshCw, LucideIcon, ChevronLeft, ChevronRight, Search, X, Edit2, Trash2, Eye,
} from 'lucide-react';
import { Console, ConsoleListParams } from '../../api/console';
import { useApp } from '../../context/AppContext';
import ConsoleEmptyState from '../../components/console/ConsoleEmptyState';
import type { ConsolePage } from '../../types';

export function useConsoleListPage<T>(
  fetcher: (p?: ConsoleListParams) => Promise<ConsolePage<T>>,
  initialParams?: ConsoleListParams,
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<ConsoleListParams>({ page: 1, pageSize: 20, ...(initialParams || {}) });
  const [data, setData] = useState<ConsolePage<T>>({
    items: [], total: 0, page: 1, pageSize: 20, totalPages: 0,
  });

  const load = async (overrides?: ConsoleListParams) => {
    setLoading(true); setError(null);
    const next = { ...params, ...(overrides || {}), page: overrides?.page ?? params.page };
    try { setData(await fetcher(next)); setParams(next); }
    catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  return { loading, error, data, params, setParams, reload: load };
}

/* ========================================================================= *
 * 列描述
 * ========================================================================= */
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
}

/* ========================================================================= *
 * Filter 定义（顶部工具条筛选器）
 * ========================================================================= */
export interface FilterOption {
  label: string;
  value: string;
}
export interface ListFilter {
  key: string;            // 对应 ConsoleListParams 字段，如 status / country / grade
  label: string;
  type: 'select' | 'search' | 'text';
  options?: FilterOption[];
  placeholder?: string;
}

/* ========================================================================= *
 * 列表视图
 * ========================================================================= */
interface ListPageProps<T> {
  pageTitle: string;
  pageSubtitle?: string;
  Icon: LucideIcon;
  newCtaLabel?: string;
  testId?: string;
  fetcher: (p?: ConsoleListParams) => Promise<ConsolePage<T>>;
  columns: Column<T>[];
  keyField?: keyof T;
  filters?: ListFilter[];
  initialParams?: ConsoleListParams;

  // 动作
  onCreate?: () => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => Promise<boolean> | boolean;

  // 常用快捷动作（例如 Lead "Convert to Customer"）
  extraRowActions?: Array<{
    label: string;
    key: string;
    icon?: LucideIcon;
    className?: string;
    onClick: (row: T) => void;
    show?: (row: T) => boolean;
  }>;
}

export function ConsoleListPageView<T extends { _id?: string | any; id?: string | any }>(props: ListPageProps<T>) {
  const {
    pageTitle, pageSubtitle, Icon, newCtaLabel, testId, fetcher, columns, keyField = '_id',
    filters, initialParams, onCreate, onView, onEdit, onDelete, extraRowActions,
  } = props;

  const { showToast } = useApp();
  const hook = useConsoleListPage<T>(fetcher, initialParams);
  const { loading, error, data, params, reload } = hook;

  const [filterDraft, setFilterDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    (filters || []).forEach(f => {
      const v = (initialParams as any)?.[f.key];
      if (v !== undefined) d[f.key] = String(v);
    });
    return d;
  });

  const applyFilter = (overrides?: ConsoleListParams) => {
    const q: ConsoleListParams = { ...filterDraft, ...overrides, page: 1 } as any;
    reload(q);
  };

  const handleDelete = async (row: T) => {
    if (!onDelete) return;
    const id = (row as any)[keyField] ?? row._id ?? row.id;
    if (!window.confirm(`Delete this ${pageTitle.slice(0, -1)}? This cannot be undone.`)) return;
    try {
      const ok = await onDelete(row);
      if (ok !== false) {
        showToast({ type: 'success', text: 'Deleted' });
        reload();
      }
    } catch (e: any) { showToast({ type: 'error', text: e?.message || 'Delete failed' }); }
    void id;
  };

  return (
    <div className="space-y-6" data-testid={testId} data-empty-count={data?.items.length ?? 0}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="serif-heading text-[26px] md:text-[30px] leading-none">{pageTitle}</h2>
          {pageSubtitle && <p className="text-[13px] text-ceramic-ash mt-2 max-w-2xl">{pageSubtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => reload({ page: 1 } as any)}
            disabled={loading}
            className="btn-gold-outline !px-4 flex items-center gap-2 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {onCreate && newCtaLabel && (
            <button onClick={onCreate} className="btn-gold !px-4 flex items-center gap-2">
              <Plus size={15} /> {newCtaLabel}
            </button>
          )}
        </div>
      </div>

      {/* Filters / Search */}
      {filters && filters.length > 0 && (
        <div className="bg-white border border-ceramic-border rounded-[2px] p-4 flex flex-wrap gap-3 items-center">
          {filters.map(f => (
            <FilterCell
              key={f.key}
              filter={f}
              value={filterDraft[f.key] ?? ''}
              onChange={(v) => setFilterDraft({ ...filterDraft, [f.key]: v })}
              onKeyDownEnter={() => applyFilter()}
            />
          ))}
          <button onClick={() => applyFilter()} className="btn-gold !py-2 !px-4 text-[13px]">Apply</button>
          <button
            onClick={() => { setFilterDraft({}); reload({ page: 1, ...cleanParams(initialParams || {}) } as any); }}
            className="btn-gold-outline !py-2 !px-4 text-[13px] flex items-center gap-1"
          >
            <X size={13} /> Clear
          </button>
          <div className="ml-auto text-[12px] text-ceramic-ash">
            Total: <strong className="text-ceramic-graphite">{data.total}</strong> ·
            Page {data.page} of {data.totalPages || 1}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="bg-white border border-ceramic-border rounded-[2px] p-4 animate-pulse space-y-3">
          <div className="h-4 bg-ceramic-cream rounded" />
          <div className="h-4 bg-ceramic-cream rounded" />
          <div className="h-4 bg-ceramic-cream rounded" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <ConsoleEmptyState
          testId={`${testId ?? 'list'}-error`}
          icon={Icon}
          title={`Failed to load ${pageTitle.toLowerCase()}`}
          description={error}
          action={{ label: 'Retry', onClick: () => reload() }}
          error={error}
        />
      )}

      {/* Empty */}
      {!loading && !error && data.items.length === 0 && (
        <ConsoleEmptyState
          testId={`${testId ?? 'list'}-empty`}
          icon={Icon}
          title={`No ${pageTitle.toLowerCase()} yet`}
          description={onCreate
            ? `Backend returned 0 records. Click "${newCtaLabel || 'Create'}" to get started.`
            : `Backend returned 0 records. This module is live and connected to MongoDB — it's just empty.`}
          action={onCreate && newCtaLabel ? { label: newCtaLabel, onClick: onCreate } : undefined}
        />
      )}

      {/* Table */}
      {!loading && !error && data.items.length > 0 && (
        <>
          <div className="bg-white border border-ceramic-border rounded-[2px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-ceramic-cream/50 text-ceramic-ash text-[11px] tracking-luxury uppercase">
                  {columns.map(col => (
                    <th key={col.key} className="px-4 py-3 text-left whitespace-nowrap" style={col.width ? { width: col.width } : undefined}>
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right whitespace-nowrap w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(row => {
                  const id = String((row as any)[keyField] ?? row._id ?? row.id ?? Math.random());
                  return (
                    <tr key={id} className="border-t border-ceramic-border hover:bg-ceramic-cream/30">
                      {columns.map(col => (
                        <td key={col.key} className="px-4 py-3 align-top">
                          {col.render ? col.render(row) : String((row as any)[col.key] ?? '')}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1 justify-end flex-wrap">
                          {extraRowActions?.filter(a => !a.show || a.show(row)).map(a => (
                            <button
                              key={a.key}
                              title={a.label}
                              onClick={() => a.onClick(row)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[12px] ${a.className ?? 'border-ceramic-border text-ceramic-ash hover:border-ceramic-gold hover:text-ceramic-gold'}`}
                            >
                              {a.icon && <a.icon size={12} />} {a.label}
                            </button>
                          ))}
                          {onView && (
                            <button title="View" onClick={() => onView(row)}
                              className="p-1.5 rounded border border-ceramic-border text-ceramic-ash hover:border-ceramic-gold hover:text-ceramic-gold">
                              <Eye size={13} />
                            </button>
                          )}
                          {onEdit && (
                            <button title="Edit" onClick={() => onEdit(row)}
                              className="p-1.5 rounded border border-ceramic-border text-ceramic-ash hover:border-ceramic-gold hover:text-ceramic-gold">
                              <Edit2 size={13} />
                            </button>
                          )}
                          {onDelete && (
                            <button title="Delete" onClick={() => handleDelete(row)}
                              className="p-1.5 rounded border border-ceramic-border text-red-600 hover:border-red-400 hover:text-red-700">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            totalPages={data.totalPages || 1}
            total={data.total}
            onChange={(p) => reload({ page: p } as any)}
          />
        </>
      )}
    </div>
  );
}

function cleanParams(p: ConsoleListParams): ConsoleListParams {
  const out: any = {};
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') out[k] = v; });
  return out;
}

/* ========================================================================= *
 * 筛选单元格
 * ========================================================================= */
function FilterCell({
  filter, value, onChange, onKeyDownEnter,
}: {
  filter: ListFilter;
  value: string;
  onChange: (v: string) => void;
  onKeyDownEnter: () => void;
}) {
  const cls = 'border border-ceramic-border rounded-[2px] bg-white px-3 py-2 text-[13px] text-ceramic-graphite focus:border-ceramic-gold focus:outline-none';
  if (filter.type === 'search' || filter.type === 'text') {
    return (
      <label className="flex flex-col gap-1 text-[11px] text-ceramic-ash">
        <span>{filter.label}</span>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ceramic-ash" />
          <input
            className={`${cls} pl-7 w-52`}
            placeholder={filter.placeholder || 'Search...'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onKeyDownEnter(); }}
          />
        </div>
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1 text-[11px] text-ceramic-ash">
      <span>{filter.label}</span>
      <select
        className={`${cls} min-w-[160px]`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{filter.placeholder || '— Any —'}</option>
        {filter.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/* ========================================================================= *
 * Pagination
 * ========================================================================= */
function Pagination({ page, totalPages, total, onChange }: {
  page: number; totalPages: number; total: number; onChange: (p: number) => void;
}) {
  const pages = useMemo(() => {
    const arr: (number | '...')[] = [];
    const n = totalPages;
    const add = (x: number | '...') => arr.push(x);
    const window = 1;
    for (let i = 1; i <= n; i++) {
      if (i === 1 || i === n || (i >= page - window && i <= page + window)) add(i);
      else if (arr[arr.length - 1] !== '...') add('...');
    }
    return arr;
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 text-[12px] text-ceramic-ash">
      <div>{total} records total</div>
      <div className="inline-flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="p-1.5 rounded border border-ceramic-border disabled:opacity-30 hover:border-ceramic-gold"
        >
          <ChevronLeft size={13} />
        </button>
        {pages.map((p, i) => (
          typeof p === 'number' ? (
            <button
              key={i}
              onClick={() => onChange(p)}
              className={`min-w-[32px] h-8 rounded border px-2 ${page === p ? 'bg-ceramic-gold border-ceramic-gold text-white' : 'border-ceramic-border hover:border-ceramic-gold'}`}
            >
              {p}
            </button>
          ) : (
            <span key={i} className="px-1">…</span>
          )
        ))}
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="p-1.5 rounded border border-ceramic-border disabled:opacity-30 hover:border-ceramic-gold"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

export default ConsoleListPageView;
// ESLint 保留：避免 tree-shake 删除 Console / useApp 引用
void Console;

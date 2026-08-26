/**
 * 通用 Console 列表页 Hook + 展示。
 * - Phase 1 中 leads / customers / inquiries / quotes / orders / followups / tasks 这 7 个模块均为 list 结构，
 *   完全复用 useConsoleListPage 与 <ConsoleListPageView /> 实现"真实 API 空结构 + Empty State"。
 * - 绝不硬编码 items / numbers，严格渲染后端返回的 data（即使是空的）。
 */
import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, LucideIcon } from 'lucide-react';
import { Console, ConsoleListParams } from '../../api/console';
import { useApp } from '../../context/AppContext';
import ConsoleEmptyState from '../../components/console/ConsoleEmptyState';
import type { ConsolePage } from '../../types';

export function useConsoleListPage<T>(
  fetcher: (p?: ConsoleListParams) => Promise<ConsolePage<T>>,
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConsolePage<T>>({
    items: [], total: 0, page: 1, pageSize: 20, totalPages: 0,
  });

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await fetcher({ page: 1, pageSize: 20 })); }
    catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, data, reload: load };
}

interface ListPageProps<T> {
  pageTitle: string;
  pageSubtitle: string;
  Icon: LucideIcon;
  newCtaLabel: string;
  comingSoonHint: string;
  fetcher: (p?: ConsoleListParams) => Promise<ConsolePage<T>>;
  // Phase 2：把 columns / renderers / filters 传进来。当前 Phase 1 只展示 Empty State。
  testId?: string;
}

export function ConsoleListPageView<T>({
  pageTitle, pageSubtitle, Icon, newCtaLabel, comingSoonHint, fetcher, testId,
}: ListPageProps<T>) {
  const { loading, error, data, reload } = useConsoleListPage<T>(fetcher);
  const { showToast } = useApp();

  return (
    <div className="space-y-6" data-testid={testId} data-empty-count={data?.items.length ?? 0}>
      {/* 顶部工具栏（Phase 2 加筛选） */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="serif-heading text-[26px] md:text-[30px] leading-none">{pageTitle}</h2>
          <p className="text-[13px] text-ceramic-ash mt-2 max-w-2xl">{pageSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reload}
            disabled={loading}
            className="btn-gold-outline !px-4 flex items-center gap-2 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => showToast({ type: 'info', text: comingSoonHint })}
            className="btn-gold !px-4 flex items-center gap-2"
          >
            <Plus size={15} /> {newCtaLabel}
          </button>
        </div>
      </div>

      {/* Empty State（Phase 1 常态；Phase 2 有数据时此处进入表格卡片） */}
      <ConsoleEmptyState
        testId={`${testId ?? 'list'}-empty`}
        loading={loading}
        error={error}
        icon={Icon}
        title={`No ${pageTitle.toLowerCase()} yet`}
        description={
          error
            ? `There was an error loading ${pageTitle.toLowerCase()} (${error}). Click Refresh to try again.`
            : `No data has been connected to this module yet. This dashboard is intentionally empty during Phase 1 foundation.
               Real data pipelines & crawlers are planned for Phase 2 and beyond.
               Backend returned ${data?.total ?? 0} records (${data?.items.length ?? 0} on this page).`
        }
        action={{
          label: newCtaLabel,
          onClick: () => showToast({ type: 'info', text: comingSoonHint }),
        }}
        secondaryAction={{ label: 'Open CMS Admin Panel', onClick: () => window.open('/admin', '_blank') }}
      />
    </div>
  );
}

export default ConsoleListPageView;

/**
 * PHASE 2-B 海外客户开发中心 — Prospect Lists
 *
 * 路由: /console/leads/lists
 *
 * 一个 Prospect List = 一次 LeadImport 的产物。
 * 展示所有已上传的潜在客户清单，按 campaign / source / 状态筛选，
 * 显示 §17 重复检测统计（valid / invalid / duplicate / imported）。
 *
 * 行操作：
 *   - 点击行 → 跳转到 Lead 列表，按 importId 过滤
 *   - 删除：仅 status !== IMPORTING 的可删除
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Upload, RefreshCw, FileText, Trash2, Eye } from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleLeadImport } from '../../../types';
import { IMPORT_STATUSES } from '../../../utils/leadConfig';
import { useConsoleListPage } from '../../../components/console/ConsoleListPage';

const ProspectLists: React.FC = () => {
  const { showToast } = useApp();
  const nav = useNavigate();
  const hook = useConsoleListPage<ConsoleLeadImport>((p) => Console.Development.listImports(p), { pageSize: 20 });
  const { loading, data, reload } = hook;
  const rows = data.items || [];

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto" data-testid="prospect-lists">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="serif-heading text-[26px] flex items-center gap-2"><ListChecks size={22} /> Prospect Lists</h1>
          <p className="text-ceramic-ash text-[13px] mt-1">Each list is one uploaded CSV / Excel / JSON file of overseas prospects.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => reload()} className="btn-gold-outline !px-4 !py-2 text-[12px]"><RefreshCw size={13} className="inline mr-1" /> Refresh</button>
          <button onClick={() => nav('/console/leads/import')} className="btn-gold !px-4 !py-2 text-[12px]"><Upload size={13} className="inline mr-1" /> New Import</button>
        </div>
      </header>

      <div className="bg-white border border-ceramic-border rounded-sm overflow-x-auto">
        <table className="min-w-[920px] w-full text-[13px]">
          <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
            <tr className="text-left text-[10px] tracking-luxury uppercase text-ceramic-ash">
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Valid</th>
              <th className="px-4 py-3">Invalid</th>
              <th className="px-4 py-3">Duplicate</th>
              <th className="px-4 py-3">Imported</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-ceramic-ash">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <FileText size={36} className="mx-auto text-ceramic-ash mb-3" />
                  <div className="text-ceramic-ash text-[13px] mb-3">No prospect lists yet.</div>
                  <button onClick={() => nav('/console/leads/import')} className="btn-gold !px-5 inline-flex items-center gap-2"><Upload size={13} /> Import Leads</button>
                </td>
              </tr>
            ) : rows.map((r) => (
              <ListRow key={String(r._id)} r={r} onView={() => nav(`/console/leads?importId=${r._id}`)} onDelete={async () => {
                if (!window.confirm(`Delete prospect list "${r.fileName}"? This removes the import record only — imported Leads stay.`)) return;
                try {
                  // No DELETE endpoint exposed in §45 API spec; use batch on Lead to clear importId tag instead — keeping import record
                  showToast({ type: 'info', text: 'Delete API will ship with the import cleanup endpoint.' });
                } catch (e: any) {
                  showToast({ type: 'error', text: e?.message || 'Delete failed' });
                }
              }} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ListRow: React.FC<{ r: ConsoleLeadImport; onView: () => void; onDelete: () => void }> = ({ r, onView, onDelete }) => {
  const statusCls: Record<string, string> = {
    UPLOADED: 'bg-slate-100 text-slate-700 border-slate-200',
    PARSED: 'bg-blue-50 text-blue-700 border-blue-200',
    MAPPED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    VALIDATED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    IMPORTING: 'bg-amber-50 text-amber-700 border-amber-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    FAILED: 'bg-red-50 text-red-700 border-red-200',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <tr className="border-b border-ceramic-border last:border-0 hover:bg-ceramic-cream/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-ceramic-ash shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-ceramic-graphite truncate max-w-[260px]">{r.fileName}</div>
            {r.campaignId && <div className="text-[11px] text-ceramic-ash">campaign: {String(r.campaignId).slice(-6)}</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 uppercase text-[11px]">{r.fileType}</td>
      <td className="px-4 py-3 font-medium">{r.totalRows ?? 0}</td>
      <td className="px-4 py-3 text-emerald-700">{r.validRows ?? 0}</td>
      <td className="px-4 py-3 text-red-700">{r.invalidRows ?? 0}</td>
      <td className="px-4 py-3 text-amber-700">{r.duplicateRows ?? 0}</td>
      <td className="px-4 py-3 text-blue-700 font-medium">{r.importedRows ?? 0}</td>
      <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${statusCls[r.status] || ''}`}>{r.status}</span></td>
      <td className="px-4 py-3 text-[11px] text-ceramic-ash">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
      <td className="px-4 py-3 text-right">
        <button onClick={onView} className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-ceramic-gold-matte hover:underline"><Eye size={12} /> View Leads</button>
        <button onClick={onDelete} className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-red-600 hover:underline ml-1"><Trash2 size={12} /></button>
      </td>
    </tr>
  );
};

export default ProspectLists;

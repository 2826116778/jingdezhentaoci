/**
 * PHASE 2-C §42 AI Jobs — /console/ai/jobs
 *
 * 支持：
 *   Search / Status / Purpose / Provider / Date / Lead
 *   Retry Failed / Cancel Queued
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, Search, RotateCcw, X, Brain, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { AIResearchJob } from '../../../types';

const PURPOSE_LABEL: Record<string, string> = {
  CUSTOMER_RESEARCH: 'Research',
  LEAD_QUALIFICATION: 'Score',
  PRODUCT_MATCHING: 'Match',
  DEVELOPMENT_STRATEGY: 'Strategy',
  MESSAGE_DRAFT: 'Message',
};
const STATUS_OPTS = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'];
const PURPOSE_OPTS = ['CUSTOMER_RESEARCH', 'LEAD_QUALIFICATION', 'PRODUCT_MATCHING', 'DEVELOPMENT_STRATEGY', 'MESSAGE_DRAFT'];
const STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  QUEUED: 'bg-amber-50 text-amber-700 border-amber-200',
  RUNNING: 'bg-blue-50 text-blue-700 border-blue-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border-slate-200',
};

const AIJobs: React.FC = () => {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AIResearchJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [purpose, setPurpose] = useState('');
  const [provider, setProvider] = useState('');
  const [leadId, setLeadId] = useState('');

  const load = async (p = page) => {
    setLoading(true);
    try {
      const params: any = { page: p, pageSize };
      if (status) params.status = status;
      if (purpose) params.purpose = purpose;
      if (provider) params.provider = provider;
      if (leadId) params.leadId = leadId;
      if (search) params.search = search;
      const res = await Console.AI.listJobs(params);
      setItems(res?.items || []);
      setTotal(res?.total || 0);
      setPage(p);
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Failed to load jobs' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(1); /* eslint-disable-line */ }, []);

  const retry = async (leadId: string) => {
    try {
      await Console.AI.retryResearch(leadId);
      showToast({ type: 'success', text: 'Research retry queued' });
      load();
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Retry failed' });
    }
  };
  const cancel = async (id: string) => {
    try {
      await Console.AI.cancelJob(id);
      showToast({ type: 'success', text: 'Job cancelled' });
      load();
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Cancel failed' });
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 0;

  return (
    <div className="space-y-6" data-testid="ai-jobs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="serif-heading text-[24px] md:text-[28px]">AI Jobs</h1>
          <p className="text-[12px] text-ceramic-ash mt-1">{total} total · page {page} of {Math.max(1, totalPages)}</p>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 px-4 h-10 rounded-[2px] border border-ceramic-border hover:bg-ceramic-cream/40 text-[13px]">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[2px] bg-white border border-ceramic-border">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-ceramic-ash" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)}
            placeholder="Search…" className="h-9 w-[200px] rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border ps-9 pe-3 text-[13px] focus:border-ceramic-gold-matte focus:outline-none" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); load(1); }} className="h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-3 text-[13px] focus:outline-none">
          <option value="">All Status</option>
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={purpose} onChange={(e) => { setPurpose(e.target.value); load(1); }} className="h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-3 text-[13px] focus:outline-none">
          <option value="">All Purpose</option>
          {PURPOSE_OPTS.map((p) => <option key={p} value={p}>{PURPOSE_LABEL[p]}</option>)}
        </select>
        <select value={provider} onChange={(e) => { setProvider(e.target.value); load(1); }} className="h-9 rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-3 text-[13px] focus:outline-none">
          <option value="">All Providers</option>
          <option value="mock">mock</option>
          <option value="openai">openai</option>
        </select>
        <input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="Lead ID"
          className="h-9 w-[180px] rounded-[2px] bg-ceramic-cream/40 border border-ceramic-border px-3 text-[13px] focus:outline-none" />
      </div>

      {/* Table */}
      <div className="rounded-[2px] bg-white border border-ceramic-border overflow-hidden">
        {loading ? (
          <div className="px-5 py-12 text-center text-[13px] text-ceramic-ash">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-ceramic-ash">
            <Brain size={28} className="mx-auto mb-3 text-ceramic-ash/50" />
            No AI jobs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-ceramic-cream/40 text-ceramic-ash text-[11px] tracking-luxury uppercase">
                <tr>
                  <th className="text-start px-4 py-3 font-medium">Status</th>
                  <th className="text-start px-4 py-3 font-medium">Purpose</th>
                  <th className="text-start px-4 py-3 font-medium">Lead</th>
                  <th className="text-start px-4 py-3 font-medium">Provider</th>
                  <th className="text-start px-4 py-3 font-medium">Model</th>
                  <th className="text-end px-4 py-3 font-medium">Tokens</th>
                  <th className="text-start px-4 py-3 font-medium">Created</th>
                  <th className="text-center px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ceramic-border">
                {items.map((j) => (
                  <tr key={j._id} className="hover:bg-ceramic-cream/20">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] ${STATUS_CLS[j.status] || ''}`}>{j.status}</span>
                    </td>
                    <td className="px-4 py-3 text-ceramic-ash">{PURPOSE_LABEL[j.purpose] || j.purpose}</td>
                    <td className="px-4 py-3">
                      <Link to={`/console/leads/${j.leadId}/research`} className="text-ceramic-gold-matte hover:underline">
                        {j.leadId.slice(-8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ceramic-ash">{j.provider}</td>
                    <td className="px-4 py-3 text-ceramic-ash truncate max-w-[160px]">{j.aiModel || '—'}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-ceramic-ash">{j.tokenUsage?.total || 0}</td>
                    <td className="px-4 py-3 text-ceramic-ash text-[12px]">{new Date(j.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {j.status === 'FAILED' && (
                          <button onClick={() => retry(j.leadId)} title="Retry" className="p-1.5 rounded hover:bg-amber-50 text-amber-600">
                            <RotateCcw size={14} />
                          </button>
                        )}
                        {j.status === 'QUEUED' && (
                          <button onClick={() => cancel(j._id)} title="Cancel" className="p-1.5 rounded hover:bg-rose-50 text-rose-600">
                            <X size={14} />
                          </button>
                        )}
                        {j.error && (
                          <span title={j.error} className="text-rose-500">
                            <AlertTriangle size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => load(Math.max(1, page - 1))} disabled={page <= 1}
            className="inline-flex items-center gap-1 px-3 h-9 rounded-[2px] border border-ceramic-border text-[13px] disabled:opacity-40">
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="text-[13px] text-ceramic-ash">{page} / {totalPages}</span>
          <button onClick={() => load(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-3 h-9 rounded-[2px] border border-ceramic-border text-[13px] disabled:opacity-40">
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AIJobs;

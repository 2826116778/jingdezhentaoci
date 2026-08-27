/**
 * PHASE 2-B 升级 — Leads 列表（Lead 工作台）
 *
 * 规范 §24-25：
 *   Search: company / contact / email / website
 *   Filters: Country / City / Industry / Company Type / Source / Status / Grade / Score / Owner / Product Interest
 *   Sort: Score / Created Date / Last Contact / Next FollowUp
 *   Batch: Assign Owner / Change Status / Change Grade / Add Tags / Create Dev Task / Export CSV / Delete
 *
 * 同时保留 PHASE 2-A 的：
 *   - 新增 / 编辑 Lead
 *   - 单条 Score / Status
 *   - Convert to Customer
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users2, Star, UserCheck, ArrowRightLeft, Sparkles, RefreshCw, Plus, Edit2,
  Trash2, Eye, X, ChevronLeft, ChevronRight, Download, Target, Tag,
} from 'lucide-react';
import { Console, ConsoleListParams } from '../../api/console';
import { useApp } from '../../context/AppContext';
import type { ConsoleLead } from '../../types';
import LeadFormModal from './components/LeadFormModal';
import CustomerConvertModal from './components/CustomerConvertModal';
import { useConsoleListPage } from '../../components/console/ConsoleListPage';
import ConsoleEmptyState from '../../components/console/ConsoleEmptyState';
import {
  TARGET_INDUSTRIES, TARGET_COMPANY_TYPES, LEAD_SOURCES, LEAD_GRADES,
} from '../../utils/leadConfig';

const LeadStatuses = ['NEW', 'RESEARCHING', 'QUALIFIED', 'CONTACTED', 'REPLIED', 'INTERESTED', 'INQUIRY', 'CONVERTED', 'LOST'] as const;
const SortOptions = [
  { label: 'Score ↓', value: 'score:desc' },
  { label: 'Score ↑', value: 'score:asc' },
  { label: 'Newest', value: 'createdAt:desc' },
  { label: 'Oldest', value: 'createdAt:asc' },
  { label: 'Last Contact ↓', value: 'lastContactAt:desc' },
  { label: 'Next FollowUp ↑', value: 'nextFollowUpAt:asc' },
];

const Leads: React.FC = () => {
  const { showToast } = useApp();
  const nav = useNavigate();

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<string>('score:desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const [edit, setEdit] = useState<ConsoleLead | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [convertTarget, setConvertTarget] = useState<ConsoleLead | null>(null);

  // Build params from filters + sort
  const buildParams = (page = 1): ConsoleListParams => {
    const [sortKey, order] = sort.split(':');
    return { page, pageSize: 20, ...filters, sort: sortKey, order: order as 'asc' | 'desc' } as ConsoleListParams;
  };

  const hook = useConsoleListPage<ConsoleLead>((p) => Console.listLeads(p), buildParams(1));
  const { loading, error, data, reload } = hook;
  const rows = data.items || [];

  // Apply / clear filters
  const applyFilters = () => {
    setSelected(new Set());
    reload(buildParams(1));
  };
  const clearFilters = () => {
    setFilters({});
    setSelected(new Set());
    reload({ page: 1, pageSize: 20, sort: 'score', order: 'desc' } as any);
  };

  // Selection
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(String(r._id || r.id)));
  const toggleAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selected);
      rows.forEach((r) => next.delete(String(r._id || r.id)));
      setSelected(next);
    } else {
      const next = new Set(selected);
      rows.forEach((r) => next.add(String(r._id || r.id)));
      setSelected(next);
    }
  };
  const toggleOne = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  // ===== Batch actions =====
  const batchAction = async (action: string, payload: Record<string, any> = {}, confirmText?: string) => {
    if (!selectedIds.length) return showToast({ type: 'error', text: 'Select at least one lead first' });
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const r = await Console.Development.batchLeads(selectedIds, action, payload);
      showToast({ type: 'success', text: `Affected ${r.affected ?? selectedIds.length} leads` });
      setSelected(new Set());
      reload(buildParams(1));
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Batch failed' });
    } finally { setBusy(false); }
  };

  const batchAssignOwner = () => {
    const v = window.prompt('Owner ID (sales rep ObjectId):', '');
    if (!v) return;
    batchAction('assignOwner', { ownerId: v.trim() });
  };
  const batchChangeStatus = () => {
    const v = window.prompt(`Set status (one of: ${LeadStatuses.join('/')}):`, 'CONTACTED');
    if (!v) return;
    const s = v.toUpperCase();
    if (!LeadStatuses.includes(s as any)) return showToast({ type: 'error', text: 'Invalid status' });
    batchAction('changeStatus', { status: s });
  };
  const batchChangeGrade = () => {
    const v = window.prompt(`Set grade (one of A/B/C/D):`, 'B');
    if (!v) return;
    if (!LEAD_GRADES.includes(v.toUpperCase() as any)) return showToast({ type: 'error', text: 'Invalid grade' });
    batchAction('changeGrade', { grade: v.toUpperCase() });
  };
  const batchAddTags = () => {
    const v = window.prompt('Tags (comma separated):', 'vip, priority');
    if (!v) return;
    const tags = v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!tags.length) return;
    batchAction('addTags', { tags });
  };
  const batchCreateDevTask = () => {
    const title = window.prompt('Dev Task title:', `Dev task (${selectedIds.length} leads)`);
    if (!title) return;
    batchAction('createDevTask', { title, description: `Created from Lead list batch on ${new Date().toLocaleString()}` });
  };
  const batchExportCSV = () => {
    if (!rows.length) return showToast({ type: 'info', text: 'Export will use currently loaded page' });
    // Export selected (or all on page) as CSV
    const toExport = selectedIds.length
      ? rows.filter((r) => selectedIds.includes(String(r._id || r.id)))
      : rows;
    const headers = ['companyName', 'country', 'city', 'industry', 'companyType', 'contactName', 'jobTitle', 'email', 'phone', 'whatsapp', 'linkedin', 'source', 'status', 'score', 'grade'];
    const csv = [
      headers.join(','),
      ...toExport.map((r) => headers.map((h) => {
        const v = (r as any)[h];
        if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', text: `Exported ${toExport.length} leads` });
  };
  const batchDelete = () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected leads? This cannot be undone.`)) return;
    batchAction('delete', { confirm: true }, undefined);
  };

  return (
    <div className="space-y-6" data-testid="console-leads">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="serif-heading text-[26px] md:text-[30px] leading-none flex items-center gap-2"><Users2 size={22} /> Leads</h2>
          <p className="text-[13px] text-ceramic-ash mt-2 max-w-2xl">
            Potential overseas buyers. Search, filter, sort, score, and convert. Use batch actions for bulk operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => reload(buildParams(data.page))} disabled={loading} className="btn-gold-outline !px-4 flex items-center gap-2 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => { setEdit(null); setShowCreate(true); }} className="btn-gold !px-4 flex items-center gap-2">
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-ceramic-border rounded-[2px] p-4 flex flex-wrap gap-3 items-center">
        <FilterInput label="Search" value={filters.search || ''} onChange={(v) => setFilters({ ...filters, search: v })} placeholder="Company / Contact / Email" onEnter={applyFilters} />
        <FilterInput label="Country" value={filters.country || ''} onChange={(v) => setFilters({ ...filters, country: v })} placeholder="UAE / Saudi Arabia..." onEnter={applyFilters} />
        <FilterInput label="City" value={filters.city || ''} onChange={(v) => setFilters({ ...filters, city: v })} placeholder="Dubai..." onEnter={applyFilters} />
        <FilterSelect label="Industry" value={filters.industry || ''} options={TARGET_INDUSTRIES} onChange={(v) => setFilters({ ...filters, industry: v })} />
        <FilterSelect label="Company Type" value={filters.companyType || ''} options={TARGET_COMPANY_TYPES} onChange={(v) => setFilters({ ...filters, companyType: v })} />
        <FilterSelect label="Source" value={filters.source || ''} options={LEAD_SOURCES} onChange={(v) => setFilters({ ...filters, source: v })} />
        <FilterSelect label="Status" value={filters.status || ''} options={LeadStatuses} onChange={(v) => setFilters({ ...filters, status: v })} />
        <FilterSelect label="Grade" value={filters.grade || ''} options={LEAD_GRADES} onChange={(v) => setFilters({ ...filters, grade: v })} />
        <FilterInput label="Min Score" type="number" value={filters.minScore || ''} onChange={(v) => setFilters({ ...filters, minScore: v })} onEnter={applyFilters} />
        <FilterInput label="Max Score" type="number" value={filters.maxScore || ''} onChange={(v) => setFilters({ ...filters, maxScore: v })} onEnter={applyFilters} />
        <FilterInput label="Owner" value={filters.ownerId || ''} onChange={(v) => setFilters({ ...filters, ownerId: v })} placeholder="User ObjectId" onEnter={applyFilters} />
        <label className="flex flex-col gap-1 text-[11px] text-ceramic-ash">
          <span>Sort</span>
          <select className="border border-ceramic-border rounded-[2px] bg-white px-3 py-2 text-[13px]" value={sort} onChange={(e) => { setSort(e.target.value); }}>
            {SortOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button onClick={applyFilters} className="btn-gold !py-2 !px-4 text-[13px]">Apply</button>
        <button onClick={clearFilters} className="btn-gold-outline !py-2 !px-4 text-[13px] flex items-center gap-1"><X size={13} /> Clear</button>
        <div className="ml-auto text-[12px] text-ceramic-ash">
          Total: <strong className="text-ceramic-graphite">{data.total}</strong> · Page {data.page} of {data.totalPages || 1}
        </div>
      </div>

      {/* Batch toolbar (shown when selection > 0) */}
      {selectedIds.length > 0 && (
        <div className="bg-ceramic-gold-matte/5 border border-ceramic-gold-matte/40 rounded-[2px] px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ceramic-graphite">
            <strong>{selectedIds.length}</strong> selected
          </span>
          <span className="text-ceramic-ash">|</span>
          <BatchBtn Icon={UserCheck} label="Assign Owner" onClick={batchAssignOwner} disabled={busy} />
          <BatchBtn Icon={ArrowRightLeft} label="Change Status" onClick={batchChangeStatus} disabled={busy} />
          <BatchBtn Icon={Star} label="Change Grade" onClick={batchChangeGrade} disabled={busy} />
          <BatchBtn Icon={Tag} label="Add Tags" onClick={batchAddTags} disabled={busy} />
          <BatchBtn Icon={Target} label="Create Dev Task" onClick={batchCreateDevTask} disabled={busy} />
          <BatchBtn Icon={Download} label="Export CSV" onClick={batchExportCSV} disabled={busy} />
          <BatchBtn Icon={Trash2} label="Delete" onClick={batchDelete} disabled={busy} danger />
          <button onClick={() => setSelected(new Set())} className="text-[12px] text-ceramic-ash hover:underline ml-auto">Clear selection</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white border border-ceramic-border rounded-[2px] p-4 animate-pulse space-y-3">
          <div className="h-4 bg-ceramic-cream rounded" />
          <div className="h-4 bg-ceramic-cream rounded" />
          <div className="h-4 bg-ceramic-cream rounded" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <ConsoleEmptyState testId="console-leads-error" icon={Users2} title="Failed to load leads" description={error} action={{ label: 'Retry', onClick: () => reload(buildParams(data.page)) }} error={error} />
      )}

      {/* Empty */}
      {!loading && !error && rows.length === 0 && (
        <ConsoleEmptyState testId="console-leads-empty" icon={Users2} title="No leads yet" description='Backend returned 0 records. Click "Add Lead" to get started.' action={{ label: 'Add Lead', onClick: () => { setEdit(null); setShowCreate(true); } }} />
      )}

      {/* Table */}
      {!loading && !error && rows.length > 0 && (
        <>
          <div className="bg-white border border-ceramic-border rounded-[2px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-ceramic-cream/50 text-ceramic-ash text-[11px] tracking-luxury uppercase">
                  <th className="px-3 py-3 w-[40px]"><input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} /></th>
                  <th className="px-4 py-3 text-left w-[20%]">Company</th>
                  <th className="px-4 py-3 text-left w-[15%]">Contact</th>
                  <th className="px-4 py-3 text-left w-[16%]">Email</th>
                  <th className="px-4 py-3 text-left w-[10%]">Source</th>
                  <th className="px-4 py-3 text-left w-[10%]">Status</th>
                  <th className="px-4 py-3 text-left w-[8%]">Grade</th>
                  <th className="px-4 py-3 text-right w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const id = String(l._id || l.id);
                  return (
                    <tr key={id} className="border-t border-ceramic-border hover:bg-ceramic-cream/30">
                      <td className="px-3 py-3"><input type="checkbox" checked={selected.has(id)} onChange={() => toggleOne(id)} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => nav(`/console/leads/${id}`)} className="text-left">
                          <div className="font-medium text-ceramic-graphite hover:text-ceramic-gold-matte hover:underline">{l.companyName}</div>
                          <div className="text-[11px] text-ceramic-ash">{l.country || '—'} {l.industry ? `· ${l.industry}` : ''}</div>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>{l.contactName || '—'}</div>
                        <div className="text-[11px] text-ceramic-ash">{l.jobTitle || ''}</div>
                      </td>
                      <td className="px-4 py-3">{l.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[11px]">{l.source || '—'}</span>
                      </td>
                      <td className="px-4 py-3"><StatusChip status={l.status} /></td>
                      <td className="px-4 py-3"><GradeChip grade={l.grade} score={l.score} /></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1 justify-end flex-wrap">
                          <button title="View / Develop" onClick={() => nav(`/console/leads/${id}`)}
                            className="p-1.5 rounded border border-ceramic-border text-ceramic-ash hover:border-ceramic-gold hover:text-ceramic-gold">
                            <Eye size={13} />
                          </button>
                          <button title="Re-score" onClick={async () => {
                            try {
                              const r = await Console.Development.scoreLead(id);
                              showToast({ type: 'success', text: `Scored ${r.score} · ${r.grade}` });
                              reload(buildParams(data.page));
                            } catch (e: any) { showToast({ type: 'error', text: e?.message || 'Score failed' }); }
                          }}
                            className="p-1.5 rounded border border-ceramic-border text-ceramic-ash hover:border-ceramic-gold hover:text-ceramic-gold">
                            <Sparkles size={13} />
                          </button>
                          <button title="Edit" onClick={() => { setEdit(l); setShowCreate(true); }}
                            className="p-1.5 rounded border border-ceramic-border text-ceramic-ash hover:border-ceramic-gold hover:text-ceramic-gold">
                            <Edit2 size={13} />
                          </button>
                          <button title="Convert to Customer" disabled={l.status === 'CONVERTED'} onClick={() => setConvertTarget(l)}
                            className="p-1.5 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">
                            <ArrowRightLeft size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages || 1} total={data.total} onChange={(p) => reload(buildParams(p))} />
        </>
      )}

      <LeadFormModal
        open={showCreate}
        initial={edit || undefined}
        onClose={() => { setShowCreate(false); setEdit(null); }}
        onSaved={() => { setShowCreate(false); setEdit(null); reload(buildParams(data.page)); }}
      />
      <CustomerConvertModal
        open={!!convertTarget}
        lead={convertTarget}
        onClose={() => setConvertTarget(null)}
        onDone={() => { setConvertTarget(null); reload(buildParams(data.page)); }}
      />
    </div>
  );
};

// ===== Status & Grade chips (consistent with PHASE 2-A) =====
function StatusChip({ status }: { status: ConsoleLead['status'] }) {
  const map: Record<ConsoleLead['status'], string> = {
    NEW: 'bg-gray-100 text-gray-700 border-gray-200',
    RESEARCHING: 'bg-blue-50 text-blue-700 border-blue-200',
    QUALIFIED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    CONTACTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    REPLIED:   'bg-sky-50 text-sky-700 border-sky-200',
    INTERESTED:'bg-purple-50 text-purple-700 border-purple-200',
    INQUIRY:   'bg-amber-50 text-amber-800 border-amber-200',
    CONVERTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LOST:      'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${map[status] || ''}`}>{status}</span>;
}
function GradeChip({ grade, score }: { grade: ConsoleLead['grade']; score: number }) {
  const color = grade === 'A' ? 'text-amber-600' : grade === 'B' ? 'text-cyan-700' : grade === 'C' ? 'text-slate-600' : 'text-slate-400';
  return (
    <div className="flex items-center gap-1">
      <Star size={12} className={color} fill={grade === 'A' ? 'currentColor' : 'none'} />
      <span className={`font-semibold ${color}`}>{grade}</span>
      <span className="text-[11px] text-ceramic-ash">{score}</span>
    </div>
  );
}

// ===== Filter cells =====
function FilterInput({ label, value, onChange, onEnter, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; onEnter: () => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-ceramic-ash">
      <span>{label}</span>
      <input
        type={type}
        className="border border-ceramic-border rounded-[2px] bg-white px-3 py-2 text-[13px] text-ceramic-graphite focus:border-ceramic-gold-matte focus:outline-none w-[160px]"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
      />
    </label>
  );
}
function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-ceramic-ash">
      <span>{label}</span>
      <select
        className="border border-ceramic-border rounded-[2px] bg-white px-3 py-2 text-[13px] text-ceramic-graphite focus:border-ceramic-gold-matte focus:outline-none w-[150px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function BatchBtn({ Icon, label, onClick, disabled, danger }: {
  Icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-[12px] disabled:opacity-50 ${
        danger ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-ceramic-border text-ceramic-graphite hover:border-ceramic-gold-matte hover:text-ceramic-gold-matte'
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}

function Pagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-[12px] text-ceramic-ash">Total: <strong>{total}</strong></div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} className="p-1.5 rounded border border-ceramic-border text-ceramic-ash disabled:opacity-40 hover:border-ceramic-gold-matte">
          <ChevronLeft size={14} />
        </button>
        <span className="text-[12px] text-ceramic-graphite">{page} / {totalPages || 1}</span>
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="p-1.5 rounded border border-ceramic-border text-ceramic-ash disabled:opacity-40 hover:border-ceramic-gold-matte">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default Leads;

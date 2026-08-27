/**
 * PHASE 2-B 海外客户开发中心 — Lead Scoring
 *
 * 路由: /console/leads/scoring
 *
 * 规范 §19-23：
 *   - 真实评分算法 0-100（行业 / 公司类型 / 国家优先级 / 产品 / 联系方式 / 完整度 / 意向）
 *   - Grade A(80-100) / B(60-79) / C(40-59) / D(0-39)
 *   - §21 评分必须显示原因列表（不只 Score: 92）
 *   - §22 国家优先级来自 DB（不硬编码）
 *   - §23 产品匹配 Lead 行业 → 推荐产品（来自 DB）
 *
 * 后端：POST /console/development/scoring/score/:leadId 和 /scoring/batch
 */
import React, { useMemo, useState } from 'react';
import {
  Gauge, RefreshCw, Star, Eye, ChevronDown, ChevronUp, Sparkles, AlertCircle,
} from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleLead } from '../../../types';
import { useConsoleListPage } from '../../../components/console/ConsoleListPage';
import { LEAD_GRADES, scoreToGrade } from '../../../utils/leadConfig';

const LeadScoring: React.FC = () => {
  const { showToast } = useApp();
  const hook = useConsoleListPage<ConsoleLead>((p) => Console.listLeads(p), { pageSize: 20, sort: 'score', order: 'desc' } as any);
  const { loading, data, params, reload } = hook;
  const rows = data.items || [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expand, setExpand] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<string>('');

  const toggleSel = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = () => {
    if (rows.every((r) => selected.has(String(r._id)))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => String(r._id))));
    }
  };

  const scoreOne = async (lead: ConsoleLead) => {
    setScoring(true);
    try {
      const r = await Console.Development.scoreLead(String(lead._id || lead.id));
      showToast({ type: 'success', text: `Scored ${r.score} · ${r.grade}` });
      reload();
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Score failed' });
    } finally { setScoring(false); }
  };
  const batchScore = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return showToast({ type: 'error', text: 'Select at least one lead' });
    setScoring(true);
    try {
      const r = await Console.Development.batchScore(ids);
      showToast({ type: 'success', text: `Scored ${r.scored} leads` });
      setSelected(new Set());
      reload();
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Batch score failed' });
    } finally { setScoring(false); }
  };

  const applyGrade = (g: string) => {
    setGradeFilter(g);
    reload({ ...params, grade: g, page: 1 });
  };

  const stats = useMemo(() => {
    const total = data.total || rows.length;
    const a = rows.filter((r) => r.grade === 'A').length;
    const b = rows.filter((r) => r.grade === 'B').length;
    const c = rows.filter((r) => r.grade === 'C').length;
    const d = rows.filter((r) => r.grade === 'D').length;
    return { total, a, b, c, d };
  }, [rows, data.total]);

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto" data-testid="lead-scoring">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="serif-heading text-[26px] flex items-center gap-2"><Gauge size={22} /> Lead Scoring</h1>
          <p className="text-ceramic-ash text-[13px] mt-1 max-w-3xl">
            Score leads 0–100 across 7 dimensions (industry / company type / country priority / product match / contact / completeness / intent). Grade A/B/C/D per §20.
          </p>
        </div>
        <button onClick={() => reload()} className="btn-gold-outline !px-4 !py-2 text-[12px]"><RefreshCw size={13} className="inline mr-1" /> Refresh</button>
      </header>

      {/* Grade filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[11px] tracking-luxury uppercase text-ceramic-ash mr-1">Filter by Grade:</span>
        <button onClick={() => applyGrade('')} className={`px-3 py-1 rounded-full text-[12px] border ${!gradeFilter ? 'bg-ceramic-gold-matte text-white border-ceramic-gold-matte' : 'bg-white border-ceramic-border hover:border-ceramic-gold-matte/50'}`}>All</button>
        {LEAD_GRADES.map((g) => (
          <button key={g} onClick={() => applyGrade(g)} className={`px-3 py-1 rounded-full text-[12px] border ${gradeFilter === g ? 'bg-ceramic-gold-matte text-white border-ceramic-gold-matte' : 'bg-white border-ceramic-border hover:border-ceramic-gold-matte/50'}`}>Grade {g}</button>
        ))}
        <span className="text-[11px] text-ceramic-ash ml-auto">Showing {rows.length} of {stats.total}</span>
      </div>

      {/* Grade summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <GradeTile label="Total" value={stats.total} cls="text-ceramic-graphite" />
        <GradeTile label="A · 80-100" value={stats.a} cls="text-amber-600" />
        <GradeTile label="B · 60-79" value={stats.b} cls="text-cyan-700" />
        <GradeTile label="C · 40-59" value={stats.c} cls="text-slate-600" />
        <GradeTile label="D · 0-39" value={stats.d} cls="text-slate-400" />
      </div>

      {/* Batch toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 bg-white border border-ceramic-border rounded-sm px-4 py-3">
        <span className="text-[12px] text-ceramic-graphite">
          <strong>{selected.size}</strong> selected
        </span>
        <button
          onClick={batchScore}
          disabled={scoring || !selected.size}
          className="btn-gold !px-4 !py-1.5 text-[12px] disabled:opacity-50"
        >
          <Sparkles size={13} className="inline mr-1" /> Score Selected
        </button>
        {selected.size > 0 && (
          <button onClick={() => setSelected(new Set())} className="text-[12px] text-ceramic-ash hover:underline">Clear</button>
        )}
        <div className="text-[11px] text-ceramic-ash ml-auto">
          Click ▶ on a row to see score reasons (§21). Re-score any lead to refresh its grade.
        </div>
      </div>

      {/* Leads table */}
      <div className="bg-white border border-ceramic-border rounded-sm overflow-x-auto">
        <table className="min-w-[920px] w-full text-[13px]">
          <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
            <tr className="text-left text-[10px] tracking-luxury uppercase text-ceramic-ash">
              <th className="px-3 py-3"><input type="checkbox" checked={rows.length > 0 && rows.every((r) => selected.has(String(r._id)))} onChange={toggleAll} /></th>
              <th className="px-3 py-3">Company</th>
              <th className="px-3 py-3">Country</th>
              <th className="px-3 py-3">Industry</th>
              <th className="px-3 py-3">Score</th>
              <th className="px-3 py-3">Grade</th>
              <th className="px-3 py-3">Reasons</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-ceramic-ash">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center">
                  <Gauge size={36} className="mx-auto text-ceramic-ash mb-3" />
                  <div className="text-ceramic-ash text-[13px] mb-3">No leads to score.</div>
                  <a href="/console/leads" className="btn-gold !px-5 inline-flex items-center gap-2"><Eye size={13} /> Go to Leads</a>
                </td>
              </tr>
            ) : rows.map((r) => (
              <React.Fragment key={String(r._id)}>
                <ScoreRow
                  lead={r}
                  selected={selected.has(String(r._id))}
                  onToggle={() => toggleSel(String(r._id))}
                  expanded={expand === String(r._id)}
                  onExpand={() => setExpand(expand === String(r._id) ? null : String(r._id))}
                  onScore={() => scoreOne(r)}
                  scoring={scoring}
                />
                {expand === String(r._id) && (
                  <tr className="bg-ceramic-cream/40">
                    <td colSpan={8} className="px-12 py-4">
                      <ScoreReasons lead={r} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ScoreRow: React.FC<{
  lead: ConsoleLead; selected: boolean; onToggle: () => void; expanded: boolean;
  onExpand: () => void; onScore: () => void; scoring: boolean;
}> = ({ lead, selected, onToggle, expanded, onExpand, onScore, scoring }) => {
  const grade = lead.grade || scoreToGrade(lead.score || 0);
  const color = grade === 'A' ? 'text-amber-600' : grade === 'B' ? 'text-cyan-700' : grade === 'C' ? 'text-slate-600' : 'text-slate-400';
  return (
    <tr className="border-b border-ceramic-border last:border-0 hover:bg-ceramic-cream/30">
      <td className="px-3 py-3"><input type="checkbox" checked={selected} onChange={onToggle} /></td>
      <td className="px-3 py-3">
        <div className="font-medium text-ceramic-graphite">{lead.companyName}</div>
        <div className="text-[11px] text-ceramic-ash">{lead.contactName || '—'}</div>
      </td>
      <td className="px-3 py-3 text-[12px]">{lead.country || '—'}</td>
      <td className="px-3 py-3 text-[12px]">{lead.industry || '—'}</td>
      <td className="px-3 py-3"><span className="font-semibold">{lead.score ?? 0}</span></td>
      <td className={`px-3 py-3 font-bold ${color}`}>
        <span className="inline-flex items-center gap-1"><Star size={12} fill={grade === 'A' ? 'currentColor' : 'none'} /> {grade}</span>
      </td>
      <td className="px-3 py-3">
        <button onClick={onExpand} className="text-[12px] text-ceramic-gold-matte hover:underline inline-flex items-center gap-1">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {(lead.scoreReasons || []).length || 0} reasons
        </button>
      </td>
      <td className="px-3 py-3 text-right">
        <button onClick={onScore} disabled={scoring} className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-ceramic-gold-matte hover:underline disabled:opacity-50">
          <Sparkles size={12} /> Re-score
        </button>
      </td>
    </tr>
  );
};

const ScoreReasons: React.FC<{ lead: ConsoleLead }> = ({ lead }) => {
  const reasons = lead.scoreReasons || [];
  if (!reasons.length) {
    return (
      <div className="text-[12px] text-ceramic-ash flex items-center gap-2">
        <AlertCircle size={14} /> No score reasons yet. Click "Re-score" to compute score + reasons from current Lead data.
      </div>
    );
  }
  return (
    <div>
      <div className="text-[11px] tracking-luxury uppercase text-ceramic-gold-matte mb-2">Score Reasons (§21)</div>
      <ul className="space-y-1">
        {reasons.map((r, i) => (
          <li key={i} className="text-[12px] text-ceramic-graphite/80 flex items-start gap-2">
            <span className="text-emerald-700 font-mono">+</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const GradeTile: React.FC<{ label: string; value: number; cls: string }> = ({ label, value, cls }) => (
  <div className="bg-white border border-ceramic-border rounded-sm px-4 py-3">
    <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash mb-1">{label}</div>
    <div className={`text-[22px] serif-heading leading-none ${cls}`}>{value}</div>
  </div>
);

export default LeadScoring;

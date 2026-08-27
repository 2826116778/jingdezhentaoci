/**
 * PHASE 2-B 海外客户开发中心 — Lead Import 向导
 *
 * 路由: /console/leads/import
 *
 * 业务流程（来自 PHASE 2-B 规范 §13）：
 *   Upload  →  Parse  →  Preview  →  Field Mapping  →
 *   Validation  →  Duplicate Detection  →  Import  →  Import Result
 *
 * 关键规则：
 *   §14 上传后不能直接写数据库：必须先 Import Preview。
 *   §15 字段映射：未知列 → Ignore。
 *   §16 数据验证：companyName / email / URL / phone 不合法 → INVALID。
 *   §17 重复检测：website > email > phone > companyName+country。
 *   §18 重复处理策略：Skip / Update Existing / Create Anyway（默认 Skip）。
 *   §19/20 评分与等级（导入完成后由 Scoring 页面单独触发，本页不自动评分）。
 *   §44 每个导入必须可追踪：importId / campaignId / source 全部绑定。
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Upload, FileText, X, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle,
  RefreshCw, Database, CopyCheck, Table2,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type {
  ConsoleLeadImport, ConsoleLeadImportRow, ConsoleLeadCampaign,
} from '../../../types';
import {
  LEAD_FIELDS, LEAD_FIELD_LABELS, LEAD_SOURCES, DUPLICATE_STRATEGIES,
  type LeadField, type DuplicateStrategy,
} from '../../../utils/leadConfig';

type StepKey = 'upload' | 'map' | 'validate' | 'commit';
const STEPS: { key: StepKey; label: string; Icon: React.ElementType }[] = [
  { key: 'upload',   label: '1. Upload',     Icon: Upload },
  { key: 'map',      label: '2. Field Mapping', Icon: Table2 },
  { key: 'validate', label: '3. Validate & Dedupe', Icon: CopyCheck },
  { key: 'commit',   label: '4. Import',     Icon: Database },
];

const LeadImportWizard: React.FC = () => {
  const { showToast } = useApp();

  // ----- Wizard state -----
  const [step, setStep] = useState<StepKey>('upload');
  const [busy, setBusy] = useState(false);

  // Upload step
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const [fileSize, setFileSize] = useState(0);
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [campaignId, setCampaignId] = useState<string>('');
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('SKIP');
  const [importId, setImportId] = useState<string>('');
  const [uploadPreview, setUploadPreview] = useState<Record<string, any>[]>([]);

  // Mapping step
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [mappedPreview, setMappedPreview] = useState<Record<string, any>[]>([]);

  // Validate step
  const [validation, setValidation] = useState<ValidationSummary | null>(null);

  // Commit step
  const [commitResult, setCommitResult] = useState<{ total: number; imported: number; updated: number; skipped: number; failed: number; status: string } | null>(null);

  // ----- Campaigns list (for selection) -----
  const [campaigns, setCampaigns] = useState<ConsoleLeadCampaign[]>([]);
  useEffect(() => {
    Console.Development.listCampaigns({ page: 1, pageSize: 100, status: 'ACTIVE' } as any)
      .then((r) => setCampaigns(r?.items || []))
      .catch(() => setCampaigns([]));
  }, []);

  // ===== Step 1: Upload =====
  const onFilePicked = async (file: File) => {
    setBusy(true);
    setCommitResult(null);
    setValidation(null);
    setMappedPreview([]);
    setFieldMapping({});
    setUploadPreview([]);
    try {
      const name = file.name;
      const ext = name.split('.').pop()?.toLowerCase() || 'csv';
      const type: 'csv' | 'xlsx' | 'json' = ext === 'xlsx' ? 'xlsx' : ext === 'json' ? 'json' : 'csv';
      let rows: Record<string, any>[] = [];
      if (type === 'csv') {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
        rows = (parsed.data || []).filter((r) => Object.values(r).some((v) => v !== '' && v != null));
      } else if (type === 'xlsx') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheetName], { defval: '' });
      } else {
        const text = await file.text();
        rows = JSON.parse(text);
        if (!Array.isArray(rows)) throw new Error('JSON must be an array of objects');
      }
      if (!rows.length) throw new Error('No rows found in file');
      setFileName(name);
      setFileType(type);
      setFileSize(file.size);
      setRawData(rows);
      setUploadPreview(rows.slice(0, 20));
      setSourceColumns(Object.keys(rows[0] || {}));
      // 自动建议字段映射（基于列名小写匹配）
      const auto: Record<string, string> = {};
      const lcFieldMap: Record<string, string> = {};
      LEAD_FIELDS.forEach((f) => { lcFieldMap[f.toLowerCase()] = f; });
      Object.keys(rows[0] || {}).forEach((col) => {
        const lc = col.toLowerCase().replace(/[\s_-]+/g, '');
        if (lcFieldMap[lc]) auto[col] = lcFieldMap[lc];
      });
      setFieldMapping(auto);
      showToast({ type: 'success', text: `Parsed ${rows.length} rows · ${type.toUpperCase()}` });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Parse failed' });
    } finally { setBusy(false); }
  };

  const doUpload = async () => {
    if (!rawData.length) return showToast({ type: 'error', text: 'No data to upload' });
    setBusy(true);
    try {
      const r = await Console.Development.uploadImport({
        fileName, fileType, fileSize, rawData,
        campaignId: campaignId || undefined,
        duplicateStrategy,
      });
      setImportId(r.importId);
      setUploadPreview(r.preview);
      setStep('map');
      showToast({ type: 'success', text: `Uploaded ${r.totalRows} rows` });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Upload failed' });
    } finally { setBusy(false); }
  };

  // ===== Step 2: Map =====
  const doMap = async () => {
    if (!importId) return;
    setBusy(true);
    try {
      const r = await Console.Development.mapImport(importId, fieldMapping);
      setMappedPreview(r.preview);
      setStep('validate');
      showToast({ type: 'info', text: 'Field mapping saved' });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Map failed' });
    } finally { setBusy(false); }
  };

  // ===== Step 3: Validate =====
  const doValidate = async () => {
    if (!importId) return;
    setBusy(true);
    try {
      const r = await Console.Development.validateImport(importId);
      setValidation(r);
      setStep('commit');
      showToast({
        type: r.invalidRows > 0 || r.duplicateRows > 0 ? 'info' : 'success',
        text: `Valid ${r.validRows} · Invalid ${r.invalidRows} · Duplicate ${r.duplicateRows}`,
      });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Validate failed' });
    } finally { setBusy(false); }
  };

  // ===== Step 4: Commit =====
  const doCommit = async () => {
    if (!importId) return;
    setBusy(true);
    try {
      const r = await Console.Development.commitImport(importId);
      setCommitResult(r);
      showToast({ type: 'success', text: `Imported ${r.imported} leads` });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Commit failed' });
    } finally { setBusy(false); }
  };

  const reset = () => {
    setStep('upload');
    setFileName(''); setFileType('csv'); setFileSize(0);
    setRawData([]); setUploadPreview([]); setImportId('');
    setSourceColumns([]); setFieldMapping({}); setMappedPreview([]);
    setValidation(null); setCommitResult(null);
    setCampaignId(''); setDuplicateStrategy('SKIP');
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto" data-testid="lead-import-wizard">
      <header className="mb-6">
        <h1 className="serif-heading text-[26px]">Lead Import Wizard</h1>
        <p className="text-ceramic-ash text-[13px] mt-1">
          Upload a CSV / Excel file of overseas prospects, map columns to Lead fields,
          validate and dedupe, then import. Each import is traceable to a campaign.
        </p>
      </header>

      {/* ===== Stepper ===== */}
      <ol className="flex flex-wrap items-center gap-2 mb-8 bg-white border border-ceramic-border rounded-sm p-3">
        {STEPS.map((s, idx) => {
          const active = idx === stepIndex;
          const done = idx < stepIndex;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-[2px] text-[12px] transition-all ${
                  active ? 'bg-ceramic-gold-matte text-white border border-ceramic-gold-matte'
                  : done ? 'bg-ceramic-cream/60 text-ceramic-graphite border border-ceramic-border'
                         : 'text-ceramic-ash border border-transparent'
                }`}
              >
                <s.Icon size={14} />
                <span>{s.label}</span>
                {done && <CheckCircle2 size={12} />}
              </div>
              {idx < STEPS.length - 1 && <ArrowRight size={12} className="text-ceramic-ash" />}
            </li>
          );
        })}
      </ol>

      {/* ===== Step content ===== */}
      {step === 'upload' && (
        <UploadStep
          fileName={fileName} fileType={fileType} fileSize={fileSize}
          rawData={rawData} uploadPreview={uploadPreview}
          campaigns={campaigns} campaignId={campaignId} setCampaignId={setCampaignId}
          duplicateStrategy={duplicateStrategy} setDuplicateStrategy={setDuplicateStrategy}
          onPick={onFilePicked} onUpload={doUpload} busy={busy}
        />
      )}

      {step === 'map' && (
        <MapStep
          sourceColumns={sourceColumns} fieldMapping={fieldMapping} setFieldMapping={setFieldMapping}
          mappedPreview={mappedPreview.length ? mappedPreview : uploadPreview}
          onBack={() => setStep('upload')} onNext={doMap} busy={busy}
        />
      )}

      {step === 'validate' && (
        <ValidateStep onBack={() => setStep('map')} onNext={doValidate} busy={busy}
          tip="Press Validate to run server-side checks (company / email / URL / phone) and duplicate detection (website → email → phone → company+country)."
        />
      )}

      {step === 'commit' && validation && (
        <CommitStep
          validation={validation} commitResult={commitResult}
          onBack={() => setStep('validate')} onCommit={doCommit} onReset={reset} busy={busy}
          duplicateStrategy={duplicateStrategy}
        />
      )}
    </div>
  );
};

// ====================================================================
//  Step 1: Upload
// ====================================================================
const UploadStep: React.FC<{
  fileName: string; fileType: 'csv' | 'xlsx' | 'json'; fileSize: number;
  rawData: Record<string, any>[]; uploadPreview: Record<string, any>[];
  campaigns: ConsoleLeadCampaign[]; campaignId: string; setCampaignId: (v: string) => void;
  duplicateStrategy: DuplicateStrategy; setDuplicateStrategy: (v: DuplicateStrategy) => void;
  onPick: (f: File) => void; onUpload: () => void; busy: boolean;
}> = ({ fileName, fileType, fileSize, rawData, uploadPreview, campaigns, campaignId, setCampaignId, duplicateStrategy, setDuplicateStrategy, onPick, onUpload, busy }) => {
  const cols = useMemo(() => (rawData[0] ? Object.keys(rawData[0]) : []), [rawData]);
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Upload zone */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white border border-ceramic-border rounded-sm p-5">
          <h3 className="serif-heading text-[18px] mb-3 flex items-center gap-2"><Upload size={16} /> Choose File</h3>
          <label className="block">
            <input
              type="file"
              accept=".csv,.xlsx,.json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
              className="hidden"
            />
            <span className="inline-flex items-center gap-2 btn-gold-outline !px-4 !py-2 text-[12px] cursor-pointer">
              <FileText size={14} /> Browse CSV / Excel / JSON
            </span>
          </label>
          {fileName && (
            <div className="mt-4 text-[12px] text-ceramic-graphite/80 space-y-1">
              <div className="flex items-center gap-2"><FileText size={12} /> <strong>{fileName}</strong></div>
              <div>Format: <span className="uppercase">{fileType}</span></div>
              <div>Size: {(fileSize / 1024).toFixed(1)} KB</div>
              <div>Rows parsed: <strong>{rawData.length}</strong></div>
            </div>
          )}
        </div>

        <div className="bg-white border border-ceramic-border rounded-sm p-5 space-y-3">
          <h4 className="text-[12px] tracking-luxury uppercase text-ceramic-gold-matte font-semibold">Import Options</h4>
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Assign to Campaign (optional — for §44 traceability)</span>
            <select className="input-gold text-[13px]" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">— None —</option>
              {campaigns.map((c) => <option key={String(c._id)} value={String(c._id)}>{c.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Duplicate Strategy (§18) — default Skip</span>
            <select className="input-gold text-[13px]" value={duplicateStrategy} onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}>
              {DUPLICATE_STRATEGIES.map((s) => <option key={s} value={s}>{s === 'SKIP' ? 'Skip' : s === 'UPDATE' ? 'Update Existing' : 'Create Anyway'}</option>)}
            </select>
          </label>
        </div>

        <button
          onClick={onUpload}
          disabled={busy || !rawData.length}
          className="btn-gold w-full !py-3 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload & Continue →'}
        </button>
      </div>

      {/* Preview table */}
      <div className="lg:col-span-2 bg-white border border-ceramic-border rounded-sm p-5">
        <h3 className="serif-heading text-[18px] mb-3">Import Preview (§14)</h3>
        {!uploadPreview.length ? (
          <div className="text-[13px] text-ceramic-ash py-8 text-center">No file uploaded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
                <tr>
                  {cols.map((c) => <th key={c} className="px-3 py-2 text-left text-[10px] uppercase tracking-luxury text-ceramic-ash whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {uploadPreview.map((r, i) => (
                  <tr key={i} className="border-b border-ceramic-border last:border-0">
                    {cols.map((c) => <td key={c} className="px-3 py-2 max-w-[220px] truncate">{String(r[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-ceramic-ash">Showing first {Math.min(20, uploadPreview.length)} of {rawData.length} rows.</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ====================================================================
//  Step 2: Field Mapping
// ====================================================================
const MapStep: React.FC<{
  sourceColumns: string[]; fieldMapping: Record<string, string>;
  setFieldMapping: (m: Record<string, string>) => void;
  mappedPreview: Record<string, any>[];
  onBack: () => void; onNext: () => void; busy: boolean;
}> = ({ sourceColumns, fieldMapping, setFieldMapping, mappedPreview, onBack, onNext, busy }) => {
  const setOne = (col: string, target: string) => setFieldMapping({ ...fieldMapping, [col]: target });
  const targets = useMemo(() => ['ignore', ...LEAD_FIELDS], []);
  const mappedCols = useMemo(() => {
    const arr: { col: string; target: string }[] = [];
    sourceColumns.forEach((col) => arr.push({ col, target: fieldMapping[col] || 'ignore' }));
    return arr;
  }, [sourceColumns, fieldMapping]);
  return (
    <div className="space-y-6">
      <div className="bg-white border border-ceramic-border rounded-sm p-5">
        <h3 className="serif-heading text-[18px] mb-1 flex items-center gap-2"><Table2 size={16} /> Field Mapping (§15)</h3>
        <p className="text-[12px] text-ceramic-ash mb-4">Map each uploaded column to a Lead field. Unknown columns → Ignore.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mappedCols.map(({ col, target }) => (
            <div key={col} className="flex items-center gap-2 text-[12px]">
              <div className="flex-1 truncate text-ceramic-graphite/80 px-2 py-1.5 bg-ceramic-cream/60 border border-ceramic-border rounded-[2px]">{col}</div>
              <ArrowRight size={12} className="text-ceramic-ash shrink-0" />
              <select
                className="input-gold text-[12px] flex-1"
                value={target}
                onChange={(e) => setOne(col, e.target.value)}
              >
                {targets.map((t) => {
                  const v = t === 'ignore' ? 'ignore' : t;
                  const label = t === 'ignore' ? 'Ignore' : LEAD_FIELD_LABELS[t as LeadField];
                  return <option key={v} value={v}>{label}</option>;
                })}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-ceramic-border rounded-sm p-5">
        <h3 className="serif-heading text-[18px] mb-3">Mapped Preview</h3>
        <MappedPreviewTable rows={mappedPreview} mapping={fieldMapping} />
      </div>

      <div className="flex justify-between gap-3">
        <button onClick={onBack} className="btn-gold-outline !px-6" disabled={busy}><ArrowLeft size={14} className="inline mr-1" /> Back</button>
        <button onClick={onNext} className="btn-gold !px-6" disabled={busy}>{busy ? 'Mapping…' : 'Validate & Dedupe →'}</button>
      </div>
    </div>
  );
};

function MappedPreviewTable({ rows, mapping }: { rows: Record<string, any>[]; mapping: Record<string, string> }) {
  const targets = Array.from(new Set(Object.values(mapping).filter((v) => v && v !== 'ignore')));
  if (!rows.length) return <div className="text-[12px] text-ceramic-ash py-4">No preview data.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[12px]">
        <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
          <tr>
            <th className="px-2 py-2 text-left text-[10px] uppercase text-ceramic-ash">#</th>
            {targets.map((t) => <th key={t} className="px-3 py-2 text-left text-[10px] uppercase tracking-luxury text-ceramic-ash whitespace-nowrap">{LEAD_FIELD_LABELS[t as LeadField] || t}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 25).map((r, i) => {
            const mapped: Record<string, any> = {};
            Object.entries(mapping).forEach(([src, tgt]) => {
              if (tgt && tgt !== 'ignore' && r[src] !== undefined) mapped[tgt] = r[src];
            });
            return (
              <tr key={i} className="border-b border-ceramic-border last:border-0">
                <td className="px-2 py-1.5 text-ceramic-ash">{i + 1}</td>
                {targets.map((t) => <td key={t} className="px-3 py-1.5 max-w-[200px] truncate">{String(mapped[t] ?? '')}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ====================================================================
//  Step 3: Validate
// ====================================================================
const ValidateStep: React.FC<{ onBack: () => void; onNext: () => void; busy: boolean; tip: string }> =
({ onBack, onNext, busy, tip }) => (
  <div className="bg-white border border-ceramic-border rounded-sm p-8 text-center">
    <CopyCheck size={48} className="mx-auto text-ceramic-gold-matte mb-4" />
    <h3 className="serif-heading text-[20px] mb-2">Ready to Validate & Dedupe</h3>
    <p className="text-[13px] text-ceramic-ash max-w-2xl mx-auto mb-6">{tip}</p>
    <div className="flex justify-center gap-3">
      <button onClick={onBack} className="btn-gold-outline !px-6" disabled={busy}><ArrowLeft size={14} className="inline mr-1" /> Back</button>
      <button onClick={onNext} className="btn-gold !px-6" disabled={busy}>{busy ? 'Validating…' : 'Run Validation & Dedupe →'}</button>
    </div>
  </div>
);

// ====================================================================
//  Step 4: Commit / Result
// ====================================================================
interface ValidationSummary {
  totalRows: number; validRows: number; invalidRows: number; duplicateRows: number;
  rows: ConsoleLeadImportRow[];
}
const CommitStep: React.FC<{
  validation: ValidationSummary; commitResult: { total: number; imported: number; updated: number; skipped: number; failed: number; status: string } | null;
  onBack: () => void; onCommit: () => void; onReset: () => void; busy: boolean;
  duplicateStrategy: DuplicateStrategy;
}> = ({ validation, commitResult, onBack, onCommit, onReset, busy, duplicateStrategy }) => {
  if (!commitResult) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Total Rows" value={validation.totalRows} cls="text-ceramic-graphite" />
          <StatTile label="Valid" value={validation.validRows} cls="text-emerald-700" />
          <StatTile label="Invalid" value={validation.invalidRows} cls="text-red-700" />
          <StatTile label="Duplicates" value={validation.duplicateRows} cls="text-amber-700" />
        </div>

        <div className="bg-white border border-ceramic-border rounded-sm overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-ceramic-cream/60 border-b border-ceramic-border">
              <tr className="text-left text-[10px] uppercase tracking-luxury text-ceramic-ash">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Errors / Note</th>
              </tr>
            </thead>
            <tbody>
              {validation.rows.slice(0, 50).map((r) => (
                <tr key={r._id || r.rowIndex} className="border-b border-ceramic-border last:border-0">
                  <td className="px-3 py-2 text-ceramic-ash">{r.rowIndex + 1}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate">{r.data?.companyName || '—'}</td>
                  <td className="px-3 py-2">{r.data?.country || '—'}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate">{r.data?.email || '—'}</td>
                  <td className="px-3 py-2"><RowStatus status={r.status} /></td>
                  <td className="px-3 py-2 text-ceramic-ash max-w-[260px] truncate">
                    {r.errors?.length ? r.errors.join('; ') : (r.duplicateLeadId ? 'Existing lead matched' : '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-ceramic-cream/40 border border-ceramic-border rounded-sm p-4 text-[12px] text-ceramic-graphite/80">
          <strong className="text-ceramic-gold-matte">Strategy:</strong>{' '}
          {duplicateStrategy === 'SKIP' ? 'Skip duplicates' : duplicateStrategy === 'UPDATE' ? 'Update existing leads' : 'Force create duplicates'}
          . Invalid rows will never be imported (§16).
        </div>

        <div className="flex justify-between">
          <button onClick={onBack} className="btn-gold-outline !px-6" disabled={busy}><ArrowLeft size={14} className="inline mr-1" /> Back</button>
          <button onClick={onCommit} className="btn-gold !px-6" disabled={busy}>{busy ? 'Importing…' : 'Import Leads'}</button>
        </div>
      </div>
    );
  }
  // Result view
  return (
    <div className="bg-white border border-ceramic-border rounded-sm p-8 text-center">
      <CheckCircle2 size={56} className="mx-auto text-emerald-600 mb-4" />
      <h3 className="serif-heading text-[24px] mb-2">Import Complete</h3>
      <p className="text-[13px] text-ceramic-ash mb-6">Each imported Lead is bound to <code>importId</code> + <code>campaignId</code> + <code>source</code> (§44).</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-3xl mx-auto mb-8">
        <StatTile label="Total" value={commitResult.total} cls="text-ceramic-graphite" />
        <StatTile label="Imported" value={commitResult.imported} cls="text-emerald-700" />
        <StatTile label="Updated" value={commitResult.updated} cls="text-blue-700" />
        <StatTile label="Skipped" value={commitResult.skipped} cls="text-amber-700" />
        <StatTile label="Failed" value={commitResult.failed} cls="text-red-700" />
      </div>
      <div className="flex justify-center gap-3">
        <button onClick={() => { onReset(); }} className="btn-gold-outline !px-6"><RefreshCw size={14} className="inline mr-1" /> New Import</button>
        <a href="/console/leads" className="btn-gold !px-6 inline-flex items-center gap-2"><ArrowRight size={14} /> Go to Leads</a>
      </div>
    </div>
  );
};

function StatTile({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-white border border-ceramic-border rounded-sm px-4 py-3">
      <div className="text-[10px] tracking-luxury uppercase text-ceramic-ash mb-1">{label}</div>
      <div className={`text-[22px] serif-heading leading-none ${cls}`}>{value}</div>
    </div>
  );
}
function RowStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    VALID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    INVALID: 'bg-red-50 text-red-700 border-red-200',
    DUPLICATE: 'bg-amber-50 text-amber-700 border-amber-200',
    IMPORTED: 'bg-blue-50 text-blue-700 border-blue-200',
    SKIPPED: 'bg-slate-50 text-slate-700 border-slate-200',
    UPDATED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${map[status] || ''}`}>{status}</span>;
}

export default LeadImportWizard;

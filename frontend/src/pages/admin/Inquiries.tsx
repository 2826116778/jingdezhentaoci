import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Mail, Download, Check, Eye, XCircle, Archive, Clock,
  EyeOff, Loader2, ChevronDown, ExternalLink, MessageCircle, Paperclip
} from 'lucide-react';
import { Admin } from '../../api';
import { useApp } from '../../context/AppContext';
import type { Inquiry, DashboardSummary } from '../../types';
import { pickBilingual } from '../../utils';

const STATUSES = ['all', 'new', 'read', 'replied', 'archived'];

const AdminInquiries: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { lang, showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Inquiry[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('new');
  const [source, setSource] = useState<string>('all');
  const [open, setOpen] = useState<Inquiry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sum, setSum] = useState<DashboardSummary | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        Admin.listInquiries({ status: status === 'all' ? undefined : status as any, source: source === 'all' ? undefined : source }),
        Admin.dashboard(),
      ]);
      setList(l || []);
      setSum(s);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status, source]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    list.forEach(x => x.source && s.add(x.source));
    return Array.from(s);
  }, [list]);

  const filtered = useMemo(() => {
    const fq = q.trim().toLowerCase();
    if (!fq) return list;
    return list.filter(x =>
      (x.name || '').toLowerCase().includes(fq) ||
      (x.email || '').toLowerCase().includes(fq) ||
      (x.company || '').toLowerCase().includes(fq) ||
      (x.subject || '').toLowerCase().includes(fq) ||
      String(x._id).toLowerCase().includes(fq),
    );
  }, [list, q]);

  const markStatus = async (id: string, s: Partial<Pick<Inquiry, 'status'>>) => {
    setBusy(id);
    try {
      const r = await Admin.updateInquiry(id, s as any);
      setList(list.map(x => x._id === id ? r : x));
      if (open?._id === id) setOpen(r);
      showToast({ type: 'success', text: t('admin.common.update_ok') });
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setBusy(null); }
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const blob = await Admin.exportInquiries();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast({ type: 'success', text: t('admin.inquiries.export_ok') });
    } catch (e: any) { showToast({ type: 'error', text: e.message || String(e) }); }
    finally { setExporting(false); }
  };

  const statusBadge = (s: string) => {
    const m: any = {
      new: ['bg-amber-500 text-white', t('admin.inquiries.status_new')],
      read: ['bg-sky-500 text-white',   t('admin.inquiries.status_read')],
      replied: ['bg-emerald-500 text-white', t('admin.inquiries.status_replied')],
      archived: ['bg-zinc-400 text-white', t('admin.inquiries.status_archived')],
    };
    const [cls, txt] = m[s] || ['bg-zinc-300 text-zinc-700', s];
    return <span className={`badge ${cls}`}>{txt}</span>;
  };

  const formatAt = (v: string | Date) => new Date(v).toLocaleString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="serif-heading text-[28px] mb-1">{t('admin.inquiries.title')}</h2>
          <p className="text-ceramic-ash text-sm flex items-center gap-2">
            <Mail size={14} /> {sum?.inquiriesUnread ? `${sum.inquiriesUnread} new · ` : ''}Total {list.length}
          </p>
        </div>
        <button className="btn-gold !py-2.5 !px-5 text-[13px]" onClick={exportCSV} disabled={exporting}>
          <Download size={14} /> {exporting ? '…' : t('admin.inquiries.export')}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="gold-card p-3 flex flex-wrap gap-1.5">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-5 py-2.5 text-[12px] tracking-luxury uppercase transition-colors
              ${status === s ? 'bg-ceramic-gold-matte text-white shadow-gold' : 'text-ceramic-ash hover:text-ceramic-graphite'}`}
          >
            {t(`admin.inquiries.status_${s}`)}
            {s === 'new' && sum?.inquiriesUnread ? <span className="ms-2 text-[10px] opacity-90">({sum.inquiriesUnread})</span> : null}
          </button>
        ))}
      </div>

      {/* Search / source */}
      <div className="gold-card p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-ceramic-ash" />
          <input className="input !ps-10" placeholder="Name / Email / Company / Subject..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={source} onChange={e => setSource(e.target.value)}>
          <option value="all">All sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="gold-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] tracking-luxury uppercase text-ceramic-ash bg-ceramic-offWhite/70">
                <th className="px-5 py-4 text-start w-[28px]"><input type="checkbox" disabled /></th>
                <th className="px-5 py-4 text-start">CLIENT</th>
                <th className="px-5 py-4 text-start">SUBJECT</th>
                <th className="px-5 py-4 text-start">SOURCE</th>
                <th className="px-5 py-4 text-start">STATUS</th>
                <th className="px-5 py-4 text-start">TIME</th>
                <th className="px-5 py-4 text-end">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-10 text-center text-ceramic-ash">{t('common.loading')}</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-ceramic-ash">{t('admin.common.no_data')}</td></tr>}
              {!loading && filtered.map(x => (
                <tr key={x._id}
                    className={`border-t border-ceramic-border/60 hover:bg-ceramic-offWhite/60 ${x.status === 'new' ? 'font-medium' : ''}`}>
                  <td className="px-5 py-4"><input type="checkbox" disabled /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-ceramic-gold-matte/10 text-ceramic-gold-matte flex items-center justify-center text-sm font-semibold">
                        {x.name?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] truncate">{x.name}</div>
                        <div className="text-[12px] text-ceramic-ash truncate max-w-[260px]">{x.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-[14px] truncate max-w-[300px]">{x.subject || t(`inquiry.source_${x.source}`)}</div>
                    {x.productName && <div className="text-[11px] text-ceramic-gold-matte mt-0.5">Ref: {x.productName}</div>}
                  </td>
                  <td className="px-5 py-4">
                    <span className="badge bg-ceramic-gold-light text-ceramic-gold-deep">{x.source || '—'}</span>
                  </td>
                  <td className="px-5 py-4">{statusBadge(x.status)}</td>
                  <td className="px-5 py-4 text-ceramic-ash text-[12px] whitespace-nowrap">{formatAt(x.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button className="btn-gold-outline !py-1.5 !px-3 text-[12px]" onClick={() => setOpen(x)}>
                        <Eye size={12} /> {t('admin.common.view')}
                      </button>
                      {x.status === 'new' && (
                        <button className="btn-gold-outline !py-1.5 !px-3 text-[12px]" onClick={() => markStatus(x._id, { status: 'read' })} disabled={busy === x._id}>
                          {busy === x._id ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />}
                          {t('admin.inquiries.btn_read')}
                        </button>
                      )}
                      {x.status !== 'replied' && (
                        <button className="btn-gold-outline !py-1.5 !px-3 !border-emerald-200 !text-emerald-700 hover:!bg-emerald-50" onClick={() => markStatus(x._id, { status: 'replied' })} disabled={busy === x._id}>
                          {busy === x._id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          {t('admin.inquiries.btn_replied')}
                        </button>
                      )}
                      {x.status !== 'archived' && (
                        <button className="btn-gold-outline !py-1.5 !px-3 text-[12px]" onClick={() => markStatus(x._id, { status: 'archived' })} disabled={busy === x._id}>
                          {busy === x._id ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                          {t('admin.inquiries.btn_archive')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm p-4 md:p-8 flex items-start md:items-center justify-center overflow-y-auto animate-fade-in" onClick={() => setOpen(null)}>
          <div className="bg-ceramic-cream w-full max-w-3xl my-auto gold-card overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-ceramic-border sticky top-0 bg-white/90 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ceramic-gold-matte/10 text-ceramic-gold-matte flex items-center justify-center">
                  {open.name?.[0] || '?'}
                </div>
                <div>
                  <h3 className="serif-heading text-[20px] leading-tight">{open.name}</h3>
                  <div className="text-[12px] text-ceramic-ash">{open.email} · {open.phone}</div>
                </div>
                {statusBadge(open.status)}
              </div>
              <button className="p-2" onClick={() => setOpen(null)}><XCircle size={20} /></button>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div><div className="label mb-1">{t('inquiry.c_company')}</div><div>{open.company || '—'}</div></div>
                <div><div className="label mb-1">{t('inquiry.c_country')}</div><div>{open.country || '—'}</div></div>
                <div><div className="label mb-1">{t('inquiry.c_source')}</div>
                  <div><span className="badge bg-ceramic-gold-light text-ceramic-gold-deep">{open.source}</span></div>
                </div>
                <div><div className="label mb-1">{t('inquiry.c_product')}</div>
                  <div className="truncate">{open.productName || '—'}
                    {open.productId && <span className="text-ceramic-ash ms-2 text-[11px]">({open.productId.slice(-6)})</span>}
                  </div>
                </div>
                <div className="col-span-2"><div className="label mb-1">{t('inquiry.c_subject')}</div>
                  <div className="serif-heading text-[18px]">{open.subject || t(`inquiry.source_${open.source}`)}</div>
                </div>
              </div>
              {(open.quantity || open.budget || open.targetDate) && (
                <div className="grid grid-cols-3 gap-4 bg-ceramic-offWhite p-4 rounded-sm text-[12px]">
                  <div><div className="label mb-1">{t('inquiry.c_qty')}</div><div>{open.quantity || '—'}</div></div>
                  <div><div className="label mb-1">{t('inquiry.c_budget')}</div><div>{open.budget ? `$${open.budget}` : '—'}</div></div>
                  <div><div className="label mb-1">{t('inquiry.c_date')}</div><div>{open.targetDate || '—'}</div></div>
                </div>
              )}
              {open.attachmentUrls?.length ? (
                <div>
                  <div className="label mb-2 flex items-center gap-1.5"><Paperclip size={12} /> Attachments</div>
                  <div className="flex flex-wrap gap-2">
                    {open.attachmentUrls.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="btn-gold-outline !py-2 text-[12px]">
                        {src.includes('drive') || src.includes('http') ? <ExternalLink size={12} /> : <Paperclip size={12} />}
                        File {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="label mb-2">{t('inquiry.c_message')}</div>
                <div className="gold-card !bg-ceramic-offWhite p-5 text-[14px] leading-[2] whitespace-pre-wrap text-ceramic-graphite">
                  {open.message || '—'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 md:px-8 py-5 border-t border-ceramic-border bg-ceramic-offWhite/60">
              <div className="flex items-center gap-2 text-[12px] text-ceramic-ash">
                <Clock size={14} /> {formatAt(open.createdAt)}
                {open.createdAt !== open.updatedAt && <span className="ms-2">(updated {formatAt(open.updatedAt)})</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <a
                  href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject || 'Inquiry'}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold-outline !py-2 text-[12px]"
                >
                  <Mail size={12} /> {t('admin.inquiries.btn_reply_email')}
                </a>
                {open.whatsapp && (
                  <a
                    href={`https://wa.me/${open.whatsapp.replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gold-outline !border-emerald-300 !text-emerald-700 !py-2 text-[12px]"
                  >
                    <MessageCircle size={12} /> {t('admin.inquiries.btn_reply_wa')}
                  </a>
                )}
                {open.status !== 'replied' && (
                  <button className="btn-gold !py-2 text-[12px]" onClick={() => markStatus(open._id, { status: 'replied' })} disabled={busy === open._id}>
                    {busy === open._id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    {t('admin.inquiries.btn_replied')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInquiries;

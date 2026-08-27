/**
 * PHASE 2-B 海外客户开发中心 — Lead Detail
 *
 * 路由: /console/leads/:id
 *
 * 规范 §26-28 / §32-33：
 *   - 公司 / 联系人 / 官网 / 多社交 (LinkedIn / Instagram / Facebook / X / TikTok)
 *   - Lead Score / Grade A-D / Reasons / Qualification（先规则评分，未来接 AI）
 *   - Source / Product Interest / Development (Interactions)
 *   - FollowUps / Timeline
 *   - Research：明确区分 MANUAL_RESEARCH / IMPORTED_DATA / AI_RESEARCH（§28）
 *   - "Contact Lead"：选 Email / WhatsApp / Phone / LinkedIn / Instagram / Other → 创建 Interaction + 更新 lastContactAt (§32)
 *   - 禁止自动群发（§33）：仅生成开发内容入口，业务员确认后再发
 *   - Convert Lead to Customer
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Globe2, Mail, Phone, MessageCircle, Linkedin, Instagram,
  Facebook, Twitter, Music2, Star, X, RefreshCw, Sparkles, ArrowRightLeft,
  Calendar, ClipboardList, History, Building2, User2, Eye,
} from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleLead, ConsoleFollowUp, ConsoleInteraction } from '../../../types';
import {
  TARGET_INDUSTRIES, TARGET_COMPANY_TYPES, PRODUCT_INTERESTS, LEAD_SOURCES,
} from '../../../utils/leadConfig';

const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useApp();
  const nav = useNavigate();

  const [lead, setLead] = useState<ConsoleLead | null>(null);
  const [followups, setFollowups] = useState<ConsoleFollowUp[]>([]);
  const [interactions, setInteractions] = useState<ConsoleInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const l = await Console.leadDetail(id);
      if (!l) { showToast({ type: 'error', text: 'Lead not found' }); nav('/console/leads'); return; }
      setLead(l);
      // Parallel fetch: followups + interactions
      try {
        const [fu, it] = await Promise.all([
          Console.listFollowUps({ leadId: id, pageSize: 100 } as any),
          Console.listInteractions({ leadId: id, pageSize: 100 } as any),
        ]);
        setFollowups(fu?.items || []);
        setInteractions(it?.items || []);
      } catch { /* ignore sub-fetch errors */ }
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Failed to load lead' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, [id]);

  if (loading) {
    return <div className="px-8 py-12 text-center text-ceramic-ash text-[13px]">Loading lead…</div>;
  }
  if (!lead) return null;

  const researchLabel: Record<string, string> = {
    MANUAL_RESEARCH: 'Manual Research',
    IMPORTED_DATA: 'Imported Data',
    AI_RESEARCH: 'AI Research',
  };
  const researchCls: Record<string, string> = {
    MANUAL_RESEARCH: 'bg-blue-50 text-blue-700 border-blue-200',
    IMPORTED_DATA: 'bg-slate-50 text-slate-700 border-slate-200',
    AI_RESEARCH: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto" data-testid="lead-detail">
      {/* ===== Back + Title ===== */}
      <div className="flex items-center gap-3 mb-4">
        <Link to="/console/leads" className="inline-flex items-center gap-1 text-[12px] text-ceramic-ash hover:text-ceramic-gold-matte">
          <ArrowLeft size={14} /> Back to Leads
        </Link>
      </div>

      <header className="bg-white border border-ceramic-border rounded-sm p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="serif-heading text-[28px] leading-tight">{lead.companyName}</h1>
            <p className="text-[13px] text-ceramic-ash mt-1">
              {[lead.country, lead.city, lead.industry, lead.companyType].filter(Boolean).join(' · ') || 'No location info'}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="px-2 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[11px]">{lead.status}</span>
              <span className="px-2 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[11px] capitalize">{lead.source || 'unknown source'}</span>
              {lead.researchType && (
                <span className={`px-2 py-0.5 rounded-full border text-[11px] ${researchCls[lead.researchType] || ''}`}>{researchLabel[lead.researchType]}</span>
              )}
              {lead.campaignId && <span className="text-[11px] text-ceramic-ash">campaign: {String(lead.campaignId).slice(-6)}</span>}
              {lead.importId && <span className="text-[11px] text-ceramic-ash">import: {String(lead.importId).slice(-6)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditMode((v) => !v)} className="btn-gold-outline !px-4 !py-2 text-[12px]"><Eye size={13} className="inline mr-1" /> {editMode ? 'Cancel Edit' : 'Edit'}</button>
            <button onClick={async () => {
              try {
                const r = await Console.Development.scoreLead(id!);
                showToast({ type: 'success', text: `Scored ${r.score} · ${r.grade}` });
                load();
              } catch (e: any) { showToast({ type: 'error', text: e?.message || 'Score failed' }); }
            }} className="btn-gold-outline !px-4 !py-2 text-[12px]"><Sparkles size={13} className="inline mr-1" /> Re-score</button>
            <button onClick={() => setShowContactModal(true)} className="btn-gold-outline !px-4 !py-2 text-[12px]"><MessageCircle size={13} className="inline mr-1" /> Contact Lead</button>
            <Link to={`/console/leads/${id}/research`} className="btn-gold !px-4 !py-2 text-[12px] inline-flex items-center"><Sparkles size={13} className="inline mr-1" /> AI Research</Link>
            {lead.status !== 'CONVERTED' && (
              <button onClick={() => setShowConvert(true)} className="btn-gold !px-4 !py-2 text-[12px]"><ArrowRightLeft size={13} className="inline mr-1" /> Convert to Customer</button>
            )}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ===== Left main column ===== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company / Contact / Website / Social */}
          <Section Icon={Building2} title="Company">
            <Field label="Company Name" value={lead.companyName} edit={editMode} onChange={(v) => setLead({ ...lead, companyName: v })} />
            <Field label="Website" value={lead.website} edit={editMode} link onChange={(v) => setLead({ ...lead, website: v })} />
            <Field label="Country" value={lead.country} edit={editMode} onChange={(v) => setLead({ ...lead, country: v })} />
            <Field label="City" value={lead.city} edit={editMode} onChange={(v) => setLead({ ...lead, city: v })} />
            <SelectField label="Industry" value={lead.industry} edit={editMode} options={[...TARGET_INDUSTRIES]} onChange={(v) => setLead({ ...lead, industry: v })} />
            <SelectField label="Company Type" value={lead.companyType} edit={editMode} options={[...TARGET_COMPANY_TYPES]} onChange={(v) => setLead({ ...lead, companyType: v })} />
          </Section>

          <Section Icon={User2} title="Contact">
            <Field label="Contact Name" value={lead.contactName} edit={editMode} onChange={(v) => setLead({ ...lead, contactName: v })} />
            <Field label="Job Title" value={lead.jobTitle} edit={editMode} onChange={(v) => setLead({ ...lead, jobTitle: v })} />
            <Field label="Email" value={lead.email} edit={editMode} link mailto onChange={(v) => setLead({ ...lead, email: v })} />
            <Field label="Phone" value={lead.phone} edit={editMode} link tel onChange={(v) => setLead({ ...lead, phone: v })} />
            <Field label="WhatsApp" value={lead.whatsapp} edit={editMode} link wa onChange={(v) => setLead({ ...lead, whatsapp: v })} />
          </Section>

          <Section Icon={Globe2} title="Website & Social">
            <Field label="Website" value={lead.website} edit={editMode} link onChange={(v) => setLead({ ...lead, website: v })} />
            <SocialField Icon={Linkedin} label="LinkedIn" value={lead.linkedin} edit={editMode} onChange={(v) => setLead({ ...lead, linkedin: v })} />
            <SocialField Icon={Instagram} label="Instagram" value={lead.instagram} edit={editMode} onChange={(v) => setLead({ ...lead, instagram: v })} />
            <SocialField Icon={Facebook} label="Facebook" value={lead.facebook} edit={editMode} onChange={(v) => setLead({ ...lead, facebook: v })} />
            <SocialField Icon={Twitter} label="X / Twitter" value={lead.xHandle} edit={editMode} onChange={(v) => setLead({ ...lead, xHandle: v })} />
            <SocialField Icon={Music2} label="TikTok" value={lead.tiktok} edit={editMode} onChange={(v) => setLead({ ...lead, tiktok: v })} />
          </Section>

          {/* Research (§27, §28) */}
          <Section Icon={ClipboardList} title="Research (§27-28)">
            <Field label="Research Type" value={lead.researchType ? researchLabel[lead.researchType] : '—'} edit={false} />
            <Field label="Company Overview / Potential Needs" value={lead.researchNotes || lead.notes || ''} edit={editMode} textarea onChange={(v) => setLead({ ...lead, researchNotes: v, notes: v })} />
            <div className="text-[11px] text-ceramic-ash mt-2">
              Per §28: do not auto-research the internet. Clearly mark MANUAL_RESEARCH / IMPORTED_DATA / future AI_RESEARCH.
            </div>
          </Section>

          {/* Timeline */}
          <Section Icon={History} title="Timeline">
            {interactions.length === 0 ? (
              <div className="text-[12px] text-ceramic-ash py-4">No interactions yet. Click "Contact Lead" to record the first one.</div>
            ) : (
              <ol className="relative border-s-2 border-ceramic-border ps-4 space-y-3">
                {interactions.map((it) => (
                  <li key={String(it._id)} className="relative">
                    <span className="absolute -start-[5px] top-1 w-2 h-2 rounded-full bg-ceramic-gold-matte" />
                    <div className="flex items-center gap-2 text-[11px] text-ceramic-ash">
                      <span className="font-mono uppercase">{it.type}</span>
                      · {it.occurredAt ? new Date(it.occurredAt).toLocaleString() : ''}
                    </div>
                    <div className="text-[13px] text-ceramic-graphite font-medium mt-0.5">{it.title}</div>
                    {it.content && <div className="text-[12px] text-ceramic-ash mt-0.5">{it.content}</div>}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        {/* ===== Right column ===== */}
        <div className="lg:col-span-1 space-y-6">
          {/* Score / Grade / Reasons */}
          <Section Icon={Star} title="Lead Score (§19-21)">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-[42px] serif-heading leading-none text-ceramic-gold-matte">{lead.score ?? 0}</div>
              <div>
                <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash">Grade</div>
                <div className={`text-[26px] serif-heading leading-none ${gradeColor(lead.grade)}`}>{lead.grade}</div>
              </div>
            </div>
            <div className="text-[11px] tracking-luxury uppercase text-ceramic-ash mb-1">Reasons (§21)</div>
            {(lead.scoreReasons || []).length === 0 ? (
              <div className="text-[12px] text-ceramic-ash">No reasons yet. Click "Re-score" to compute.</div>
            ) : (
              <ul className="space-y-1">
                {lead.scoreReasons!.map((r, i) => (
                  <li key={i} className="text-[12px] text-ceramic-graphite/80 flex items-start gap-2">
                    <span className="text-emerald-700 font-mono">+</span>{r}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Source & Product Interest */}
          <Section Icon={Sparkles} title="Source & Products">
            <SelectField label="Source" value={lead.source} edit={editMode} options={[...LEAD_SOURCES]} onChange={(v) => setLead({ ...lead, source: v })} />
            <Field label="Source URL" value={lead.sourceUrl} edit={editMode} link onChange={(v) => setLead({ ...lead, sourceUrl: v })} />
            <div>
              <div className="text-[11px] text-ceramic-ash mb-1">Product Interest</div>
              <div className="flex flex-wrap gap-1.5">
                {(lead.productInterest || []).length === 0 && <span className="text-[12px] text-ceramic-ash">—</span>}
                {(lead.productInterest || []).map((p) => (
                  <span key={p} className="px-2 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border text-[11px]">{p}</span>
                ))}
              </div>
              {editMode && (
                <div className="mt-2">
                  <ProductPicker value={lead.productInterest || []} onChange={(arr) => setLead({ ...lead, productInterest: arr })} />
                </div>
              )}
            </div>
          </Section>

          {/* Follow-ups */}
          <Section Icon={Calendar} title="Follow-ups">
            {followups.length === 0 ? (
              <div className="text-[12px] text-ceramic-ash py-3">No scheduled follow-ups.</div>
            ) : (
              <ul className="space-y-2">
                {followups.map((f) => (
                  <li key={String(f._id)} className="border border-ceramic-border rounded-[2px] p-2.5">
                    <div className="flex items-center justify-between text-[11px] text-ceramic-ash">
                      <span className="uppercase">{f.type}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-ceramic-cream border border-ceramic-border">{f.status}</span>
                    </div>
                    {f.content && <div className="text-[12px] text-ceramic-graphite mt-1 line-clamp-2">{f.content}</div>}
                    <div className="text-[11px] text-ceramic-ash mt-1">{f.scheduledAt ? new Date(f.scheduledAt).toLocaleString() : ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {/* Edit save bar */}
      {editMode && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-ceramic-border z-30 px-6 py-3 flex justify-end gap-3">
          <button onClick={() => { setEditMode(false); load(); }} className="btn-gold-outline !px-6">Cancel</button>
          <button onClick={async () => {
            try {
              await Console.updateLead(id!, lead);
              showToast({ type: 'success', text: 'Lead updated' });
              setEditMode(false);
              load();
            } catch (e: any) { showToast({ type: 'error', text: e?.message || 'Update failed' }); }
          }} className="btn-gold !px-6">Save</button>
        </div>
      )}

      {showContactModal && (
        <ContactLeadModal
          lead={lead}
          onClose={() => setShowContactModal(false)}
          onSaved={() => {
            setShowContactModal(false);
            showToast({ type: 'success', text: 'Interaction logged' });
            load();
          }}
        />
      )}

      {showConvert && (
        <ConvertModal lead={lead} onClose={() => setShowConvert(false)} onDone={() => { setShowConvert(false); nav('/console/customers'); }} />
      )}
    </div>
  );
};

function gradeColor(grade?: string) {
  if (grade === 'A') return 'text-amber-600';
  if (grade === 'B') return 'text-cyan-700';
  if (grade === 'C') return 'text-slate-600';
  return 'text-slate-400';
}

// ====== Section ======
function Section({ Icon, title, children }: { Icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-ceramic-border rounded-sm p-5">
      <h3 className="flex items-center gap-2 text-[12px] tracking-luxury uppercase text-ceramic-gold-matte font-semibold mb-4">
        <Icon size={14} /> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// ====== Field (read / edit) ======
function Field({ label, value, edit, link, mailto, tel, wa, textarea, onChange }: {
  label: string; value: string; edit: boolean; link?: boolean; mailto?: boolean; tel?: boolean; wa?: boolean; textarea?: boolean;
  onChange?: (v: string) => void;
}) {
  if (edit && !textarea) {
    return (
      <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
        <span>{label}</span>
        <input className="input-gold text-[13px]" value={value || ''} onChange={(e) => onChange?.(e.target.value)} />
      </label>
    );
  }
  if (edit && textarea) {
    return (
      <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
        <span>{label}</span>
        <textarea className="input-gold text-[13px]" rows={3} value={value || ''} onChange={(e) => onChange?.(e.target.value)} />
      </label>
    );
  }
  let display: React.ReactNode = value || '—';
  if (value && link) display = <a href={value} target="_blank" rel="noreferrer" className="text-ceramic-gold-matte hover:underline break-all">{value}</a>;
  else if (value && mailto) display = <a href={`mailto:${value}`} className="text-ceramic-gold-matte hover:underline break-all">{value}</a>;
  else if (value && tel) display = <a href={`tel:${value}`} className="text-ceramic-gold-matte hover:underline break-all">{value}</a>;
  else if (value && wa) display = <a href={`https://wa.me/${value.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-ceramic-gold-matte hover:underline break-all">{value}</a>;
  return (
    <div className="grid grid-cols-3 gap-3 text-[12px]">
      <div className="text-ceramic-ash">{label}</div>
      <div className="col-span-2 text-ceramic-graphite break-words">{display}</div>
    </div>
  );
}

function SelectField({ label, value, edit, options, onChange }: {
  label: string; value: string; edit: boolean; options: string[]; onChange: (v: string) => void;
}) {
  if (edit) {
    return (
      <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
        <span>{label}</span>
        <select className="input-gold text-[13px]" value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3 text-[12px]">
      <div className="text-ceramic-ash">{label}</div>
      <div className="col-span-2 text-ceramic-graphite capitalize">{value || '—'}</div>
    </div>
  );
}

function SocialField({ Icon, label, value, edit, onChange }: {
  Icon: React.ElementType; label: string; value?: string; edit: boolean; onChange: (v: string) => void;
}) {
  if (edit) {
    return (
      <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
        <span>{label}</span>
        <input className="input-gold text-[13px]" placeholder="https://..." value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3 text-[12px] items-center">
      <div className="flex items-center gap-1.5 text-ceramic-ash"><Icon size={13} /> {label}</div>
      <div className="col-span-2 text-ceramic-graphite break-words">
        {value ? <a href={value} target="_blank" rel="noreferrer" className="text-ceramic-gold-matte hover:underline break-all">{value}</a> : '—'}
      </div>
    </div>
  );
}

function ProductPicker({ value, onChange }: { value: string[]; onChange: (arr: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PRODUCT_INTERESTS.map((p) => {
        const on = value.includes(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== p) : [...value, p])}
            className={`px-2 py-0.5 rounded-full border text-[11px] transition-all ${
              on ? 'bg-ceramic-gold-matte text-white border-ceramic-gold-matte' : 'bg-white text-ceramic-graphite/80 border-ceramic-border'
            }`}
          >{p}</button>
        );
      })}
    </div>
  );
}

// ====== Contact Lead Modal (§32) ======
const ContactLeadModal: React.FC<{ lead: ConsoleLead; onClose: () => void; onSaved: () => void }> = ({ lead, onClose, onSaved }) => {
  const { showToast } = useApp();
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP' | 'PHONE' | 'LINKEDIN' | 'INSTAGRAM' | 'OTHER'>('EMAIL');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const channels: { key: typeof channel; label: string; Icon: React.ElementType; entry?: string }[] = [
    { key: 'EMAIL', label: 'Email', Icon: Mail, entry: lead.email ? `mailto:${lead.email}` : undefined },
    { key: 'WHATSAPP', label: 'WhatsApp', Icon: MessageCircle, entry: lead.whatsapp ? `https://wa.me/${lead.whatsapp.replace(/\D/g, '')}` : undefined },
    { key: 'PHONE', label: 'Phone', Icon: Phone, entry: lead.phone ? `tel:${lead.phone}` : undefined },
    { key: 'LINKEDIN', label: 'LinkedIn', Icon: Linkedin, entry: lead.linkedin },
    { key: 'INSTAGRAM', label: 'Instagram', Icon: Instagram, entry: lead.instagram },
    { key: 'OTHER', label: 'Other', Icon: Globe2 },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return showToast({ type: 'error', text: 'Title is required' });
    setSaving(true);
    try {
      // 通过 PHASE 2-A 的 FollowUps 接口记录开发动作 —— 后端会同时写入 Interaction
      // (leadId + type + content + scheduledAt)。这同时触发 lastContactAt 更新。
      const channelToFollowUpType: Record<typeof channel, 'EMAIL' | 'WHATSAPP' | 'PHONE' | 'MEETING' | 'SOCIAL' | 'OTHER'> = {
        EMAIL: 'EMAIL',
        WHATSAPP: 'WHATSAPP',
        PHONE: 'PHONE',
        LINKEDIN: 'SOCIAL',
        INSTAGRAM: 'SOCIAL',
        OTHER: 'OTHER',
      };
      await Console.createFollowUp({
        leadId: String(lead._id || lead.id),
        type: channelToFollowUpType[channel],
        content: title + (content ? `\n\n${content}` : ''),
        result: content || '',
        nextAction: '',
        scheduledAt: new Date().toISOString(),
        status: 'COMPLETED',
      } as any);
      // 同时更新 Lead status / lastContactAt
      try {
        await Console.updateLead(String(lead._id || lead.id), {
          status: lead.status === 'NEW' || lead.status === 'RESEARCHING' || lead.status === 'QUALIFIED' ? 'CONTACTED' : lead.status,
        } as any);
      } catch { /* ignore */ }
      onSaved();
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Save failed' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-2xl shadow-xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <div>
            <h3 className="serif-heading text-[20px]">Contact Lead</h3>
            <p className="text-[12px] text-ceramic-ash">Record this contact as an Interaction + auto-update lastContactAt. §33 No auto-mass-send.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <div className="text-[12px] text-ceramic-ash mb-2">Channel</div>
            <div className="flex flex-wrap gap-2">
              {channels.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChannel(c.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] border text-[12px] ${
                    channel === c.key ? 'bg-ceramic-gold-matte text-white border-ceramic-gold-matte'
                    : 'bg-white text-ceramic-graphite/80 border-ceramic-border hover:border-ceramic-gold-matte/50'
                  }`}
                >
                  <c.Icon size={13} /> {c.label}
                </button>
              ))}
            </div>
            {channels.find((c) => c.key === channel)?.entry && (
              <a href={channels.find((c) => c.key === channel)!.entry} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 mt-2 text-[12px] text-ceramic-gold-matte hover:underline">
                Open {channel.toLowerCase()} entry →
              </a>
            )}
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Title *</span>
            <input className="input-gold text-[13px]" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. First contact email sent" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash">
            <span>Content / Outcome</span>
            <textarea className="input-gold text-[13px]" rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="What did you send / discuss? Any reply expected?" />
          </label>
          <div className="bg-ceramic-cream/40 border border-ceramic-border rounded-sm p-3 text-[11px] text-ceramic-ash">
            §33 — This action does NOT auto-send messages. It only records the contact attempt.
            Use the "Open entry" link to manually reach out, then confirm the outcome here.
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-ceramic-border">
            <button type="button" onClick={onClose} className="btn-gold-outline !px-6" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-gold !px-6" disabled={saving}>{saving ? 'Saving…' : 'Log Interaction'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ====== Convert Modal (uses existing PHASE 2-A convert endpoint) ======
const ConvertModal: React.FC<{ lead: ConsoleLead; onClose: () => void; onDone: () => void }> = ({ lead, onClose, onDone }) => {
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const doConvert = async () => {
    setBusy(true);
    try {
      await Console.convertLead(String(lead._id || lead.id), {});
      showToast({ type: 'success', text: 'Converted to Customer' });
      onDone();
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Convert failed' });
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-md shadow-xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <h3 className="serif-heading text-[20px]">Convert to Customer</h3>
          <button onClick={onClose} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-ceramic-ash">
            Converting <strong>{lead.companyName}</strong> will:
          </p>
          <ul className="text-[12px] text-ceramic-graphite/80 list-disc ps-5 space-y-1">
            <li>Create / link Company + Contact records</li>
            <li>Create a Customer (default PROSPECT level)</li>
            <li>Mark this Lead as <code>CONVERTED</code> with <code>customerId</code></li>
            <li>Log a <code>LEAD_CONVERTED</code> interaction</li>
          </ul>
          <div className="flex justify-end gap-3 pt-3 border-t border-ceramic-border">
            <button onClick={onClose} className="btn-gold-outline !px-6" disabled={busy}>Cancel</button>
            <button onClick={doConvert} className="btn-gold !px-6" disabled={busy}>{busy ? 'Converting…' : 'Convert'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;

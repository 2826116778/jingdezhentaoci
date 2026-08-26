/**
 * PHASE 2-A: Lead -> Customer 转换 Modal
 */
import React, { useState } from 'react';
import { X, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { Console } from '../../../api/console';
import { useApp } from '../../../context/AppContext';
import type { ConsoleLead, ConsoleCustomer, ConsoleCompany, ConsoleContact } from '../../../types';

interface Props {
  open: boolean;
  lead: ConsoleLead | null;
  onClose: () => void;
  onDone: () => void;
}

const CustomerConvertModal: React.FC<Props> = ({ open, lead, onClose, onDone }) => {
  const { showToast } = useApp();
  const [level, setLevel] = useState<'PLATINUM'|'GOLD'|'SILVER'|'BRONZE'|'PROSPECT'>('PROSPECT');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ customer: ConsoleCustomer; company: ConsoleCompany; contact: ConsoleContact } | null>(null);

  if (!open || !lead) return null;

  const convert = async () => {
    setLoading(true);
    try {
      const r = await Console.convertLead(String(lead._id || lead.id), { customerLevel: level });
      setResult({ customer: r.customer, company: r.company, contact: r.contact });
      showToast({ type: 'success', text: 'Lead converted to Customer successfully' });
    } catch (e: any) {
      showToast({ type: 'error', text: e?.message || 'Convert failed' });
    } finally { setLoading(false); }
  };

  const close = () => {
    if (!loading) {
      setResult(null);
      onClose();
      if (result) onDone();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-sm border border-ceramic-border w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-ceramic-border">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-emerald-600" />
            <h3 className="serif-heading text-[20px]">Convert Lead to Customer</h3>
          </div>
          <button onClick={close} className="p-1.5 text-ceramic-ash hover:text-ceramic-graphite" disabled={loading}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {!result ? (
            <div>
              <div className="bg-ceramic-cream/50 border border-ceramic-border rounded p-4 space-y-1 text-[13px] mb-4">
                <div><strong>Company:</strong> {lead.companyName}</div>
                <div><strong>Country:</strong> {lead.country || '---'} &middot; <strong>Industry:</strong> {lead.industry || '---'}</div>
                <div><strong>Contact:</strong> {lead.contactName || '---'} {lead.jobTitle ? `(${lead.jobTitle})` : ''}</div>
                <div><strong>Email:</strong> {lead.email || '---'}</div>
                <div><strong>WhatsApp:</strong> {lead.whatsapp || '---'}</div>
              </div>
              <label className="flex flex-col gap-1 text-[12px] text-ceramic-ash mb-4">
                <span>Initial Customer Level</span>
                <select className="input-gold text-[13px]" value={level} onChange={(e) => setLevel(e.target.value as any)}>
                  <option value="PROSPECT">PROSPECT</option>
                  <option value="BRONZE">BRONZE</option>
                  <option value="SILVER">SILVER</option>
                  <option value="GOLD">GOLD</option>
                  <option value="PLATINUM">PLATINUM</option>
                </select>
              </label>
              <div className="text-[11px] text-ceramic-ash bg-amber-50 border border-amber-200 p-3 rounded mb-4">
                This action will create: <strong>Company</strong>, <strong>Primary Contact</strong>, <strong>Customer record</strong>,
                and set Lead status to <strong>CONVERTED</strong> with Timeline event <strong>LEAD_CONVERTED</strong>.
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={close} className="btn-gold-outline !px-6" disabled={loading}>Cancel</button>
                <button onClick={convert} className="btn-gold !px-6 !bg-emerald-700 !border-emerald-700 hover:!bg-emerald-800" disabled={loading}>
                  {loading ? 'Converting...' : 'Confirm Convert'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={22} />
                <span className="serif-heading text-[18px]">Convert successful!</span>
              </div>
              <div className="space-y-2 text-[13px] border border-ceramic-border rounded p-4">
                <div>Customer Code: <strong>{result.customer.customerCode}</strong></div>
                <div>Company: <strong>{result.company.name || lead.companyName}</strong></div>
                <div>Contact: <strong>{result.contact.name || lead.contactName || '---'}</strong></div>
                <div>Lead Status: <strong>CONVERTED</strong></div>
              </div>
              <div className="flex justify-end">
                <button onClick={close} className="btn-gold !px-6">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerConvertModal;

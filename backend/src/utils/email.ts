/**
 * 邮件发送器：
 * - demo 模式：直接把 .eml 文件写到 logs/inquiry-emails/ 和 logs/paid-notifications/ （不真实发送）
 * - smtp 模式：使用 nodemailer + 配置的 SMTP 真实发送
 * PROD: 只需把 EMAIL_MODE=smtp 并填入 SMTP_* env 即可
 */
import path from 'path';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { writeDemoEmail } from './logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (env.EMAIL_MODE === 'smtp') {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export type EmailPayload = {
  to: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: { filename: string; content: string | Buffer; contentType?: string }[];
};

function makeEml(p: EmailPayload): string {
  const eml = [
    `Date: ${new Date().toUTCString()}`,
    `From: ${env.EMAIL_FROM}`,
    `To: ${p.to.join(', ')}`,
    `Subject: ${p.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="boundary-luxe"`,
    '',
    '--boundary-luxe',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    p.textBody || p.htmlBody.replace(/<[^>]+>/g, ''),
    '',
    '--boundary-luxe',
    'Content-Type: text/html; charset=UTF-8',
    '',
    p.htmlBody,
    '',
    '--boundary-luxe--',
  ].join('\r\n');
  return eml;
}

export async function sendEmail(payload: EmailPayload, subfolder = 'inquiry-emails') {
  const recipients = payload.to.length ? payload.to : env.EMAIL_NOTIFY_TO.split(',').map(s => s.trim()).filter(Boolean);
  const toSend = { ...payload, to: recipients };

  // 无论哪种模式，都把文件写到 logs 便于排查
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.eml`;
  writeDemoEmail(subfolder, filename, makeEml(toSend));

  if (env.EMAIL_MODE === 'smtp') {
    const t = getTransporter();
    if (!t) {
      console.warn('[Email] smtp mode but transporter unavailable. Saved as demo file.');
      return false;
    }
    try {
      await t.sendMail({
        from: env.EMAIL_FROM,
        to: recipients,
        subject: payload.subject,
        html: payload.htmlBody,
        text: payload.textBody,
        attachments: payload.attachments as any,
      });
      console.log(`[Email] SMTP sent ✅ → ${recipients.join(', ')}`);
      return true;
    } catch (e) {
      console.error('[Email] SMTP send ❌', e);
      return false;
    }
  }

  // demo 模式：控制台模拟打印
  console.log(`\n📧 [Email|DEMO] 邮件未真实发送，已保存到 logs/${subfolder}/${filename}`);
  console.log(`   → 收件人: ${recipients.join(', ')}`);
  console.log(`   → 主题  : ${payload.subject}\n`);
  return true;
}

/**
 * 发送询盘通知（给内部运营）
 */
export async function notifyNewInquiry(data: {
  id: string; name: string; email: string; whatsapp: string; country?: string;
  company?: string; quantity?: number; customDemand?: string; productName?: string; source?: string;
}) {
  const rows: string[] = [];
  const add = (k: string, v?: any) => { if (v !== undefined && v !== null && String(v).length) rows.push(`<tr><td style="padding:6px 12px;border-bottom:1px solid #EDE7DC"><b>${k}</b></td><td style="padding:6px 12px;border-bottom:1px solid #EDE7DC">${String(v).replace(/\n/g, '<br/>')}</td></tr>`); };
  add('Inquiry ID', data.id);
  add('Source', data.source);
  add('Name', data.name);
  add('Email', data.email);
  add('WhatsApp', data.whatsapp);
  add('Country', data.country);
  add('Company', data.company);
  add('Quantity', data.quantity);
  add('Product', data.productName);
  add('Custom Requirements', data.customDemand || '—');

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;">
    <h2 style="color:#8A6E4F;border-bottom:2px solid #E8D5B7;padding-bottom:8px;">🛎 New Inquiry Received — LuxeCeramics</h2>
    <table style="width:100%;border-collapse:collapse;">${rows.join('')}</table>
    <p style="margin-top:18px;color:#8A857C;font-size:13px;">请在 24 小时内通过 WhatsApp 回复客户。</p>
  </div>`;
  return sendEmail({
    to: env.EMAIL_NOTIFY_TO.split(',').map(s => s.trim()).filter(Boolean),
    subject: `[LuxeCeramics Inquiry] #${data.id.slice(-6)} — ${data.name}`,
    htmlBody: html,
  }, 'inquiry-emails');
}

/**
 * 订单到账通知（给内部运营）
 */
export async function notifyOrderPaid(order: {
  orderNo: string; totalAmount: number; usdtAmount: number; txHash?: string;
  contactInfo: { name: string; email: string; whatsapp?: string; shippingAddress?: string };
}) {
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;">
    <h2 style="color:#8A6E4F;border-bottom:2px solid #E8D5B7;padding-bottom:8px;">💰 Order Paid — ${order.orderNo}</h2>
    <p><b>USD Total:</b> $${order.totalAmount.toFixed(2)} &nbsp;&nbsp; <b>USDT Paid:</b> ${order.usdtAmount.toFixed(6)}</p>
    <p><b>TX Hash:</b> <code>${order.txHash || '—'}</code></p>
    <p><b>Customer:</b> ${order.contactInfo.name} &lt;${order.contactInfo.email}&gt;<br/>
       <b>WhatsApp:</b> ${order.contactInfo.whatsapp || '—'}<br/>
       <b>Shipping:</b> ${order.contactInfo.shippingAddress || '—'}
    </p>
    <p style="margin-top:18px;color:#8A857C;font-size:13px;">请在 24 小时内通过 WhatsApp 确认订单并告知生产/发货安排。</p>
  </div>`;
  return sendEmail({
    to: env.EMAIL_NOTIFY_TO.split(',').map(s => s.trim()).filter(Boolean),
    subject: `[LuxeCeramics Paid] ${order.orderNo} — USDT ${order.usdtAmount.toFixed(6)}`,
    htmlBody: html,
  }, 'paid-notifications');
}

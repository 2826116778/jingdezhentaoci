/**
 * 通用工具函数
 */
import type { Lang } from '../types';
import { TFunction } from 'i18next';

/** 取双语字段：自动按当前语言选 En/Ar */
export function pickBilingual<T extends { [k: string]: any }>(
  obj: T, lang: Lang,
  prefixes?: [string, string],
): string {
  const [kEn, kAr] = prefixes || [/en$/, /ar$/];
  if (lang === 'ar') {
    const k = Object.keys(obj).find(k => kAr instanceof RegExp ? kAr.test(k) : k === kAr) as string | undefined;
    if (k && obj[k]) return String(obj[k]);
  }
  const k = Object.keys(obj).find(k => kEn instanceof RegExp ? kEn.test(k) : k === kEn) as string | undefined;
  return (k && obj[k] ? String(obj[k]) : '') || '';
}

/** 构造 WhatsApp 链接：带预设文案（可带入产品名） */
export function buildWhatsAppLink(opts: {
  preset: 'general' | 'product' | 'oem';
  phone?: string;
  productName?: string;
  sku?: string;
  t: TFunction;
}) {
  const phone = opts.phone || '971501234567'; // 演示号码，实际部署改这里或 .env 注入
  let text: string;
  if (opts.preset === 'product' && opts.productName) {
    text = opts.t('whatsapp.preset_product', { name: opts.productName, sku: opts.sku || 'N/A' });
  } else if (opts.preset === 'oem') {
    text = opts.t('whatsapp.preset_oem');
  } else {
    text = opts.t('whatsapp.preset_general');
  }
  // 纯数字，不带 + / - / 空格
  const phoneDigits = phone.replace(/\D+/g, '');
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}

export function pad2(n: number) { return n.toString().padStart(2, '0'); }

/** 秒数 → MM:SS */
export function secondsToMMSS(secs: number) {
  if (secs <= 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

/** 产品分类翻译 key */
export const CATEGORY_I18N: Record<string, string> = {
  'tableware':    'footer.p_tableware',
  'vase':         'footer.p_vase',
  'art-sculpture':'footer.p_sculpture',
  'hotel-ware':   'footer.p_hotelware',
  'tiles':        'footer.p_tiles',
  'oem-sample':   'footer.p_oem',
};

export const MATERIAL_I18N: Record<string, string> = {
  'bone-china': 'Bone China',
  'porcelain':  'Porcelain',
  'stoneware':  'Stoneware',
  'ceramic':    'Ceramic',
};

/** 通用：异步等待 */
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** 复制到剪贴板（回退方案）
 * 可选参数：toast/showToast 用于复制完成后提示，okKey 为 toast 成功文案的 t key
 */
export async function copyText(
  text: string,
  showToast?: (opts: any) => void,
  opts?: { ok?: string; fail?: string },
): Promise<boolean> {
  let ok = false;
  try {
    if (navigator.clipboard) { await navigator.clipboard.writeText(text); ok = true; }
    else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-9999px';
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    }
  } catch { ok = false; }
  if (showToast) {
    showToast({ type: ok ? 'success' : 'error', text: ok ? (opts?.ok || 'Copied') : (opts?.fail || 'Copy failed') });
  }
  return ok;
}

/** TXID 截断展示 */
export function truncateTxHash(hash?: string, head = 6, tail = 4): string {
  if (!hash) return '';
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

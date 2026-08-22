/**
 * Tron 地址格式工具 — hex <-> base58（Tron 使用 base58check，版本字节 0x41）
 * 不引入完整 tronweb，依赖 Node 内置 crypto 即可完成 6 项校验所需的地址比较
 */
import crypto from 'crypto';

// Base58 字母表（BTC/Tron 相同）
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = new Map<string, number>();
for (let i = 0; i < B58_ALPHABET.length; i++) B58_MAP.set(B58_ALPHABET[i], i);

export function sha256(buf: Buffer): Buffer {
  return crypto.createHash('sha256').update(buf).digest();
}

export function base58Encode(buf: Buffer): string {
  // 前导 1 计数
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;
  // 转 BigInt 方式：逐字节乘 256 加字节
  let num = 0n;
  for (let i = 0; i < buf.length; i++) {
    num = num * 256n + BigInt(buf[i]);
  }
  let str = '';
  while (num > 0n) {
    const r = Number(num % 58n);
    str = B58_ALPHABET[r] + str;
    num = num / 58n;
  }
  return '1'.repeat(zeros) + str;
}

export function base58Decode(s: string): Buffer {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === '1') zeros++;
  let num = 0n;
  for (let i = 0; i < s.length; i++) {
    const v = B58_MAP.get(s[i]);
    if (v === undefined) throw new Error('invalid base58 char');
    num = num * 58n + BigInt(v);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.push(Number(num & 0xffn));
    num = num >> 8n;
  }
  bytes.reverse();
  const out = Buffer.concat([Buffer.alloc(zeros), Buffer.from(bytes)]);
  return out;
}

/**
 * Tron hex → base58（Tron 地址 hex: 41xxxxxx 共 21 字节 = 42 位 hex，含版本前缀 + 20 byte pubkeyHash）
 */
export function tronHexToBase58(hex: string): string {
  let h = hex.replace(/^0x/, '').trim();
  if (h.length === 40) h = '41' + h; // 兼容：没前缀时补 41
  if (h.length !== 42) throw new Error(`bad tron hex length: ${h.length} (${hex})`);
  const payload = Buffer.from(h, 'hex');
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  return base58Encode(Buffer.concat([payload, checksum]));
}

/**
 * Tron base58 → hex（返回 42 位 41xxxxxx，小写，不含 0x）
 */
export function tronBase58ToHex(b58: string): string {
  const buf = base58Decode(b58);
  if (buf.length !== 25) throw new Error(`bad tron base58 length: ${buf.length}`);
  // 21 字节 payload + 4 字节 checksum
  const payload = buf.subarray(0, 21);
  const givenChecksum = buf.subarray(21, 25);
  const expected = sha256(sha256(payload)).subarray(0, 4);
  if (!givenChecksum.equals(expected)) throw new Error('bad tron address checksum');
  return payload.toString('hex');
}

/**
 * 规范化 Tron 地址 — 两种格式都转成不带 0x 的 42 位小写 hex，方便字符串比较
 */
export function normalizeTronAddress(addr: string): string {
  const s = addr.trim();
  // base58: 始终以 T 开头，长度 34
  if (/^T[A-Za-z0-9]{33}$/.test(s)) return tronBase58ToHex(s).toLowerCase();
  // hex
  const hx = s.replace(/^0x/, '').toLowerCase();
  if (/^[0-9a-f]{40}$/.test(hx)) return ('41' + hx).toLowerCase();
  if (/^[0-9a-f]{42}$/.test(hx)) return hx.toLowerCase();
  throw new Error(`unrecognized tron address: ${addr}`);
}

/**
 * 智能解析 — 接受 hex(40/42) 或 base58(T..)，输出 base58
 */
export function smartTronToBase58(addr: string): string {
  if (/^T[A-Za-z0-9]{33}$/.test(addr.trim())) return addr.trim();
  return tronHexToBase58(addr);
}

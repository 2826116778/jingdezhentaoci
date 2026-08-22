/**
 * 日志工具：统一控制台 + 文件输出
 * 支付日志 backend/logs/payments/<orderNo>.log
 * 询盘邮件（demo） backend/logs/inquiry-emails/<timestamp>.eml
 * 到账通知（demo） backend/logs/paid-notifications/<timestamp>.eml
 */
import fs from 'fs';
import path from 'path';

const LOG_BASE = path.resolve(process.cwd(), 'logs');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function writePaymentLog(orderNo: string, lines: string[]) {
  ensureDir(path.join(LOG_BASE, 'payments'));
  const file = path.join(LOG_BASE, 'payments', `${orderNo}.log`);
  const header = `\n\n===== [${new Date().toISOString()}] =====\n`;
  const content = header + lines.join('\n') + '\n';
  fs.appendFileSync(file, content, { encoding: 'utf8' });
}

export function writeDemoEmail(subfolder: string, filename: string, rawEml: string) {
  const dir = path.join(LOG_BASE, subfolder);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, filename), rawEml, { encoding: 'utf8' });
}

export function logPayment(orderNo: string, msg: string) {
  console.log(`[Payments|${orderNo}] ${msg}`);
  writePaymentLog(orderNo, [msg]);
}

export const logger = {
  info: (...args: any[]) => console.log(`[INFO][${new Date().toISOString()}]`, ...args),
  warn: (...args: any[]) => console.warn(`[WARN][${new Date().toISOString()}]`, ...args),
  error: (...args: any[]) => console.error(`[ERR][${new Date().toISOString()}]`, ...args),
  debug: (...args: any[]) => console.log(`[DEBUG][${new Date().toISOString()}]`, ...args),
};

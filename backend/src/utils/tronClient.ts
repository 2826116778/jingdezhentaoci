/**
 * TronGrid REST API 客户端（不用 tronweb 大依赖，axios 直连）
 * 主网: https://api.trongrid.io
 * 测试网(Nile): https://nile.trongrid.io
 *
 * 封装 3 个核心调用：
 * 1) getTransactionInfoById(txHash)  - 确认数/状态/时间戳（HTTP 形式：/wallet/gettransactioninfobyid）
 * 2) getTransactionById(txHash)      - 原始交易内容（含 contract 参数：to/from/amount/contract_address）
 * 3) listAccountTRC20Transfers(addr, opts) - /v1/accounts/{addr}/transactions — TRC20 历史（cron 自动匹配用）
 */
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { ApiResult } from './response';
import { normalizeTronAddress, smartTronToBase58, tronBase58ToHex, tronHexToBase58 } from './tronAddress';

let client: AxiosInstance;
function getClient() {
  if (client) return client;
  client = axios.create({
    baseURL: env.trongridBase,
    timeout: 10000,
    headers: env.TRONGRID_API_KEY
      ? { 'TRON-PRO-API-KEY': env.TRONGRID_API_KEY, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' },
  });
  // 响应拦截：429/5xx 自动重试 1 次（简化实现）
  let retryCount = 0;
  client.interceptors.response.use(
    r => { retryCount = 0; return r; },
    async err => {
      const code = err.response?.status;
      const config = err.config;
      if (!config || retryCount >= 1) { retryCount = 0; return Promise.reject(err); }
      if ((code === 429) || (code && code >= 500)) {
        retryCount++;
        await new Promise(r => setTimeout(r, 1200));
        return client.request(config);
      }
      return Promise.reject(err);
    },
  );
  return client;
}

/**
 * 通用：POST JSONRPC 类（wallet/xxx）
 */
async function postJson<T>(path: string, body: any): Promise<ApiResult<T>> {
  try {
    const c = getClient();
    const url = path.startsWith('http') ? path : path;
    const res = await c.post<T>(url.startsWith('/') ? url : `/${path}`, body, { responseType: 'json' });
    return { ok: true, data: res.data };
  } catch (e: any) {
    console.error(`[TronGrid] POST ${path} failed:`, e?.message || e);
    return { ok: false, code: 'TG_REQUEST_ERR', message: e?.message || 'TronGrid request failed' };
  }
}

async function getJson<T>(path: string, params?: any): Promise<ApiResult<T>> {
  try {
    const c = getClient();
    const res = await c.get<T>(path, { params });
    return { ok: true, data: res.data };
  } catch (e: any) {
    console.error(`[TronGrid] GET ${path} failed:`, e?.message || e);
    return { ok: false, code: 'TG_REQUEST_ERR', message: e?.message || 'TronGrid request failed' };
  }
}

/** 交易信息（状态/确认数/时间）：POST /wallet/gettransactioninfobyid */
export interface TronTxInfo {
  id: string;
  blockNumber?: number;
  blockTimeStamp?: number;  // ms
  confirmed?: boolean;
  contractRet?: string[];   // 'SUCCESS' 等
  receipt?: {
    result?: string;         // 'SUCCESS' | 'OUT_OF_ENERGY' | 'REVERT' ...
    energy_usage?: number;
    energy_fee?: number;
    net_usage?: number;
    net_fee?: number;
  };
  log?: {
    address?: string;           // contract 地址 hex（40 位或 42 位 41xx）
    topics?: string[];          // Transfer 事件 topic[0]=ddf252ad... topics[1]=from topics[2]=to
    data?: string;              // amount uint256 (hex)
  }[];
  internal_transactions?: any[];
  [k: string]: any;
}

export async function getTransactionInfoById(txHash: string): Promise<ApiResult<TronTxInfo>> {
  return postJson<TronTxInfo>('wallet/gettransactioninfobyid', { value: txHash.trim() });
}

/** 原始交易（含 contract 参数解析）：POST /wallet/gettransactionbyid */
export interface TronTxRaw {
  txID: string;
  raw_data: {
    contract: Array<{
      type: string;   // 'TriggerSmartContract'
      parameter: {
        type_url: string;
        value: {
          owner_address: string;         // from（41... hex）
          contract_address: string;      // 合约地址 hex（41...）
          data?: string;                 // ABI 编码: 函数选择器 4 字节 + 参数
        };
      };
    }>;
    timestamp?: number;
  };
  [k: string]: any;
}

export async function getTransactionById(txHash: string): Promise<ApiResult<TronTxRaw>> {
  return postJson<TronTxRaw>('wallet/gettransactionbyid', { value: txHash.trim() });
}

/**
 * 解析 TriggerSmartContract 的 data 字段：识别 transfer(address,uint256)，返回 (to, amount)
 * selector = keccak256("transfer(address,uint256)")[0:4] = "a9059cbb"
 */
export function parseTransferData(hexData: string | undefined): { to: string; amountSun: bigint } | null {
  if (!hexData) return null;
  const h = hexData.replace(/^0x/, '').toLowerCase();
  if (h.length !== 4 + 64 + 64) return null; // 4 + 32 bytes (to padded) + 32 bytes (amount)
  if (!h.startsWith('a9059cbb')) return null; // transfer(address,uint256)
  const toPadded = h.substring(4, 4 + 64);
  const amountHex = h.substring(4 + 64);
  const toHex40 = toPadded.replace(/^0+/, ''); // 去掉前导 0，得到 40 位 pubkey hash
  const amount = BigInt('0x' + amountHex);
  return { to: toHex40, amountSun: amount };
}

/**
 * 从一笔原始交易（raw_data.contract[0]=TriggerSmartContract + data=transfer(...)）中解析出 TRC20 转账信息
 * 返回 { contract(base58), from(base58), to(base58), amountSun }；失败返回 null
 */
export function parseRawTxTRC20Transfer(raw: TronTxRaw) {
  const c0 = raw.raw_data?.contract?.[0];
  if (!c0 || c0.type !== 'TriggerSmartContract') return null;
  const v = c0.parameter?.value;
  if (!v?.contract_address || !v?.owner_address) return null;
  const call = parseTransferData(v.data);
  if (!call) return null;
  const contract = tronHexToBase58(v.contract_address);
  const from = tronHexToBase58(v.owner_address);
  const to = tronHexToBase58(call.to);
  return { contract, from, to, amountSun: call.amountSun };
}

/**
 * v1/accounts/{addr}/transactions 事件列表（TRC20 账户活动，用于 cron 自动扫描商户钱包的 incoming transfer）
 * Trongrid 返回格式:
 * { data: [ { transaction_id, type:'Transfer', from, to, value, block_timestamp, token_info:{ address:contract, symbol, decimals } } ... ], meta:{} }
 * 注意：这里的 value 已经是 number 单位是 token 最小单位（USDT=sun, 10^-6）；但偶尔返回字符串，需 BigInt 兜底
 */
export interface TRC20Event {
  transaction_id: string;
  type?: string;
  from: string;          // base58
  to: string;            // base58
  value: string | number;  // 最小单位（USDT=1e-6）
  block_timestamp: number;
  token_info?: { address?: string; symbol?: string; decimals?: number };
}

export interface TRC20EventResponse {
  data: TRC20Event[];
  meta?: any;
}

export async function listAccountTRC20Transfers(
  addressBase58: string,
  opts: { minTs?: number; maxTs?: number; contract?: string; onlyTo?: boolean; limit?: number } = {},
): Promise<ApiResult<TRC20EventResponse>> {
  const params: any = { limit: opts.limit ?? 200 };
  if (opts.minTs) params.min_timestamp = opts.minTs;
  if (opts.maxTs) params.max_timestamp = opts.maxTs;
  if (opts.contract) params.contract_address = opts.contract;
  if (opts.onlyTo) params.only_to = true;
  return getJson<TRC20EventResponse>(`/v1/accounts/${addressBase58}/transactions/trc20`, params);
}

/**
 * 取当前最新区块号（用作当前区块水位线）
 */
export async function getNowBlock(): Promise<ApiResult<number>> {
  const r = await postJson<any>('wallet/getnowblock', {});
  if (!r.ok) return { ok: false, code: r.code, message: r.message };
  const num = r.data?.block_header?.raw_data?.number;
  if (typeof num !== 'number') return { ok: false, code: 'BLOCK_NUM_PARSE', message: 'cannot parse now block num' };
  return { ok: true, data: num };
}

// 导出地址工具复用
export { normalizeTronAddress, smartTronToBase58, tronBase58ToHex, tronHexToBase58 };

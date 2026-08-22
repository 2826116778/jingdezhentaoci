/**
 * 支付校验单入口：所有 6 项校验都走这里
 * 6 条件（严格顺序，失败即给出可读 reason）
 * 1. 交易 ret = SUCCESS
 * 2. 合约地址正确（TRC20-USDT）
 * 3. 收款地址 = 商户钱包
 * 4. 金额在 ±tolerancePct 范围内
 * 5. 区块确认数 >= requiredConfirmations
 * 6. 交易时间 ∈ [orderCreatedAt, orderExpireAt]（防旧 txHash 复用）
 */
import { TronTxInfo, TronTxRaw, parseRawTxTRC20Transfer, normalizeTronAddress } from './tronClient';

export interface ValidateOpts {
  txInfo: TronTxInfo;
  txRaw: TronTxRaw;
  expectedContract: string;       // base58 (T...)
  expectedTo: string;             // base58 (T...)
  expectedAmountSun: bigint;      // usdtAmount * 1e6（USDT 6 位小数 = sun 单位）
  tolerancePct: number;           // 0.01 = 1%
  requiredConfirmations: number;  // 6
  orderCreatedAt: Date;
  orderExpireAt: Date;
  currentBlock: number;           // 当前最新区块号
}

export interface ValidateResult {
  ok: boolean;
  reason?: string;
  amountSun?: bigint;
  confirmations?: number;
  actualTo?: string;
  actualContract?: string;
}

export function validateUSDTTransfer(opts: ValidateOpts): ValidateResult {
  const { txInfo, txRaw, expectedContract, expectedTo, expectedAmountSun, tolerancePct, requiredConfirmations, orderCreatedAt, orderExpireAt, currentBlock } = opts;

  // 0) 原始交易必须是 TRC20 transfer 调用
  const parsed = parseRawTxTRC20Transfer(txRaw);
  if (!parsed) {
    return { ok: false, reason: 'TX_NOT_USDT_TRANSFER: not a TRC20 transfer(addr,uint256) call' };
  }

  // 1) 交易成功
  const receiptResult = txInfo.receipt?.result;
  const contractRet0 = txInfo.contractRet?.[0];
  if (!(receiptResult === 'SUCCESS' && contractRet0 === 'SUCCESS')) {
    return {
      ok: false,
      reason: `TX_FAILED (receipt.result=${receiptResult}, contractRet[0]=${contractRet0})`,
    };
  }

  // 2) 合约地址正确（统一转 hex 比较，避免格式差异）
  let cHex: string, eCHex: string;
  try {
    cHex = normalizeTronAddress(parsed.contract);
    eCHex = normalizeTronAddress(expectedContract);
  } catch (e: any) {
    return { ok: false, reason: `BAD_CONTRACT_ADDR: ${e.message}` };
  }
  if (cHex !== eCHex) {
    return {
      ok: false,
      reason: `WRONG_CONTRACT: expected ${expectedContract}(${eCHex}) got ${parsed.contract}(${cHex})`,
      actualContract: parsed.contract,
    };
  }

  // 3) 收款地址匹配
  let toHex: string, eToHex: string;
  try {
    toHex = normalizeTronAddress(parsed.to);
    eToHex = normalizeTronAddress(expectedTo);
  } catch (e: any) {
    return { ok: false, reason: `BAD_TO_ADDR: ${e.message}` };
  }
  if (toHex !== eToHex) {
    return {
      ok: false,
      reason: `WRONG_RECIPIENT: expected ${expectedTo}(${eToHex}) got ${parsed.to}(${toHex})`,
      actualTo: parsed.to,
    };
  }

  // 4) 金额容错（±tolerancePct）。注意：amountSun 用 BigInt，先转 Number 比小数或用乘法
  const actual = parsed.amountSun;
  const expected = expectedAmountSun;
  // 差值 = |actual - expected| ; 比例 = 差值 / expected ; 若 expected=0 单独拒绝
  if (expected <= 0n) return { ok: false, reason: 'BAD_EXPECTED_AMOUNT: expected=0' };
  const diff = actual > expected ? actual - expected : expected - actual;
  // diff / expected <= tolerancePct  => diff * 10000 <= tolerancePct*10000 * expected
  // 用整数乘法避免浮点：
  const TOL_BPS = Math.round(tolerancePct * 10000); // 1% = 100 bps (basis points)
  const diff10000 = diff * 10000n;
  const expectedScaled = expected * BigInt(TOL_BPS);
  if (diff10000 > expectedScaled) {
    return {
      ok: false,
      reason: `AMOUNT_MISMATCH: expected=${expected.toString()}sun, actual=${actual.toString()}sun, tolerance=±${tolerancePct * 100}%`,
      amountSun: actual,
    };
  }

  // 5) 确认数
  const bn = txInfo.blockNumber;
  if (typeof bn !== 'number' || bn <= 0) {
    return { ok: false, reason: `NOT_MINED: blockNumber=${bn}` };
  }
  const confirmations = currentBlock - bn + 1;
  if (confirmations < requiredConfirmations) {
    return {
      ok: false,
      reason: `CONFIRMATIONS_LOW: ${confirmations}/${requiredConfirmations}`,
      confirmations,
    };
  }

  // 6) 交易时间 ∈ [订单创建时间, 过期时间]；blockTimeStamp 为毫秒；允许 30 秒早漂移
  const blockTs = txInfo.blockTimeStamp;
  if (typeof blockTs !== 'number') return { ok: false, reason: `NO_BLOCK_TIMESTAMP` };
  const lower = orderCreatedAt.getTime() - 30_000; // 30 秒偏移容错
  const upper = orderExpireAt.getTime();
  if (blockTs < lower) {
    return {
      ok: false,
      reason: `TX_TOO_EARLY: txTime=${new Date(blockTs).toISOString()} < orderCreatedAt=${orderCreatedAt.toISOString()}`,
    };
  }
  if (blockTs > upper) {
    return {
      ok: false,
      reason: `TX_TOO_LATE: txTime=${new Date(blockTs).toISOString()} > orderExpireAt=${orderExpireAt.toISOString()}`,
    };
  }

  return { ok: true, amountSun: actual, confirmations };
}

/**
 * PHASE 2-C §38 MockAIProvider
 *
 * 设计准则（§2 不伪造信息）：
 *   - Mock 完全基于输入快照推导，禁止编造数值 / 联系方式 / 营业额 / 采购量。
 *   - 输入里没有的字段 → confidence = 'UNKNOWN'，并给出 reason。
 *   - 不联网：sources 永远为 []，前端会显示 "No external source available."
 *   - 模拟 token 用量 = 输入长度（用于成本统计走通流程）。
 *
 * 注意：Mock 不通过 chat completion 入口走 OpenAI 协议；为了与 AIProvider 接口兼容，
 * 这里走最简化的 content = JSON.stringify(...) 输出，由上层 schemas 校验。
 */
import { env } from '../config/env';
import {
  AIProvider, AIError,
} from '../types/ai';

export class MockAIProvider implements AIProvider {
  readonly name = 'mock' as const;

  isConfigured(): boolean {
    return true;
  }

  /**
   * 简化 mock：把 user 文本视作"研究指令"原样返回一个"echo" JSON 字符串。
   * 高层业务（research / score / match / strategy / message）会调用更专门的 mock 函数
   * （见 ai/mockEngine.ts），此处只保留接口可调用，方便通用 retry / fallback 路径。
   */
  async complete(opts: {
    system: string;
    user: string;
    jsonMode?: boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<{ content: string; tokens: { input: number; output: number }; model: string }> {
    // 模拟超时：测试时可在 user prompt 末尾贴入 "__MOCK_TIMEOUT__" 触发
    if (opts.user.includes('__MOCK_TIMEOUT__')) {
      await sleep(50);
      throw new AIError('TIMEOUT', 'Mock provider simulated timeout', 504);
    }
    if (opts.user.includes('__MOCK_429__')) {
      throw new AIError('RATE_LIMITED', 'Mock provider simulated rate limit', 429);
    }
    if (opts.user.includes('__MOCK_500__')) {
      throw new AIError('SERVER_ERROR', 'Mock provider simulated server error', 500);
    }
    if (opts.user.includes('__MOCK_INVALID_JSON__')) {
      return {
        content: '{ not valid json',
        tokens: { input: opts.user.length, output: 18 },
        model: env.AI_MOCK_MODEL_ID,
      };
    }
    if (opts.user.includes('__MOCK_NETWORK__')) {
      throw new AIError('NETWORK', 'Mock provider simulated network error');
    }

    // 取消信号
    if (opts.signal?.aborted) {
      throw new AIError('CANCELLED', 'Mock provider request cancelled');
    }

    // 默认：把指令 + 系统提示拼成 JSON echo（上层 mockEngine 会直接走专用函数，不走这里）
    const echo = {
      mocked: true,
      echo: opts.user.slice(0, 500),
    };
    return {
      content: JSON.stringify(echo),
      tokens: { input: Math.ceil(opts.system.length / 4) + Math.ceil(opts.user.length / 4), output: 80 },
      model: env.AI_MOCK_MODEL_ID,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    // 中途取消时立即 reject
    if (typeof AbortController !== 'undefined') {
      // no-op
    }
    void t;
  });
}

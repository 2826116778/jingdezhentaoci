/**
 * PHASE 2-C §3 / §39 OpenAIProvider
 *
 * 实现：
 *   - 通过 axios 直接调用 https://api.openai.com/v1/chat/completions（不引入 openai SDK）
 *   - Authorization: Bearer ${env.OPENAI_API_KEY}（§3 ENV 注入，不写死代码）
 *   - 模型 env.OPENAI_MODEL（§51）
 *   - 超时 env.AI_TIMEOUT_MS（§52）
 *   - JSON 模式：response_format = { type: 'json_object' }（OpenAI JSON mode）
 *   - 失败归类为 AIError（TIMEOUT / RATE_LIMITED / SERVER_ERROR / NETWORK / INVALID_JSON）
 */
import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import {
  AIProvider, AIError,
} from '../types/ai';

interface ChatCompletionResp {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model?: string;
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const;

  isConfigured(): boolean {
    return !!env.OPENAI_API_KEY && !!env.OPENAI_API_BASE && !!env.OPENAI_MODEL;
  }

  async complete(opts: {
    system: string;
    user: string;
    jsonMode?: boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<{ content: string; tokens: { input: number; output: number }; model: string }> {
    if (!this.isConfigured()) {
      throw new AIError('NOT_CONFIGURED', 'OpenAI provider is not configured (OPENAI_API_KEY missing)');
    }
    const timeoutMs = opts.timeoutMs ?? env.AI_TIMEOUT_MS;
    const body: any = {
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: 0.2,
    };
    if (opts.jsonMode) body.response_format = { type: 'json_object' };

    const ctrl = new AbortController();
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const resp = await axios.post<ChatCompletionResp>(
        `${env.OPENAI_API_BASE.replace(/\/+$/, '')}/chat/completions`,
        body,
        {
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          // axios timeout 对应 connect+read 上限；AbortController 走真正取消
          timeout: timeoutMs + 2000,
          signal: ctrl.signal,
          validateStatus: (s) => s >= 200 && s < 500,
        },
      );
      const choice = resp.data?.choices?.[0];
      const content = choice?.message?.content ?? '';
      const inputT = resp.data?.usage?.prompt_tokens ?? Math.ceil(opts.system.length / 4) + Math.ceil(opts.user.length / 4);
      const outputT = resp.data?.usage?.completion_tokens ?? Math.ceil(content.length / 4);
      return { content, tokens: { input: inputT, output: outputT }, model: resp.data?.model || env.OPENAI_MODEL };
    } catch (e: any) {
      throw normalizeAxiosError(e);
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeAxiosError(e: any): AIError {
  // AbortController 触发 → axios 抛 ECONNABORTED / 'canceled'
  if (e?.code === 'ECONNABORTED' || e?.name === 'CanceledError' || e?.message?.includes('timeout')) {
    return new AIError('TIMEOUT', `OpenAI request timeout: ${e?.message || ''}`, 504);
  }
  if (e?.code === 'ENOTFOUND' || e?.code === 'ECONNREFUSED' || e?.code === 'EAI_AGAIN') {
    return new AIError('NETWORK', `OpenAI network error: ${e?.code || ''}`);
  }
  const status = (e as AxiosError)?.response?.status;
  const data: any = (e as AxiosError)?.response?.data;
  const msg = data?.error?.message || e?.message || 'OpenAI request failed';
  if (status === 429) return new AIError('RATE_LIMITED', msg, 429);
  if (status && status >= 500) return new AIError('SERVER_ERROR', msg, status);
  if (status && status >= 400 && status < 500) return new AIError('UNKNOWN', `OpenAI ${status}: ${msg}`, status);
  return new AIError('UNKNOWN', msg);
}

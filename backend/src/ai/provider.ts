/**
 * PHASE 2-C §3 AI Provider 工厂
 *
 * 选 provider 顺序（§39）：
 *   1. 显式覆盖（测试或调用方临时注入）→ 返回注入的 provider
 *   2. env.AI_PROVIDER === 'openai' 且 OPENAI_API_KEY 已配置 → OpenAIProvider
 *   3. 否则 → MockAIProvider（项目必须能跑起来，无 Key 不可阻断）
 *
 * 同时提供 AI Complete 高层封装（含 timeout / signal / retry 由调用方决定）。
 */
import { env } from '../config/env';
import {
  AIProvider, AIProviderName, AIError,
} from '../types/ai';
import { MockAIProvider } from './mockProvider';
import { OpenAIProvider } from './openAIProvider';

// ---------- 默认单例（与进程同生命周期） ----------
let _mockSingleton: MockAIProvider | null = null;
let _openaiSingleton: OpenAIProvider | null = null;
let _override: AIProvider | null = null;   // 测试用注入

export function getMockProvider(): MockAIProvider {
  if (!_mockSingleton) _mockSingleton = new MockAIProvider();
  return _mockSingleton;
}

export function getOpenAIProvider(): OpenAIProvider {
  if (!_openaiSingleton) _openaiSingleton = new OpenAIProvider();
  return _openaiSingleton;
}

/** 测试 / 注入：临时覆盖活动 provider（不持久化） */
export function overrideAIProvider(p: AIProvider | null): void {
  _override = p;
}

export function getActiveProviderName(): AIProviderName {
  if (_override) return _override.name;
  if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY) return 'openai';
  return 'mock';
}

export function getActiveProvider(): AIProvider {
  if (_override) return _override;
  if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    const p = getOpenAIProvider();
    if (p.isConfigured()) return p;
    // 配置不完整：回退 Mock，但留下运行时提示
    console.warn('[AI] OPENAI_API_KEY missing → fallback to Mock provider');
  }
  return getMockProvider();
}

export { AIError };

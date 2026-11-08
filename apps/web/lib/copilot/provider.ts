/**
 * Provider selection (docs/05 8.4, docs/04 7.4). Pure: it takes an env-like object, so the caller (the route, the eval CLI)
 * is the only code that reads the real environment. Error messages name variables, never their values.
 */
import type { ModelClient } from './engine';
import { createAnthropicModelClient } from './providers/anthropic';
import { createOpenAiCompatibleClient } from './providers/openai';

export type ProviderConfig =
  | { provider: 'openai-compatible'; baseUrl: string; apiKey: string; model: string }
  | { provider: 'anthropic'; apiKey: string; model: string };

/** A configuration problem the operator can fix; the message is safe to show. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;
const clean = (v: string | undefined): string => (v ?? '').trim();
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function resolveProviderConfig(env: Env): ProviderConfig {
  const provider = clean(env.COPILOT_PROVIDER) || 'openai-compatible';
  if (provider !== 'openai-compatible' && provider !== 'anthropic') {
    throw new ConfigError('COPILOT_PROVIDER phải là "openai-compatible" hoặc "anthropic".');
  }
  const model = clean(env.COPILOT_MODEL);
  const apiKey = clean(provider === 'anthropic' ? env.ANTHROPIC_API_KEY : env.COPILOT_API_KEY);
  const baseUrl = clean(env.COPILOT_BASE_URL);

  const missing: string[] = [];
  if (!model) missing.push('COPILOT_MODEL');
  if (!apiKey) missing.push(provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'COPILOT_API_KEY');
  if (provider === 'openai-compatible' && !baseUrl) missing.push('COPILOT_BASE_URL');
  if (missing.length > 0) {
    throw new ConfigError(`Trợ lý AI chưa được cấu hình: thiếu ${missing.join(', ')}. Hãy điền các biến này ở phía máy chủ (tên model do nhà cung cấp của bạn cung cấp).`);
  }

  if (provider === 'anthropic') return { provider, apiKey, model };

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new ConfigError('COPILOT_BASE_URL không phải địa chỉ hợp lệ (ví dụ https://router.example/v1).');
  }
  // The key travels in the Authorization header: no cleartext except to this machine.
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK.has(url.hostname))) {
    throw new ConfigError('COPILOT_BASE_URL phải dùng https (http chỉ được phép với localhost).');
  }
  return { provider, baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

export function createModelClient(cfg: ProviderConfig): ModelClient {
  return cfg.provider === 'anthropic' ? createAnthropicModelClient(cfg) : createOpenAiCompatibleClient(cfg);
}

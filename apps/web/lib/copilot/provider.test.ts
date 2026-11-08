import { describe, expect, it } from 'vitest';
import { ConfigError, resolveProviderConfig } from './provider';

const KEY = 'k'.repeat(24); // low-entropy fake, not a real key
const ok = { COPILOT_BASE_URL: 'https://router.example.test/v1', COPILOT_API_KEY: KEY, COPILOT_MODEL: 'some-model-medium' };

const message = (env: Record<string, string>): string => {
  try {
    resolveProviderConfig(env);
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return (e as Error).message;
  }
  throw new Error('expected a ConfigError');
};

describe('resolveProviderConfig', () => {
  it('defaults to openai-compatible and returns what it was given', () => {
    expect(resolveProviderConfig(ok)).toEqual({ provider: 'openai-compatible', baseUrl: 'https://router.example.test/v1', apiKey: KEY, model: 'some-model-medium' });
  });

  it('trims whitespace and a trailing slash', () => {
    const c = resolveProviderConfig({ ...ok, COPILOT_BASE_URL: '  https://router.example.test/v1/  ', COPILOT_MODEL: ' m ' });
    expect(c).toMatchObject({ baseUrl: 'https://router.example.test/v1', model: 'm' });
  });

  it('has no model id in code: a missing COPILOT_MODEL is a Vietnamese config error for both backends', () => {
    expect(message({ ...ok, COPILOT_MODEL: '' })).toMatch(/thiếu COPILOT_MODEL/);
    expect(message({ COPILOT_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: KEY })).toMatch(/thiếu COPILOT_MODEL/);
  });

  it('lists every missing variable by name', () => {
    const m = message({});
    for (const name of ['COPILOT_MODEL', 'COPILOT_API_KEY', 'COPILOT_BASE_URL']) expect(m).toContain(name);
  });

  it('the anthropic backend wants ANTHROPIC_API_KEY and a model, and ignores the router address', () => {
    expect(resolveProviderConfig({ COPILOT_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: KEY, COPILOT_MODEL: 'm' })).toEqual({ provider: 'anthropic', apiKey: KEY, model: 'm' });
    expect(message({ COPILOT_PROVIDER: 'anthropic', COPILOT_API_KEY: KEY, COPILOT_MODEL: 'm' })).toContain('ANTHROPIC_API_KEY');
  });

  it('rejects an unknown provider', () => {
    expect(message({ ...ok, COPILOT_PROVIDER: 'gemini' })).toContain('COPILOT_PROVIDER');
  });

  it('requires https for the router, except for this machine', () => {
    expect(message({ ...ok, COPILOT_BASE_URL: 'http://router.example.test/v1' })).toContain('https');
    expect(message({ ...ok, COPILOT_BASE_URL: 'ftp://router.example.test' })).toContain('https');
    expect(message({ ...ok, COPILOT_BASE_URL: 'not a url' })).toContain('COPILOT_BASE_URL');
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(resolveProviderConfig({ ...ok, COPILOT_BASE_URL: `http://${host}:20128/v1` })).toMatchObject({ provider: 'openai-compatible' });
    }
  });

  it('no error message ever contains a secret value', () => {
    const secret = 's3cr3t-'.repeat(4);
    const bad: Record<string, string>[] = [
      { COPILOT_API_KEY: secret },
      { COPILOT_API_KEY: secret, COPILOT_MODEL: 'm', COPILOT_BASE_URL: `http://${secret}.example.test` },
      { COPILOT_API_KEY: secret, COPILOT_MODEL: 'm', COPILOT_BASE_URL: `http://router.example.test/${secret}` },
      { COPILOT_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: secret },
      { COPILOT_PROVIDER: secret, COPILOT_API_KEY: secret },
    ];
    for (const env of bad) expect(message(env)).not.toContain(secret);
  });
});

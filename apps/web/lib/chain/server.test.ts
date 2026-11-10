import { describe, expect, it } from 'vitest';
import { loadChainConfig } from './server';

// Reads the committed `contracts/deployments/fuji.json` (the real Fuji deploy); no network access.
describe('loadChainConfig browser RPC (A19)', () => {
  it('has no rpcUrl by default: the browser then uses Fuji public RPC', () => {
    const c = loadChainConfig({});
    expect(c).not.toBeNull();
    expect(c).not.toHaveProperty('rpcUrl');
  });

  it('passes NEXT_PUBLIC_FUJI_RPC_URL to the browser and never the server RPC URLs', () => {
    const c = loadChainConfig({
      NEXT_PUBLIC_FUJI_RPC_URL: 'https://browser.example/fuji',
      FUJI_RPC_URL: 'https://server.example/key-abc123',
      FUJI_RPC_URL_FALLBACK: 'https://fallback.example/key-def456',
    });
    expect(c?.rpcUrl).toBe('https://browser.example/fuji');
    const json = JSON.stringify(c);
    expect(json).not.toContain('key-abc123');
    expect(json).not.toContain('key-def456');
  });

  it('refuses an unsafe browser RPC instead of shipping it to every visitor', () => {
    expect(() => loadChainConfig({ NEXT_PUBLIC_FUJI_RPC_URL: 'https://user:pw@rpc.example/fuji' })).toThrow();
    expect(() => loadChainConfig({ NEXT_PUBLIC_FUJI_RPC_URL: 'http://rpc.example/fuji' })).toThrow();
  });
});

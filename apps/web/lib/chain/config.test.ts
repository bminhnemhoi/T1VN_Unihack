import { describe, expect, it } from 'vitest';
import { createChainConfig } from './config';

const json = {
  network: 'fuji' as const,
  chainId: 43113,
  factory: '0x5004477143F8Db65f80992A0BD79c1DAb75C8b21' as const,
  registry: '0xf8F05aa2804144F5aC71485614480f801927E5c3' as const,
  usdc: '0x5425890298aed601595a70AB815c96711a31Bc65' as const,
  forwarder: '0x789621cFD56Cc79ec47eF6C449B6C53c40516b2C' as const,
  fromBlock: '60843937',
  vndPerUsdc: 26_000,
  pollMs: 5000,
};

describe('createChainConfig', () => {
  it('batches reads (JSON-RPC batch + Multicall3) so a refresh is a handful of requests, not ~80 (A18)', () => {
    const c = createChainConfig(json);
    expect(c.client.batch?.multicall).toBeTruthy();
    expect(c.client.chain?.contracts?.multicall3?.address).toBeTruthy(); // Fuji has Multicall3
    expect(c.fromBlock).toBe(60_843_937n);
  });

  it('reads from the configured browser RPC when one is set, else from the chain default (A19)', () => {
    expect(createChainConfig(json).client.transport.url).toBe('https://api.avax-test.network/ext/bc/C/rpc');
    const own = createChainConfig({ ...json, rpcUrl: 'https://rpc.example/fuji' });
    expect(own.client.transport.url).toBe('https://rpc.example/fuji');
    expect(own.client.batch?.multicall).toBeTruthy(); // still batched
    // anvil never takes the Fuji URL
    expect(createChainConfig({ ...json, network: 'anvil', chainId: 31337, rpcUrl: 'https://rpc.example/fuji' }).client.transport.url).toBe(
      'http://127.0.0.1:8545',
    );
  });

  it('keeps the local anvil usable (no Multicall3 there: viem falls back to plain calls)', () => {
    const c = createChainConfig({ ...json, network: 'anvil', chainId: 31337 });
    expect(c.client.chain?.id).toBe(31337);
    expect(c.client.chain?.contracts?.multicall3).toBeUndefined();
  });
});

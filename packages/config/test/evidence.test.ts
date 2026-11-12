import { describe, expect, it } from 'vitest';
import { FUJI_EVIDENCE, fujiAddressUrl } from '../src';

describe('FUJI_EVIDENCE', () => {
  it('holds two distinct 20-byte addresses', () => {
    const all = Object.values(FUJI_EVIDENCE);
    expect(all).toHaveLength(2);
    for (const a of all) expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(new Set(all.map((a) => a.toLowerCase())).size).toBe(2);
  });

  it('links to the Fuji explorer, never mainnet', () => {
    const url = fujiAddressUrl(FUJI_EVIDENCE.defaultCircle);
    expect(url).toBe('https://testnet.snowtrace.io/address/0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc');
  });
});

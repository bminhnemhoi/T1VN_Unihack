import { describe, expect, it } from 'vitest';
import { isDemoBuild, MAINNET_CHAIN_ID } from './demo-build';

describe('isDemoBuild', () => {
  it('is on for Fuji, anvil and for no chain at all', () => {
    expect(isDemoBuild(43113, false)).toBe(true);
    expect(isDemoBuild(31337, false)).toBe(true);
    expect(isDemoBuild(undefined, false)).toBe(true);
    expect(isDemoBuild(null, false)).toBe(true);
  });
  it('is off only on mainnet without the flag', () => {
    expect(isDemoBuild(MAINNET_CHAIN_ID, false)).toBe(false);
  });
  it('the flag keeps it on even on mainnet', () => {
    expect(isDemoBuild(MAINNET_CHAIN_ID, true)).toBe(true);
  });
});

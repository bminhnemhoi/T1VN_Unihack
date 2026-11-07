import { describe, expect, it } from 'vitest';
import { DEMO, FUJI, FUJI_CHAIN_ID } from '../src/index';

describe('config', () => {
  it('targets Avalanche Fuji only', () => {
    expect(FUJI.id).toBe(43113);
    expect(FUJI.id).toBe(FUJI_CHAIN_ID);
    expect(FUJI.explorer).toBe('https://testnet.snowtrace.io');
    expect(FUJI.rpc).not.toContain('api.avax.network');
  });

  it('keeps demo windows inside the demo round', () => {
    expect(DEMO.commitWindow + DEMO.revealWindow).toBeLessThanOrEqual(DEMO.roundDuration);
  });
});

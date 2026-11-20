import { describe, expect, it } from 'vitest';
import { DEMO, FUJI, FUJI_CHAIN_ID } from '../src/index';

describe('config', () => {
  it('targets Avalanche Fuji only', () => {
    expect(FUJI.id).toBe(43113);
    expect(FUJI.id).toBe(FUJI_CHAIN_ID);
    expect(FUJI.explorer).toBe('https://testnet.snowtrace.io');
    expect(FUJI.rpc).not.toContain('api.avax.network');
  });

  it('keeps demo windows seamlessly filling the demo round with valid grace', () => {
    expect(DEMO.roundDuration).toBeGreaterThanOrEqual(120);
    expect(DEMO.commitWindow).toBeGreaterThanOrEqual(30);
    expect(DEMO.revealWindow).toBeGreaterThanOrEqual(30);
    expect(DEMO.commitWindow + DEMO.revealWindow).toBe(DEMO.roundDuration);
    expect(DEMO.graceSeconds).toBeGreaterThanOrEqual(60);
    expect(DEMO.graceSeconds).toBeLessThan(DEMO.roundDuration);
  });
});

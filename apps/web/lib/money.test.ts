import { describe, expect, it } from 'vitest';
import { formatCents } from './money';

describe('formatCents', () => {
  it('rounds money to receive down and a possible loss up', () => {
    expect(formatCents(3_982_675n)).toBe('3,98 USDC');
    expect(formatCents(3_982_675n, 'up')).toBe('3,99 USDC');
    expect(formatCents(304_000_000n, 'up')).toBe('304 USDC');
  });
  it('negative amounts: down goes further from zero, up goes toward zero', () => {
    expect(formatCents(-16_936_986n, 'down')).toBe('-16,94 USDC');
    expect(formatCents(-16_936_986n, 'up')).toBe('-16,93 USDC');
  });
});

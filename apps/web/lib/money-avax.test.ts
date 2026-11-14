import { describe, expect, it } from 'vitest';
import { formatAvax } from './money';

describe('formatAvax', () => {
  it('shows whole AVAX without decimals', () => expect(formatAvax(2n * 10n ** 18n)).toBe('2 AVAX'));
  it('uses a decimal comma and trims trailing zeros', () => expect(formatAvax(1_500_000_000_000_000_000n)).toBe('1,5 AVAX'));
  it('rounds down to 4 decimals', () => expect(formatAvax(49_999_999_999_999_999n)).toBe('0,0499 AVAX'));
  it('shows zero', () => expect(formatAvax(0n)).toBe('0 AVAX'));
});

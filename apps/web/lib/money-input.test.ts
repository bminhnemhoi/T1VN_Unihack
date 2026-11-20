import { describe, expect, it } from 'vitest';
import { parseMoneyInput } from './money-input';

const U = 1_000_000n;

describe('parseMoneyInput: bid box (issue #10)', () => {
  it.each([
    ['0,3', 300_000n],
    ['0.3', 300_000n],
    ['14.8', 14_800_000n],
    ['14,8', 14_800_000n],
    ['6.5', 6_500_000n],
    ['6.575342', 6_575_342n],
    ['0', 0n],
    [' 2,5 ', 2_500_000n],
  ])('reads %s as the amount the member typed', (text, units) => {
    expect(parseMoneyInput(text, 'bid')).toBe(units);
  });

  it.each(['', 'abc', '-1', '1e1', '0.1234567', '1.2.3', '1,2,3'])('rejects %s instead of guessing', (text) => {
    expect(parseMoneyInput(text, 'bid')).toBeUndefined();
  });
});

describe('parseMoneyInput: contribution box', () => {
  it.each([
    ['100', 100n * U],
    ['1.000', 1000n * U],
    ['10.000', 10_000n * U],
    ['1.000,5', 1_000_500_000n],
    ['10.5', 10_500_000n],
    ['10,5', 10_500_000n],
  ])('reads %s', (text, units) => {
    expect(parseMoneyInput(text, 'amount')).toBe(units);
  });
});

describe('contribution: preview and created circle read the same C', () => {
  it.each(['1.000', '10.5', '10,5', '100', '1.000,5'])('%s gives one C for both', async (text) => {
    const { validateForm, DEFAULTS } = await import('./circleForm');
    const { canonicalUsdc } = await import('./money-input');
    const shown = parseMoneyInput(text, 'amount')!;
    const { value } = validateForm({ ...DEFAULTS, c: canonicalUsdc(shown), bond: '1000000' });
    expect(value?.c).toBe(shown);
  });
});

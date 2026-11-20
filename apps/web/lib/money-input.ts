import { parseUsdc } from 'sdk';

/**
 * Read a USDC amount typed by a person, never silently changing its size (issue #10).
 *
 * - A comma is always the decimal mark; dots before it are thousands separators ("1.000,5").
 * - Without a comma, in the bid box a single dot is the decimal mark ("0.3", "14.8"): bids are always below C,
 *   so there is no thousands grouping to protect, and an English keyboard types a dot.
 * - Without a comma, in an amount box (the contribution) "1.000" / "10.000" (groups of exactly three digits)
 *   are thousands; any other single dot is the decimal mark ("10.5").
 * Anything else (two decimal marks, more than 6 decimals, signs, exponents; in the bid box more than 2 decimals) is rejected, not guessed.
 */
export function parseMoneyInput(text: string, mode: 'bid' | 'amount'): bigint | undefined {
  const s = text.trim();
  if (mode === 'bid' && tooManyBidDecimals(s)) return undefined;
  if (s.includes(',')) {
    if (s.split(',').length > 2) return undefined;
    const [whole = '', frac = ''] = s.split(',');
    if (whole.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(whole)) return undefined;
    return parseUsdc(`${whole.replace(/\./g, '')},${frac}`);
  }
  if (mode === 'amount' && /^\d{1,3}(\.\d{3})+$/.test(s)) return parseUsdc(s.replace(/\./g, ''));
  return parseUsdc(s);
}

/** "1000", "10.5": the one spelling `parseUsdc` reads back to exactly `units`. */
export function canonicalUsdc(units: bigint): string {
  const whole = units / 1_000_000n;
  const frac = (units % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** Bids are in cents (2 decimals). The ceiling is shown and offered rounded DOWN, so the shown maximum is always valid. */
export const bidCents = (units: bigint): bigint => (units / 10_000n) * 10_000n;

/** "6,575", "6.575342": a number with more than 2 decimals (bids take cents only). */
export const tooManyBidDecimals = (text: string): boolean => /^\d+[.,]\d{3,}$/.test(text.trim());

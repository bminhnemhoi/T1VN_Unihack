import { formatUsdc } from 'sdk';
import { formatUnits } from 'viem';

const CENT = 10_000n; // 0,01 USDC in base units

/**
 * USDC rounded to cents for summaries (net result, risk, settlement), so a headline never reads "3,982675 USDC".
 * Direction is explicit because rounding must not flatter: money to receive rounds down, a possible loss rounds up.
 * "down" / "up" refer to the VALUE (down = toward minus infinity). Negative amounts are shown as "-12,34 USDC".
 * Ledger lines keep the exact amount and use `formatUsdc` directly.
 */
export function formatCents(units: bigint, dir: 'down' | 'up' = 'down'): string {
  const abs = units < 0n ? -units : units;
  // For a negative value "down" means a larger magnitude, so rounding the magnitude flips.
  const magnitudeUp = units < 0n ? dir === 'down' : dir === 'up';
  const rest = abs % CENT;
  const rounded = rest === 0n ? abs : abs - rest + (magnitudeUp ? CENT : 0n);
  return `${units < 0n && rounded > 0n ? '-' : ''}${formatUsdc(rounded)}`;
}

/** AVAX with at most 4 decimals, rounded down, decimal comma: 1500000000000000000n -> "1,5 AVAX". */
export function formatAvax(wei: bigint): string {
  const [whole, frac = ''] = formatUnits(wei, 18).split('.');
  const cut = frac.slice(0, 4).replace(/0+$/, '');
  return `${whole}${cut ? `,${cut}` : ''} AVAX`;
}

import { parseUsdc } from 'sdk';

const UNIT = 1_000_000n;

/** Base units to a plain decimal string with a dot and no trailing zeros: 6575342n -> "6.575342", 600000000n -> "600". */
export function toDecimal(units: bigint): string {
  const whole = units / UNIT;
  const frac = (units % UNIT).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/**
 * Tool amounts arrive as JSON numbers or strings. Returns base units, or undefined when the
 * value is negative, malformed, in exponent notation or has more than 6 decimals (never rounds).
 */
export function amountToUnits(v: number | string): bigint | undefined {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) return undefined;
    const s = String(v);
    return s.includes('e') ? undefined : parseUsdc(s);
  }
  return parseUsdc(v);
}

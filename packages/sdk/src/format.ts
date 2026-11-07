/** USDC / VND parsing and vi-VN display (docs/02 section 7 rule 4). USDC has 6 decimals. */
const UNIT = 1_000_000n;
const nf = new Intl.NumberFormat('vi-VN');

/**
 * Parse a decimal USDC string ("100", "6,575342", "6.5") into base units.
 * Returns undefined for empty, negative, malformed or more than 6 decimals.
 */
export function parseUsdc(input: string): bigint | undefined {
  const s = input.trim().replace(',', '.');
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(s);
  if (!m) return undefined;
  return BigInt(m[1]!) * UNIT + BigInt((m[2] ?? '').padEnd(6, '0') || '0');
}

/** "288,48 USDC" style number without unit: dot grouping, comma decimal, trailing zeros trimmed (min 2 decimals). */
export function formatUsdcNumber(units: bigint): string {
  const whole = units / UNIT;
  let frac = (units % UNIT).toString().padStart(6, '0').replace(/0+$/, '');
  if (frac.length === 0) return nf.format(whole);
  if (frac.length < 2) frac = frac.padEnd(2, '0');
  return `${nf.format(whole)},${frac}`;
}

/** Amount with unit, as required by the Definition of Done: "288,48 USDC". */
export function formatUsdc(units: bigint): string {
  return `${formatUsdcNumber(units)} USDC`;
}

/** VND for a USDC amount at a configured rate, rounded down: "13.000.000 đ". Always label as reference. */
export function usdcToVnd(units: bigint, vndPerUsdc: number): bigint {
  return (units * BigInt(Math.round(vndPerUsdc))) / UNIT;
}

export function formatVnd(vnd: bigint): string {
  return `${nf.format(vnd)} đ`;
}

/** Basis points as percent: 2000 -> "20%", 1050 -> "10,5%". */
export function formatBps(bps: bigint | number): string {
  const v = BigInt(bps);
  const whole = v / 100n;
  const rest = (v % 100n).toString().padStart(2, '0').replace(/0+$/, '');
  return rest ? `${whole},${rest}%` : `${whole}%`;
}

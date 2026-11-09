import { parseUsdc } from 'sdk';
import type { Terms } from '@/lib/hui-calc';

/** Form state is kept as strings so people can type freely; `validateForm` turns it into numbers. */
export interface FormState {
  mode: 'bidding' | 'fixed';
  n: string;
  c: string;
  periodDays: string;
  alpha: string; // percent
  commission: boolean;
  fee: string; // percent
  reserve: string; // percent
  bond: string; // USDC
}

export const DEFAULTS: FormState = {
  mode: 'bidding',
  n: '5',
  c: '100',
  periodDays: '30',
  alpha: '20',
  commission: true,
  fee: '1',
  reserve: '1',
  bond: '0',
};

export type FieldName = 'n' | 'c' | 'periodDays' | 'alpha' | 'fee' | 'reserve' | 'bond';

export interface Valid {
  n: bigint;
  c: bigint;
  periodDays: bigint;
  alphaBps: bigint;
  feeBps: bigint;
  reserveBps: bigint;
  bond: bigint;
}

const MAX_C = 10_000_000_000n; // 10.000 USDC on testnet (docs/03 section 3.1)

/** "20" or "0,5" to basis points, or undefined. */
export function parsePercentBps(input: string): bigint | undefined {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return undefined;
  return BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0') || '0');
}

const parseInt10 = (s: string): bigint | undefined => (/^\d{1,3}$/.test(s.trim()) ? BigInt(s.trim()) : undefined);

/** Messages follow the InvalidParams table (docs/05 section 4.3). */
export function validateForm(f: FormState): { value?: Valid; errors: Partial<Record<FieldName, string>> } {
  const errors: Partial<Record<FieldName, string>> = {};
  const n = parseInt10(f.n);
  if (n === undefined || n < 3n || n > 30n) errors.n = 'Số phần phải từ 3 đến 30.';
  const c = parseUsdc(f.c);
  if (c === undefined || c < 1_000_000n || c > MAX_C) errors.c = 'Mức góp phải từ 1 đến 10.000 USDC.';
  const periodDays = parseInt10(f.periodDays);
  if (periodDays === undefined || periodDays < 1n || periodDays > 31n) errors.periodDays = 'Kỳ phải từ 1 đến 31 ngày.';
  const alphaBps = parsePercentBps(f.alpha);
  if (alphaBps === undefined || alphaBps > 10_000n) errors.alpha = 'Tiền giữ lại phải từ 0% đến 100%.';
  let feeBps = 0n;
  if (f.commission) {
    const v = parsePercentBps(f.fee);
    if (v === undefined || v > 300n) errors.fee = 'Tiền công chủ hụi phải từ 0% đến 3%.';
    else feeBps = v;
  }
  const reserveBps = parsePercentBps(f.reserve);
  if (reserveBps === undefined || reserveBps > 300n) errors.reserve = 'Quỹ dự phòng phải từ 0% đến 3%.';
  const bond = parseUsdc(f.bond);
  if (bond === undefined) errors.bond = 'Nhập ký quỹ bằng số, ví dụ 480.';
  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    value: {
      n: n!,
      c: c!,
      periodDays: periodDays!,
      alphaBps: alphaBps!,
      feeBps,
      reserveBps: reserveBps!,
      bond: bond!,
    },
  };
}

/** The rules of a valid form as `Terms` for the pure calculations (fairness meter, risk table). */
export function termsOf(f: FormState, v: Valid): Terms {
  return {
    mode: f.mode,
    n: v.n,
    c: v.c,
    periodDays: v.periodDays,
    alphaBps: v.alphaBps,
    feeBps: v.feeBps,
    reserveBps: v.reserveBps,
    capBps: f.mode === 'fixed' ? 0n : 2000n,
  };
}

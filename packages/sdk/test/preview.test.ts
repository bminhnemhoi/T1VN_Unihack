import { describe, expect, it } from 'vitest';
import { formatBps, formatUsdc, formatVnd, parseUsdc, usdcToVnd } from '../src/format';
import { previewCircle } from '../src/preview';

const USDC = (n: number) => BigInt(n) * 1_000_000n;
const base = { n: 5n, c: USDC(100), periodDays: 30n, alphaBps: 2000n, bond: 0n, capBps: 2000n };

describe('previewCircle (docs/02 AC-01.x)', () => {
  it('AC-01.1: bond 480 gives 100% with peak exposure 600', () => {
    const p = previewCircle({ ...base, bond: USDC(480) });
    expect(p.maxExposure).toBe(USDC(600));
    expect(p.coverageBps).toBe(10_000n);
    expect(p.bondFor100).toBe(USDC(480));
    expect(p.canActivate).toBe(true);
  });

  it('AC-01.2: bond 0 gives 20% and needs 180 USDC more', () => {
    const p = previewCircle(base);
    expect(p.coverageBps).toBe(2000n);
    expect(p.canActivate).toBe(false);
    expect(p.bondMissing).toBe(USDC(180));
    expect(previewCircle({ ...base, bond: USDC(180) }).canActivate).toBe(true);
  });

  it('AC-01.3: bid ceilings per round', () => {
    const rows = previewCircle(base).bidRows;
    expect(rows.map((r) => r.maxBid)).toEqual([6575342n, 4931506n, 3287671n, 1643835n, 0n]);
    expect(rows.map((r) => r.payers)).toEqual([4, 3, 2, 1, 0]);
  });

  it('alpha alone at or above the minimum needs no bond', () => {
    const p = previewCircle({ ...base, alphaBps: 6000n });
    expect(p.bondForMin).toBe(0n);
    expect(p.bondMissing).toBe(0n);
    expect(p.canActivate).toBe(true);
  });
});

describe('format', () => {
  it('parses USDC input, comma or dot', () => {
    expect(parseUsdc('100')).toBe(USDC(100));
    expect(parseUsdc('6,575342')).toBe(6_575_342n);
    expect(parseUsdc(' 0.5 ')).toBe(500_000n);
    for (const bad of ['', '-1', '1.1234567', 'abc', '1,2,3']) expect(parseUsdc(bad)).toBeUndefined();
  });

  it('formats vi-VN with unit', () => {
    expect(formatUsdc(288_480_000n)).toBe('288,48 USDC');
    expect(formatUsdc(6_575_342n)).toBe('6,575342 USDC');
    expect(formatUsdc(USDC(1000))).toBe('1.000 USDC');
    expect(formatUsdc(500_000n)).toBe('0,50 USDC');
    expect(formatUsdc(0n)).toBe('0 USDC');
  });

  it('converts to VND and formats percent', () => {
    expect(formatVnd(usdcToVnd(USDC(500), 26_000))).toBe('13.000.000 đ');
    expect(formatBps(2000)).toBe('20%');
    expect(formatBps(1050)).toBe('10,5%');
  });
});

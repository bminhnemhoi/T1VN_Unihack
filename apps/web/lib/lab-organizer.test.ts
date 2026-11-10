import { describe, expect, it } from 'vitest';
import { loadLab } from './lab-data';
import { buildEconomics, buildSybil, economicsFor } from './lab-organizer';

const cell = (schedule: string, periodDays: number, members: number, net: number) => ({
  schedule,
  periodDays,
  members,
  shareBps: 0,
  feeBps: 100,
  bondUsdc: 480,
  grossFeeUsdc: 20,
  expectedLossUsdc: 13,
  netAfterRiskUsdc: net,
  annualReturnPctByHazardScale: { '1': 1.5, '0.5': null },
  firstSeatNetUsdc: -7,
  lastSeatNetUsdc: -2,
  lastThirdNeverLoses: false,
  insideInterestCap: false,
});
const file = { C: 100, alphaBps: 2000, bidPctOfCap: 50, risk: { early: 0.0204, late: 0.0059, scales: [1, 0.5] }, cells: [cell('A', 30, 10, 1), cell('B', 30, 10, 2), cell('A', 7, 5, 3)] };

describe('organizer lab data', () => {
  it('builds the periods, member counts and the cells of one chart in file order', () => {
    const e = buildEconomics(file)!;
    expect(e.periods).toEqual([7, 30]);
    expect(e.members).toEqual([5, 10]);
    expect(economicsFor(e, 30, 10).map((c) => c.schedule)).toEqual(['A', 'B']);
    expect(economicsFor(e, 7, 10)).toEqual([]);
  });

  it('refuses a malformed or empty file instead of drawing nothing useful', () => {
    expect(buildEconomics({ ...file, cells: [] })).toBeUndefined();
    expect(buildEconomics({ cells: [{ nope: 1 }] })).toBeUndefined();
    expect(buildEconomics(undefined)).toBeUndefined();
    expect(buildSybil({ N: 5, C: 100, alphaBps: 2000, cases: [] })).toBeUndefined();
    expect(buildSybil('x')).toBeUndefined();
  });

  it('reads the real outputs: the three dummy-wallet cases of docs/03 section 7.3 and 24 earnings cells', () => {
    const lab = loadLab();
    expect(lab.sybil?.cases.map((c) => [c.label, c.organizerNetUsdc, c.uncoveredUsdc, c.lastReceiverPayoutUsdc])).toEqual([
      ['1 ví ảo, CI 100%', -18.038354, 0, 392],
      ['2 ví ảo, CI 100%', 41.472772, 56.558906, 336.572274],
      ['1 ví ảo, CI 50% (luật v1.1)', 120.756588, 120.505645, 297.682223],
    ]);
    expect(lab.economics?.cells).toHaveLength(24);
    const month10 = economicsFor(lab.economics!, 30, 10);
    expect(month10.map((c) => c.shareBps)).toEqual([0, 3333, 5000]);
    expect(month10[2]?.annualReturnPctByHazardScale['1']).toBeCloseTo(5.241375, 6);
    expect(month10.map((c) => c.insideInterestCap)).toEqual([false, true, true]);
  });
});

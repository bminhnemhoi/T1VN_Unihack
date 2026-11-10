import { describe, expect, it } from 'vitest';
import { bidQuote, capOf, fairness, riskTable, roundSplit, sampleBids, settleCleanCircle, simulateDefaults, type Terms } from './hui-calc';

const U = 1_000_000n;
const usdc = (whole: number, cents = 0): bigint => BigInt(whole) * U + BigInt(cents) * 10_000n;

/** docs/03 section 8: N = 5, C = 100, P = 30 days, alpha 20%, fee 1%, reserve 1%. */
const WORKED: Terms = { mode: 'bidding', n: 5n, c: usdc(100), periodDays: 30n, alphaBps: 2000n, feeBps: 100n, reserveBps: 100n, capBps: 2000n };
const FIXED: Terms = { ...WORKED, mode: 'fixed', capBps: 0n };

describe('roundSplit (docs/03 section 8)', () => {
  it('round 1, bid 6: pot 376, payout 288,48, holdback 80', () => {
    const s = roundSplit(WORKED, 1, usdc(6));
    expect(s.pot).toBe(usdc(376));
    expect(s.fee).toBe(usdc(3, 76));
    expect(s.premium).toBe(usdc(3, 76));
    expect(s.holdback).toBe(usdc(80));
    expect(s.payout).toBe(usdc(288, 48));
  });
  it('round 2, bid 3: pot 391, payout 323,18, holdback 60', () => {
    const s = roundSplit(WORKED, 2, usdc(3));
    expect(s.pot).toBe(usdc(391));
    expect(s.holdback).toBe(usdc(60));
    expect(s.payout).toBe(usdc(323, 18));
  });
  it('INV-05: payout + fee + premium + holdback == pot for any round and bid', () => {
    for (let k = 1; k <= 5; k++) {
      for (const b of [0n, usdc(1), usdc(3, 50)]) {
        const s = roundSplit(WORKED, k, b);
        expect(s.payout + s.fee + s.premium + s.holdback).toBe(s.pot);
      }
    }
  });
});

describe('bidQuote', () => {
  it('round 1, bid 6: interest 24, rate 1,5%/month by the cap yardstick; cap is 6,575342', () => {
    const q = bidQuote(WORKED, 1, usdc(6));
    expect(q.cap).toBe(6_575_342n);
    expect(q.problem).toBeUndefined();
    expect(q.interest).toBe(usdc(24));
    expect(q.interestRateBpsPerMonth).toBe(150n);
    expect(q.laterPayments).toBe(usdc(400));
    expect(q.payout).toBe(usdc(288, 48));
  });
  it('the all-in rate is higher than the interest-only rate and flags nothing when the bid is fine', () => {
    const q = bidQuote(WORKED, 1, usdc(6));
    expect(q.allInRateBpsPerMonth!).toBeGreaterThan(q.interestRateBpsPerMonth!);
  });
  it('over the ceiling is flagged, and a bid of C or more is flagged first', () => {
    expect(bidQuote(WORKED, 1, usdc(7)).problem).toBe('over-cap');
    expect(bidQuote(WORKED, 1, usdc(100)).problem).toBe('at-least-c');
  });
  it('last round has no live payers, so no interest and no rate', () => {
    const q = bidQuote(WORKED, 5, 0n);
    expect(q.interest).toBe(0n);
    expect(q.interestRateBpsPerMonth).toBeUndefined();
  });
});

describe('fairness', () => {
  it('a Fixed circle is equal for every seat: each loses only the commission', () => {
    const f = fairness(FIXED, 0n, 0n);
    const nets = new Set(f.seats.map((s) => s.net));
    expect(nets.size).toBe(1);
    expect(f.spread).toBe(0n);
    expect(f.seats[0]!.net).toBe(-usdc(4)); // 1% of a 400 USDC pot
  });
  it('bidding at the ceiling makes early seats pay and late seats gain; the sum is minus the commission', () => {
    const f = fairness(WORKED, usdc(480), 10_000n);
    expect(f.seats[0]!.net).toBeLessThan(0n);
    expect(f.seats[4]!.net).toBeGreaterThan(0n);
    const sum = f.seats.reduce((a, s) => a + s.net, 0n);
    expect(f.spread).toBeGreaterThan(0n);
    // reserve is split with floor division, so the sum is minus the fee up to dust (< n units)
    expect(-f.totalFee - sum >= 0n && -f.totalFee - sum < 5n).toBe(true);
  });
  it('warns when the weekly ceiling is tiny (report section 6 item 7)', () => {
    const weekly = fairness({ ...WORKED, periodDays: 7n }, 0n, 0n);
    expect(weekly.warnings.join(' ')).toMatch(/Trần thăm kỳ 1 chỉ bằng/);
    expect(fairness(WORKED, 0n, 0n).warnings).toEqual([]);
  });
  it('organizer return per year is computed from the commission and the bond', () => {
    const f = fairness(WORKED, usdc(480), 0n);
    expect(f.organizerReturnBpsPerYear).toBeGreaterThan(0n);
    expect(fairness(WORKED, 0n, 0n).organizerReturnBpsPerYear).toBeUndefined();
  });
});

describe('riskTable and simulateDefaults (docs/03 section 7.3)', () => {
  it('sequential stops of the worked circle leave 304 USDC uncovered in round 5 and bond 60 after round 4', () => {
    const run = simulateDefaults(WORKED, usdc(480), (j) => (j < 5 ? j + 1 : undefined));
    expect(run.uncovered.map((u) => u / U)).toEqual([0n, 0n, 0n, 0n, 304n]);
    expect(run.bondAfter[3]).toBe(usdc(60));
  });
  it('branch B: the round-1 receiver (M4) stops after round 1 -> bond 460, 360, 260, 160', () => {
    const run = simulateDefaults(WORKED, usdc(480), (j) => (j === 1 ? 2 : undefined));
    expect(run.bondAfter.map((b) => b / U)).toEqual([480n, 460n, 360n, 260n, 160n]);
    expect(run.uncovered.every((u) => u === 0n)).toBe(true);
  });
  it('with 100% coverage the simultaneous shock is fully covered at any moment (INV-08); sequential is not', () => {
    const t = riskTable(WORKED, usdc(480));
    expect(t.rows.every((r) => r.together === 0n)).toBe(true);
    expect(t.tolerated).toBe(4);
    expect(t.rows[4]!.worst).toBe(usdc(304));
    expect(t.sequentialExceedsBond).toBe(true);
  });
  it('with no bond the circle tolerates fewer stops and the table shows real losses', () => {
    const t = riskTable(WORKED, 0n);
    expect(t.tolerated).toBeLessThan(4);
    expect(t.rows.some((r) => r.together > 0n)).toBe(true);
  });
});

describe('settleCleanCircle', () => {
  const t: Terms = { mode: 'bidding', n: 8n, c: usdc(50), periodDays: 30n, alphaBps: 2000n, feeBps: 100n, reserveBps: 100n, capBps: 2000n };
  const winners = [5, 2, 7, 0, 3, 6, 1, 4];
  const bids = sampleBids(t, 70n);
  const s = settleCleanCircle({ terms: t, winnerByRound: winners, bids, bond: usdc(640) });

  it('sample bids stay under every ceiling', () => {
    bids.forEach((b, i) => expect(b).toBeLessThanOrEqual(capOf(t, i + 1)));
  });
  it('conserves money: the sum of every member net is minus the organizer commission', () => {
    const sum = s.members.reduce((a, m) => a + m.net, 0n);
    expect(sum).toBe(-s.feesToOrganizer);
  });
  it('the reserve is paid out in full', () => {
    expect(s.members.reduce((a, m) => a + m.reward, 0n)).toBe(s.reserveTotal);
  });
  it('the last receiver pays no interest and gets the most interest', () => {
    const last = s.members[winners[7]!]!;
    expect(last.interestPaid).toBe(0n);
    expect(last.interestReceived).toBeGreaterThan(s.members[winners[0]!]!.interestReceived);
  });
});

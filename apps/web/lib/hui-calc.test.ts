import { describe, expect, it } from 'vitest';
import { bidQuote, capOf, commissionSchedule, fairness, lateRewardLoss, reserveEstimate, startingBid, riskTable, roomOf, roundSplit, sampleBids, settleCleanCircle, simulateDefaults, type Terms } from './hui-calc';

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

describe('commission inside the interest cap (docs/03 section 2.7, 8.1)', () => {
  const PHI: Terms = { ...WORKED, feeBps: 300n, shareBps: 5000n };

  it('enforced ceilings are half the statutory ones (8.1 table)', () => {
    expect(capOf(PHI, 1)).toBe(3_287_671n);
    expect(capOf(PHI, 2)).toBe(2_465_753n);
    expect(capOf(PHI, 4)).toBe(821_917n);
    expect(capOf(PHI, 5)).toBe(0n);
    expect(PHI.shareBps && capOf(WORKED, 1)).toBe(6_575_342n); // phi = 0 keeps the old ceiling
  });
  it('schedule: room, share of room and the 3% pot cap per round', () => {
    const rows = commissionSchedule(PHI);
    expect(rows.map((r) => r.room)).toEqual([26_301_368n, 14_794_518n, 6_575_342n, 1_643_835n, 0n]);
    // round 1: min(13,150684 ; 3% x 400 = 12) = 12 at the largest pot; round 2: phi x room = 7,397259
    expect(rows[0]!.fee).toBe(usdc(12));
    expect(rows[1]!.fee).toBe(7_397_259n);
    expect(rows[4]!.fee).toBe(0n);
  });
  it('vector 8.1 round 1: bid 3 -> fee 11,64, payout 292,48; round 2: bid 2,4 -> fee 7,397259, payout 321,474741', () => {
    const r1 = roundSplit(PHI, 1, usdc(3));
    expect(r1.pot).toBe(usdc(388));
    expect(r1.fee).toBe(usdc(11, 64));
    expect(r1.payout).toBe(usdc(292, 48));
    const r2 = roundSplit(PHI, 2, 2_400_000n);
    expect(r2.fee).toBe(7_397_259n);
    expect(r2.payout).toBe(321_474_741n);
  });
  it('organizer leg: no commission, the payout grows by the fee (8.1: 328,872)', () => {
    const r2 = roundSplit(PHI, 2, 2_400_000n, 0n, true);
    expect(r2.fee).toBe(0n);
    expect(r2.payout).toBe(328_872_000n);
  });
  it('INV-11: fee + bid x payers never exceeds the room, for every round and any bid up to the ceiling', () => {
    for (const phi of [0n, 1000n, 5000n]) {
      const t = { ...WORKED, feeBps: 300n, shareBps: phi };
      for (let k = 1; k <= 5; k++) {
        for (const b of [0n, capOf(t, k) / 2n, capOf(t, k)]) {
          const s = roundSplit(t, k, b);
          if (phi > 0n) expect(s.fee + b * BigInt(s.livePayers)).toBeLessThanOrEqual(roomOf(t, k)); // phi = 0 keeps the fixed fee: INV-11 is phi > 0 only
          expect(s.fee).toBeLessThanOrEqual((s.pot * 300n) / 10_000n);
          expect(s.payout + s.fee + s.premium + s.holdback).toBe(s.pot);
        }
      }
    }
  });
  it('a bid above the enforced ceiling is flagged and the quote shows both ceilings', () => {
    const q = bidQuote(PHI, 1, usdc(4));
    expect(q.problem).toBe('over-cap');
    expect(q.cap).toBe(3_287_671n);
    expect(q.statutoryCap).toBe(6_575_342n);
  });
  it('a Fixed circle never gets phi (no bids, no room)', () => {
    const t: Terms = { ...FIXED, shareBps: 5000n };
    expect(roundSplit(t, 1, 0n).fee).toBe(usdc(4));
  });
  it('warns when the whole-circle commission is under 2% of the bond (weekly, small)', () => {
    const weekly: Terms = { ...PHI, periodDays: 7n };
    expect(fairness(weekly, usdc(480), 0n).warnings.join(' ')).toMatch(/chưa tới 2% ký quỹ/);
    expect(fairness(PHI, usdc(480), 0n).warnings.join(' ')).not.toMatch(/chưa tới 2% ký quỹ/);
  });
});

describe('on-time reserve split (ADR-24, vector V1)', () => {
  it('M4, one late round, reserve 19,697396: now 3,939479, after 3,110115, loss 829364', () => {
    const l = lateRewardLoss(5n, 0n, 19_697_396n);
    expect(l.now).toBe(3_939_479n);
    const m4 = lateRewardLoss(5n, 1n, 19_697_396n);
    expect(m4.now).toBe(3_110_115n);
    expect(l.after).toBe(3_110_115n);
    expect(l.loss).toBe(829_364n);
  });
  it('the reserve estimate adds the premium of every round to come', () => {
    expect(reserveEstimate(WORKED, 2, usdc(7, 67))).toBe(usdc(7, 67) + 3n * usdc(4));
  });
  it('a member already at weight 0 loses nothing more', () => {
    expect(lateRewardLoss(5n, 4n, usdc(20)).loss).toBe(0n);
  });
});

describe('startingBid', () => {
  it('2 USDC when the ceiling allows, otherwise half the ceiling in whole cents', () => {
    expect(startingBid(3_287_671n)).toBe('2');
    expect(startingBid(328_767n)).toBe('0,16');
    expect(startingBid(5_000n)).toBe('0,005'); // half is under a cent: fall back to the ceiling
    expect(startingBid(0n)).toBe('0');
  });
});

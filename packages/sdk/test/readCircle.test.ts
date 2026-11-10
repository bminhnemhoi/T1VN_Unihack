import type { PublicClient } from 'viem';
import { describe, expect, it } from 'vitest';
import { readCircle } from '../src/read';

const circle = '0xcccccccccccccccccccccccccccccccccccccccc' as const;
const org = '0x1111111111111111111111111111111111111111' as const;
const m1 = '0x2222222222222222222222222222222222222222' as const;
const m2 = '0x3333333333333333333333333333333333333333' as const;
const stray = '0x4444444444444444444444444444444444444444' as const;
const viewer = '0x5555555555555555555555555555555555555555' as const;
const registry = '0x6666666666666666666666666666666666666666' as const;
const hash = `0x${'ab'.repeat(32)}` as const;

const params = {
  mode: 1,
  memberCount: 3,
  contribution: 10_000_000n,
  periodSeconds: 2_592_000,
  roundDuration: 180,
  commitWindow: 90,
  revealWindow: 60,
  graceSeconds: 120,
  alphaBps: 2000,
  commissionMode: true,
  feeBps: 300,
  reserveBps: 100,
  revealBondBps: 100,
  capBps: 2000,
  joinDeadline: 1_900_000_000n,
  organizerIsMember: false,
  label: `0x${Buffer.from('Day test').toString('hex').padEnd(64, '0')}`,
  commissionShareBps: 5000,
  termsHash: hash,
};

type Ev = { eventName: string; args: Record<string, unknown>; blockNumber: bigint; logIndex: number; transactionHash: `0x${string}` };
const ev = (eventName: string, args: Record<string, unknown>, logIndex: number): Ev => ({
  eventName,
  args,
  blockNumber: 5n,
  logIndex,
  transactionHash: hash,
});

function client(): PublicClient {
  const events: Ev[] = [
    // Round 1: m1 short 10; 4 from holdback, 3 from bond, 2 from reserve, 1 uncovered.
    ev('ContributionShortfall', { round: 1, member: m1, amount: 10_000_000n }, 0),
    ev('ShortfallCovered', { round: 1, member: m1, source: 0, amount: 4_000_000n }, 1),
    ev('ShortfallCovered', { round: 1, member: m1, source: 1, amount: 3_000_000n }, 2),
    ev('ShortfallCovered', { round: 1, member: m1, source: 2, amount: 2_000_000n }, 3),
    ev('ShortfallCovered', { round: 1, member: m1, source: 3, amount: 1_000_000n }, 4),
    ev('PaymentDeferred', { to: stray, amount: 7_000_000n }, 5),
  ];
  const claimable: Record<string, bigint> = { [stray]: 7_000_000n, [viewer]: 2_000_000n };
  const read = (a: { functionName: string; args?: readonly unknown[] }): unknown => {
    switch (a.functionName) {
      case 'params': return params;
      case 'state': return 1;
      case 'organizer': return org;
      case 'startTime': return 1_800_000_000n;
      case 'pausedTotal': return 0n;
      case 'settledRounds': return 1;
      case 'bondDeposited': return 60_000_000n;
      case 'bondRemaining': return 57_000_000n;
      case 'reserve': return 1_000_000n;
      case 'totalHoldback': return 0n;
      case 'coverageIndexBps': return 10_000n;
      case 'guaranteedCoverageBps': return 10_000n;
      case 'requiredAllowance': return 20_200_000n;
      case 'revealBond': return 100_000n;
      case 'minCoverageBps': return 10_000;
      case 'lateRateBps': return 1000;
      case 'currentRound': return 2;
      case 'phase': return 1;
      case 'reputation': return registry;
      case 'members': return [m1, m2];
      case 'memberInfo': return { joined: true, received: false, defaulted: false, joinIndex: 0, receivedRound: 0, lateCount: 0, holdback: 0n, debt: 0n };
      case 'reputationOf': return { completed: 0, onTime: 0, late: 0, defaults: 0, repaid: 0 };
      case 'roundStart': return 1_800_000_000n;
      case 'deadline': return 1_800_000_180n;
      case 'roundInfo': return { winner: m2, winningBid: 0n, pot: 0n, payout: 0n, holdback: 0n, fee: 0n, premium: 0n, uncovered: 1_000_000n, settledAt: 1_800_000_200n };
      case 'maxBid': return 1_000_000n;
      case 'shortfallOf': return { amount: 10_000_000n, fromHoldback: 0n, fromBond: 0n, fromReserve: 0n, uncovered: 0n, since: 1_800_000_200n, resolved: true };
      case 'claimable': return claimable[String(a.args?.[0])] ?? 0n;
      default: throw new Error(`unexpected read ${a.functionName}`);
    }
  };
  return {
    readContract: async (a: { functionName: string; args?: readonly unknown[] }) => read(a),
    getBlockNumber: async () => 5n,
    getContractEvents: async () => events,
  } as unknown as PublicClient;
}

describe('readCircle: A14 extra data', () => {
  it('adds bondDeposited, revealBond, minCoverageBps and the v1.2 params without touching the existing fields', async () => {
    const v = await readCircle(client(), circle);
    expect(v.bondDeposited).toBe(60_000_000n);
    expect(v.bondRemaining).toBe(57_000_000n);
    expect(v.revealBond).toBe(100_000n);
    expect(v.minCoverageBps).toBe(10_000);
    expect(v.params.commissionShareBps).toBe(5000);
    expect(v.params.termsHash).toBe(hash);
    expect(v.params.N).toBe(3);
    expect(v.requiredAllowance).toBe(20_200_000n);
  });

  it('keeps the original cover amounts per source even after the shortfall is fully repaid', async () => {
    const v = await readCircle(client(), circle);
    const sf = v.rounds[0]!.shortfalls[0]!;
    expect(sf.resolved).toBe(true);
    expect([sf.fromHoldback, sf.fromBond, sf.fromReserve, sf.uncovered]).toEqual([0n, 0n, 0n, 0n]); // what is left to restore
    expect(sf.covered).toEqual({ holdback: 4_000_000n, bond: 3_000_000n, reserve: 2_000_000n, uncovered: 1_000_000n });
  });

  it('lists non-zero claimable balances by lowercase address: deferred payees and the viewer, no zero entries', async () => {
    const v = await readCircle(client(), circle, { viewer });
    expect(v.claimable).toEqual({ [stray]: 7_000_000n, [viewer]: 2_000_000n });
    const without = await readCircle(client(), circle);
    expect(without.claimable).toEqual({ [stray]: 7_000_000n });
  });
});

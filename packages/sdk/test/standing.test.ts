import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';

const A = (n: number): `0x${string}` => `0x${n.toString(16).padStart(40, '0')}`;
const FACTORY = A(1);
const REGISTRY = A(2);
const ME = A(50);

const h = vi.hoisted(() => ({ circles: [] as `0x${string}`[], eventCalls: [] as string[], listCalls: 0 }));

vi.mock('../src/read', () => ({
  listCircles: vi.fn(async (_c: unknown, _f: unknown, opts: { organizer?: string } = {}) => {
    h.listCalls++;
    return opts.organizer ? h.circles.slice(0, 1) : h.circles;
  }),
  reputationOf: vi.fn(async () => ({ completed: 1, onTime: 4, late: 0, defaults: 0, repaid: 0 })),
  getCircleEvents: vi.fn(async (_c: unknown, circle: string) => {
    h.eventCalls.push(circle);
    return [{ eventName: 'MemberJoined', args: { member: ME }, blockNumber: 100n, logIndex: 0, transactionHash: '0x00' }];
  }),
}));

import { readMemberStanding, readOrganizerStanding } from '../src/standing';

/** A node whose `memberInfo` answers after a tick, so the test can see how many reads are in flight at once. */
function node(joinedIn: Set<string>, debts: Record<string, bigint> = {}) {
  let inFlight = 0;
  let maxInFlight = 0;
  const client = {
    readContract: async ({ address }: { address: string }) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return { joined: joinedIn.has(address), debt: debts[address] ?? 0n };
    },
    getBlock: async () => ({ timestamp: 1_800_000_000n }),
  } as unknown as PublicClient;
  return { client, maxInFlight: () => maxInFlight };
}

const o = { factory: FACTORY, registry: REGISTRY, nowSec: 1_800_100_000 };

describe('standing readers (display only)', () => {
  beforeEach(() => {
    h.circles = [A(10), A(11), A(12), A(13)];
    h.eventCalls = [];
    h.listCalls = 0;
  });

  it('member standing: sums debt of the circles the wallet joined, reads events only for those, one at a time', async () => {
    const n = node(new Set([A(10), A(12)]), { [A(10)]: 3n, [A(12)]: 4n, [A(11)]: 99n });
    const r = await readMemberStanding(n.client, ME, o);
    expect(r.input.unpaidDebt).toBe(7n); // the circle it never joined (A(11)) does not count
    expect(r.input.completed).toBe(1);
    expect(r.input.firstEventAt).toBe(1_800_000_000);
    expect(h.eventCalls).toEqual([A(10), A(12)]); // getLogs stay sequential and in circle order (RPC throttling, A18)
  });

  it('member standing: the memberInfo reads of the circles run side by side, not one after another', async () => {
    const n = node(new Set(h.circles));
    await readMemberStanding(n.client, ME, o);
    expect(n.maxInFlight()).toBeGreaterThan(1);
  });

  it('a wallet in no circle has no debt and no first event', async () => {
    const r = await readMemberStanding(node(new Set()).client, ME, o);
    expect(r.input.unpaidDebt).toBe(0n);
    expect(r.input.firstEventAt).toBeUndefined();
    expect(h.eventCalls).toEqual([]);
  });

  it('organizer standing: reads the organizer events and its own member standing, and flags an unpaid default', async () => {
    const n = node(new Set([A(10)]), { [A(10)]: 5n });
    const r = await readOrganizerStanding(n.client, ME, o);
    expect(r.input.unpaidDefault).toBe(true);
    expect(r.input.firstCircleAt).toBe(1_800_000_000);
    expect(r.input.finishedCircles).toBe(0);
  });

  it('organizer standing with no debt: no unpaid default', async () => {
    const r = await readOrganizerStanding(node(new Set([A(10)])).client, ME, o);
    expect(r.input.unpaidDefault).toBe(false);
  });
});

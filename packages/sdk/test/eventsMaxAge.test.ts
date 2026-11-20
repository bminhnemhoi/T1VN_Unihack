import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { getCircleEvents } from '../src/read';

const circle = '0xABA89dFfA4e157927710419b01C32bD307bF2461' as const;
const other = '0x61c36a8d610163660E21a8b7359e1Cac0C9133e1' as const;

/** A node with a few events at block 10 that counts how often it is asked anything. */
function node() {
  let head = 100n;
  const stats = { blockNumber: 0, getLogs: 0 };
  const client = {
    getBlockNumber: async () => {
      stats.blockNumber++;
      return head;
    },
    getContractEvents: async () => {
      stats.getLogs++;
      return [{ eventName: 'MemberJoined', args: { member: '0x01' }, blockNumber: 10n, logIndex: 0, transactionHash: '0xaa' }];
    },
  } as unknown as PublicClient;
  return { client, stats, moveHead: (n: bigint) => (head += n) };
}

const opts = { fromBlock: 0n, fromCreation: false } as const;

describe('getCircleEvents maxAgeMs (display-only readers asking in a burst)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_800_000_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it('reuses a fresh enough scan without asking the node at all, and returns copies', async () => {
    const n = node();
    const first = await getCircleEvents(n.client, circle, opts);
    const after = { ...n.stats };
    vi.advanceTimersByTime(1_000);
    const second = await getCircleEvents(n.client, circle, { ...opts, maxAgeMs: 5_000 });
    expect(n.stats).toEqual(after); // no getBlockNumber, no getLogs
    expect(second).toEqual(first);
    second[0]!.timestamp = 123; // callers add fields such as `timestamp`: that must not leak into the cache (shallow copies, as on every path)
    expect((await getCircleEvents(n.client, circle, { ...opts, maxAgeMs: 5_000 }))[0]!.timestamp).toBeUndefined();
  });

  it('scans again once the scan is older than maxAgeMs', async () => {
    const n = node();
    await getCircleEvents(n.client, circle, opts);
    const after = { ...n.stats };
    vi.advanceTimersByTime(5_001);
    await getCircleEvents(n.client, circle, { ...opts, maxAgeMs: 5_000 });
    expect(n.stats.blockNumber).toBe(after.blockNumber + 1);
    expect(n.stats.getLogs).toBeGreaterThan(after.getLogs);
  });

  it('without maxAgeMs nothing changes: every call refreshes (the default for every other reader)', async () => {
    const n = node();
    await getCircleEvents(n.client, circle, opts);
    const after = { ...n.stats };
    await getCircleEvents(n.client, circle, opts);
    expect(n.stats.blockNumber).toBe(after.blockNumber + 1);
    expect(n.stats.getLogs).toBeGreaterThan(after.getLogs);
  });

  it('never skips the first read of a circle, and never shares a scan between two circles', async () => {
    const n = node();
    await getCircleEvents(n.client, circle, { ...opts, maxAgeMs: 60_000 });
    expect(n.stats.getLogs).toBeGreaterThan(0);
    const before = n.stats.getLogs;
    await getCircleEvents(n.client, other, { ...opts, maxAgeMs: 60_000 });
    expect(n.stats.getLogs).toBeGreaterThan(before);
  });

  it('asking for timestamps or an earlier start always goes to the node', async () => {
    const n = node();
    (n.client as unknown as { getBlock: () => Promise<{ timestamp: bigint }> }).getBlock = async () => ({ timestamp: 1n });
    await getCircleEvents(n.client, circle, { fromBlock: 50n, fromCreation: false });
    const calls = n.stats.blockNumber;
    await getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false, maxAgeMs: 60_000 }); // earlier start than the cached one
    expect(n.stats.blockNumber).toBe(calls + 1);
    const calls2 = n.stats.blockNumber;
    await getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false, maxAgeMs: 60_000, withTimestamps: true });
    expect(n.stats.blockNumber).toBe(calls2 + 1);
  });
});

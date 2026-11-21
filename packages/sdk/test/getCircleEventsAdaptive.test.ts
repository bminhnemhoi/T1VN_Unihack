import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { EventSourceUnavailableError, getCircleEvents, MAX_SCAN_CALLS } from '../src/read';

const circle = '0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc' as const;

/** A node whose getLogs refuses ranges over `maxRange` blocks (both ends included), like PublicNode (~2000+) or Avalanche (100). */
function node(opts: { latest: bigint; maxRange: bigint; eventBlocks?: bigint[] }) {
  const ok: Array<[bigint, bigint]> = [];
  let calls = 0;
  const client = {
    getBlockNumber: async () => opts.latest,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({ timestamp: 1_800_000_000n + blockNumber }),
    getContractEvents: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      calls++;
      if (toBlock - fromBlock + 1n > opts.maxRange) throw new Error(`block range too large (max ${opts.maxRange})`);
      ok.push([fromBlock, toBlock]);
      return (opts.eventBlocks ?? [])
        .filter((b) => b >= fromBlock && b <= toBlock)
        .map((b) => ({ eventName: 'Tick', args: {}, blockNumber: b, logIndex: 0, transactionHash: `0x${b.toString(16).padStart(64, '0')}` }));
    },
  } as unknown as PublicClient;
  return { client, ok, calls: () => calls };
}

describe('getCircleEvents fallback scan adapts to the RPC and is bounded (issue #14)', () => {
  it('uses large ranges on a node that accepts them: 544k blocks cost a few hundred calls, not 5,442', async () => {
    const n = node({ latest: 544_226n, maxRange: 10_000n, eventBlocks: [10n, 300_000n, 544_000n] }); // PublicNode accepted 10,000 (issue #14)
    const events = await getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false });
    expect(events.map((e) => e.blockNumber)).toEqual([10n, 300_000n, 544_000n]);
    expect(n.calls()).toBeLessThanOrEqual(MAX_SCAN_CALLS);
  });

  it('still works on a node capped at 100 blocks (halves down to 100)', async () => {
    const n = node({ latest: 1_999n, maxRange: 100n, eventBlocks: [1_500n] });
    const events = await getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false });
    expect(events.map((e) => e.blockNumber)).toEqual([1_500n]);
    for (const [a, b] of n.ok) expect(b - a + 1n).toBeLessThanOrEqual(100n);
  });

  it('stops after MAX_SCAN_CALLS with a typed error instead of storming the RPC, then resumes where it stopped', async () => {
    const n = node({ latest: 544_226n, maxRange: 100n, eventBlocks: [5n, 544_100n] });
    await expect(getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false })).rejects.toBeInstanceOf(EventSourceUnavailableError);
    expect(n.calls()).toBeLessThanOrEqual(MAX_SCAN_CALLS);
    const firstRunEnd = n.ok[n.ok.length - 1]![1];
    const before = n.ok.length;
    await expect(getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false })).rejects.toBeInstanceOf(EventSourceUnavailableError);
    // the second call continues near where the first stopped, it does not rescan from block 0
    expect(n.ok[before]![0]).toBeGreaterThan(firstRunEnd - 10n);
  });
});

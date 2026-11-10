import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { circleCreationBlock, FUJI_GETLOGS_MAX_BLOCKS, getCircleEvents } from '../src/read';

const circle = '0xABA89dFfA4e157927710419b01C32bD307bF2461' as const;

/** A node that, like Fuji's public RPC, refuses `getLogs` over more than 100 blocks (both ends included). */
function node(opts: { latest: bigint; createdAt: bigint; archive?: boolean; eventBlocks?: bigint[]; blockTimes?: { calls: number } }) {
  const ranges: Array<[bigint, bigint]> = [];
  let codeCalls = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const client = {
    getBlockNumber: async () => opts.latest,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => {
      if (opts.blockTimes) opts.blockTimes.calls++;
      return { timestamp: 1_800_000_000n + blockNumber };
    },
    getCode: async ({ blockNumber }: { blockNumber: bigint }) => {
      codeCalls++;
      if (opts.archive === false) throw new Error('missing trie node');
      return blockNumber >= opts.createdAt ? '0x6080' : '0x';
    },
    getContractEvents: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      if (toBlock - fromBlock + 1n > FUJI_GETLOGS_MAX_BLOCKS) {
        throw new Error('block range too large: total block range in this request exceeds the maximum of 100 blocks');
      }
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      ranges.push([fromBlock, toBlock]);
      return (opts.eventBlocks ?? [])
        .filter((b) => b >= fromBlock && b <= toBlock)
        .map((b) => ({ eventName: 'Tick', args: {}, blockNumber: b, logIndex: 0, transactionHash: `0x${b.toString(16).padStart(64, '0')}` }));
    },
  } as unknown as PublicClient;
  return { client, ranges, stats: () => ({ codeCalls, maxInFlight }) };
}

describe('getCircleEvents on a node that caps getLogs at 100 blocks (Fuji public RPC, A18)', () => {
  it('never asks for more than 100 blocks, even from block 0 over a long chain', async () => {
    const n = node({ latest: 5_050n, createdAt: 0n, archive: false });
    await getCircleEvents(n.client, circle, { fromBlock: 0n });
    expect(n.ranges.length).toBe(51);
    for (const [a, b] of n.ranges) expect(b - a + 1n).toBeLessThanOrEqual(100n);
  });

  it('starts at the creation block of the circle, found with a few historical eth_getCode calls', async () => {
    const n = node({ latest: 60_850_000n, createdAt: 60_845_400n, eventBlocks: [60_845_400n, 60_845_555n, 60_849_999n] });
    const events = await getCircleEvents(n.client, circle, { fromBlock: 60_843_937n });
    const first = n.ranges.map((r) => r[0]).sort((a, b) => (a < b ? -1 : 1))[0]!;
    expect(first).toBe(60_845_400n);
    expect(n.stats().codeCalls).toBeLessThan(20);
    expect(n.ranges.length).toBe(Math.ceil((60_850_000 - 60_845_400 + 1) / 100));
    expect(events.map((e) => e.blockNumber)).toEqual([60_845_400n, 60_845_555n, 60_849_999n]); // oldest first
  });

  it('falls back to the given fromBlock when the node serves no historical state', async () => {
    const n = node({ latest: 1_000n, createdAt: 600n, archive: false, eventBlocks: [650n] });
    const events = await getCircleEvents(n.client, circle, { fromBlock: 500n });
    expect(Math.min(...n.ranges.map((r) => Number(r[0])))).toBe(500);
    expect(events).toHaveLength(1);
  });

  it('fromCreation: false scans from fromBlock without any eth_getCode', async () => {
    const n = node({ latest: 1_000n, createdAt: 600n });
    await getCircleEvents(n.client, circle, { fromBlock: 500n, fromCreation: false });
    expect(n.stats().codeCalls).toBe(0);
    expect(Math.min(...n.ranges.map((r) => Number(r[0])))).toBe(500);
  });

  it('is sequential by default and never lets two scans of one circle overlap (Fuji counts a whole JSON-RPC batch)', async () => {
    const n = node({ latest: 1_000n, createdAt: 0n });
    await Promise.all([
      getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false }),
      getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false }),
      getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false, withTimestamps: true }),
    ]);
    expect(n.stats().maxInFlight).toBe(1);
  });

  it('keeps the requested concurrency and returns chunks in block order', async () => {
    const n = node({ latest: 3_000n, createdAt: 0n, eventBlocks: [10n, 1_500n, 2_999n] });
    const events = await getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false, concurrency: 3 });
    expect(n.stats().maxInFlight).toBeLessThanOrEqual(3);
    expect(n.stats().maxInFlight).toBeGreaterThan(1);
    expect(events.map((e) => e.blockNumber)).toEqual([10n, 1_500n, 2_999n]);
  });

  it('honours a custom chunk size', async () => {
    const n = node({ latest: 99n, createdAt: 0n });
    await getCircleEvents(n.client, circle, { fromBlock: 0n, fromCreation: false, chunk: 25n });
    expect(n.ranges).toHaveLength(4);
  });
});

describe('circleCreationBlock', () => {
  it('returns low when the circle already existed there, and remembers the answer per client', async () => {
    const n = node({ latest: 1_000n, createdAt: 100n });
    expect(await circleCreationBlock(n.client, circle, 500n, 1_000n)).toBe(500n);
    const m = node({ latest: 1_000n, createdAt: 700n });
    expect(await circleCreationBlock(m.client, circle, 0n, 1_000n)).toBe(700n);
    const before = m.stats().codeCalls;
    expect(await circleCreationBlock(m.client, circle, 0n, 1_000n)).toBe(700n);
    expect(m.stats().codeCalls).toBe(before); // cached
  });

  it('returns low when the circle has no code at the latest block either', async () => {
    const n = node({ latest: 1_000n, createdAt: 5_000n });
    expect(await circleCreationBlock(n.client, circle, 200n, 1_000n)).toBe(200n);
  });
});

describe('getCircleEvents refreshes incrementally (a page polling every few seconds must not rescan, A18)', () => {
  it('the second call reads only the blocks added since the last head (minus a small reorg margin) and merges', async () => {
    const opts = { latest: 1_050n, createdAt: 1_000n, eventBlocks: [1_000n, 1_020n] };
    const n = node(opts);
    const first = await getCircleEvents(n.client, circle, { fromBlock: 0n });
    expect(first.map((e) => e.blockNumber)).toEqual([1_000n, 1_020n]);
    const codeCalls = n.stats().codeCalls;
    n.ranges.length = 0;

    opts.latest = 1_075n;
    opts.eventBlocks = [1_000n, 1_020n, 1_060n];
    const second = await getCircleEvents(n.client, circle, { fromBlock: 0n });
    expect(n.ranges).toEqual([[1_048n, 1_075n]]); // scannedTo 1050 - 2 blocks of margin
    expect(n.stats().codeCalls).toBe(codeCalls); // no new creation search
    expect(second.map((e) => e.blockNumber)).toEqual([1_000n, 1_020n, 1_060n]);

    n.ranges.length = 0;
    const third = await getCircleEvents(n.client, circle, { fromBlock: 0n });
    expect(n.ranges).toEqual([[1_073n, 1_075n]]);
    expect(third).toHaveLength(3); // no duplicates from the re-read margin
  });

  it('an event inside the re-read margin is not duplicated', async () => {
    const opts = { latest: 1_050n, createdAt: 1_000n, eventBlocks: [1_049n] };
    const n = node(opts);
    await getCircleEvents(n.client, circle, { fromBlock: 0n });
    opts.latest = 1_052n;
    const again = await getCircleEvents(n.client, circle, { fromBlock: 0n });
    expect(again).toHaveLength(1);
  });

  it('cache: false rescans everything; a chain that went backwards, or an earlier fromBlock, resets the cache', async () => {
    const opts = { latest: 1_050n, createdAt: 1_000n, eventBlocks: [1_000n] };
    const n = node(opts);
    await getCircleEvents(n.client, circle, { fromBlock: 900n });
    n.ranges.length = 0;
    await getCircleEvents(n.client, circle, { fromBlock: 900n, cache: false });
    expect(Math.min(...n.ranges.map((r) => Number(r[0])))).toBe(1_000);

    n.ranges.length = 0;
    opts.latest = 1_010n; // local node restarted
    await getCircleEvents(n.client, circle, { fromBlock: 900n });
    expect(Math.min(...n.ranges.map((r) => Number(r[0])))).toBe(1_000);
  });

  it('block timestamps are fetched once per block across refreshes', async () => {
    const blockTimes = { calls: 0 };
    const opts = { latest: 1_050n, createdAt: 1_000n, eventBlocks: [1_000n, 1_020n], blockTimes };
    const n = node(opts);
    const a = await getCircleEvents(n.client, circle, { fromBlock: 0n, withTimestamps: true });
    expect(a.map((e) => e.timestamp)).toEqual([1_800_001_000, 1_800_001_020]);
    expect(blockTimes.calls).toBe(2);
    opts.latest = 1_060n;
    await getCircleEvents(n.client, circle, { fromBlock: 0n, withTimestamps: true });
    expect(blockTimes.calls).toBe(2);
  });
});

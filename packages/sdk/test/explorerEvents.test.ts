import { describe, expect, it } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, type PublicClient } from 'viem';
import { getCircleEvents, registerExplorerApi } from '../src/read';
import { huiCircleAbi } from '../src/generated';

const circle = '0xABA89dFfA4e157927710419b01C32bD307bF2461' as const;
const member = '0x525519bBE052114a8Dc33198678D9fBeDce01743' as const;
const URL_ = 'https://explorer.test/api';

const claimed = (block: number, index: number, amount: bigint) => ({
  address: circle.toLowerCase(),
  topics: encodeEventTopics({ abi: huiCircleAbi, eventName: 'Claimed', args: { to: member } }),
  data: encodeAbiParameters([{ type: 'uint256' }], [amount]),
  blockNumber: `0x${block.toString(16)}`,
  timeStamp: `0x${(1_800_000_000 + block).toString(16)}`,
  logIndex: `0x${index.toString(16)}`,
  transactionHash: `0x${block.toString(16).padStart(64, '0')}`,
});

function setup(latest: bigint, logs: Array<ReturnType<typeof claimed>>, behaviour: 'ok' | 'throw' | 'http500' | 'error-status' = 'ok') {
  const urls: string[] = [];
  const rpc = { getLogs: 0, getCode: 0 };
  const client = {
    getBlockNumber: async () => latest,
    getCode: async () => {
      rpc.getCode++;
      return '0x6080';
    },
    getContractEvents: async () => {
      rpc.getLogs++;
      return [];
    },
  } as unknown as PublicClient;
  registerExplorerApi(client, URL_, async (url) => {
    urls.push(url);
    if (behaviour === 'throw') throw new Error('network');
    if (behaviour === 'http500') return { ok: false, status: 500, json: async () => ({}) };
    if (behaviour === 'error-status') return { ok: true, status: 200, json: async () => ({ status: '0', message: 'NOTOK', result: 'Max rate limit reached' }) };
    const q = new URL(url).searchParams;
    const page = Number(q.get('page'));
    const offset = Number(q.get('offset'));
    const from = Number(q.get('fromBlock'));
    const inRange = logs.filter((l) => Number(BigInt(l.blockNumber)) >= from);
    const slice = inRange.slice((page - 1) * offset, page * offset);
    if (inRange.length === 0) return { ok: true, status: 200, json: async () => ({ status: '0', message: 'No records found', result: [] }) };
    return { ok: true, status: 200, json: async () => ({ status: '1', message: 'OK', result: slice }) };
  });
  return { client, urls, rpc };
}

describe('getCircleEvents through an explorer API (Fuji public RPC throttles, A18)', () => {
  it('reads the whole range in ONE request: decoded events, oldest first, with timestamps, no RPC log scan', async () => {
    const { client, urls, rpc } = setup(60_847_000n, [claimed(60_845_300, 2, 7n), claimed(60_845_300, 1, 5n), claimed(60_846_000, 0, 9n)]);
    const ev = await getCircleEvents(client, circle, { fromBlock: 60_843_937n, withTimestamps: true });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`address=${circle}`);
    expect(urls[0]).toContain('fromBlock=60843937');
    expect(urls[0]).toContain('toBlock=60847000');
    expect(rpc).toEqual({ getLogs: 0, getCode: 0 });
    expect(ev.map((e) => [e.eventName, e.blockNumber, e.logIndex])).toEqual([
      ['Claimed', 60_845_300n, 1],
      ['Claimed', 60_845_300n, 2],
      ['Claimed', 60_846_000n, 0],
    ]);
    expect(ev[0]!.args).toMatchObject({ to: member, amount: 5n });
    expect(ev[0]!.timestamp).toBe(1_800_000_000 + 60_845_300);
    expect(ev[0]!.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('reads Routescan\'s bare "0x" as zero (a log at index 0), which BigInt alone rejects', async () => {
    const zero = { ...claimed(1_000, 0, 1n), logIndex: '0x' };
    const { client, rpc } = setup(2_000n, [zero, claimed(1_001, 1, 2n)]);
    const ev = await getCircleEvents(client, circle, { fromBlock: 0n });
    expect(ev.map((e) => e.logIndex)).toEqual([0, 1]);
    expect(rpc.getLogs).toBe(0); // no silent fallback to the throttled RPC scan
  });

  it('an empty range ("No records found") is an empty list, not an error and not a fallback', async () => {
    const { client, rpc } = setup(1_000n, []);
    expect(await getCircleEvents(client, circle, { fromBlock: 0n })).toEqual([]);
    expect(rpc.getLogs).toBe(0);
  });

  it('pages through more than 1000 logs', async () => {
    const logs = Array.from({ length: 1_003 }, (_, i) => claimed(1_000 + Math.floor(i / 50), i % 50, BigInt(i)));
    const { client, urls } = setup(2_000n, logs);
    const ev = await getCircleEvents(client, circle, { fromBlock: 0n });
    expect(ev).toHaveLength(1_003);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('page=2');
  });

  for (const behaviour of ['throw', 'http500', 'error-status'] as const) {
    it(`falls back to the chunked RPC scan when the explorer fails (${behaviour})`, async () => {
      const { client, rpc } = setup(250n, [], behaviour);
      await getCircleEvents(client, circle, { fromBlock: 0n, fromCreation: false });
      expect(rpc.getLogs).toBe(1); // this node accepts large ranges: one adaptive call over 0..250 (#14)
    });
  }

  it('refreshes by re-reading only the last 40 blocks (the explorer trails the node) and merges without duplicates', async () => {
    const all = [claimed(1_000, 0, 1n), claimed(1_090, 0, 2n)];
    const { client, urls } = setup(1_100n, all);
    const first = await getCircleEvents(client, circle, { fromBlock: 0n });
    expect(first).toHaveLength(2);
    all.push(claimed(1_120, 0, 3n));
    // the next head: 1_130; the explorer cache covers up to 1_100 - 40 = 1_060
    const client2 = client as unknown as { getBlockNumber: () => Promise<bigint> };
    client2.getBlockNumber = async () => 1_130n;
    const second = await getCircleEvents(client, circle, { fromBlock: 0n });
    expect(new URL(urls[1]!).searchParams.get('fromBlock')).toBe('1021');
    expect(second.map((e) => e.blockNumber)).toEqual([1_000n, 1_090n, 1_120n]);
  });
});

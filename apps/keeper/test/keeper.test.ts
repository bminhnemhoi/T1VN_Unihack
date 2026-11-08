import { describe, expect, it } from 'vitest';
import { STATE, tick, type AttemptResult, type CircleSnapshot, type KeeperFn, type KeeperPort } from '../src/keeper';
import { KeeperConfigError, loadKeeperConfig } from '../src/config';

const C1 = '0x1111111111111111111111111111111111111111' as const;
const M = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as const;
const members = [M(1), M(2), M(3), M(4), M(5)];

interface Call {
  fn: KeeperFn;
  args: readonly unknown[];
}

function fakePort(over: {
  now?: number;
  snap?: Partial<CircleSnapshot>;
  deadline?: bigint;
  owes?: Set<string>;
  results?: (call: Call) => AttemptResult | undefined;
  afterSettle?: Partial<CircleSnapshot>;
}) {
  const calls: Call[] = [];
  let snap: CircleSnapshot = {
    state: STATE.Active,
    memberCount: 5,
    joinDeadline: 1000n,
    settledRounds: 0,
    members,
    ...over.snap,
  };
  const owes = over.owes ?? new Set<string>();
  const port: KeeperPort = {
    nowSec: async () => over.now ?? 5000,
    circles: async () => [C1],
    snapshot: async () => snap,
    deadline: async () => over.deadline ?? 4000n,
    owes: async (_c, m) => owes.has(m),
    async attempt(_c, fn, args) {
      const call = { fn, args };
      calls.push(call);
      const forced = over.results?.(call);
      if (forced) return forced;
      if (fn === 'settleRound') snap = { ...snap, settledRounds: snap.settledRounds + 1, ...over.afterSettle };
      if (fn === 'markDefault') owes.delete(args[0] as string);
      return { sent: true, txHash: `0x${'ab'.repeat(32)}`, gasUsed: 123_456n, ok: true };
    },
  };
  const logs: string[] = [];
  const log = (level: string, message: string, f?: Record<string, unknown>) => void logs.push(`${level} ${message} ${JSON.stringify(f ?? {})}`);
  return { port, calls, logs, log };
}

describe('keeper tick', () => {
  it('cancels a Forming circle only after its join deadline', async () => {
    const early = fakePort({ now: 900, snap: { state: STATE.Forming } });
    await tick(early.port, early.log);
    expect(early.calls).toEqual([]);
    const late = fakePort({ now: 1001, snap: { state: STATE.Forming } });
    await tick(late.port, late.log);
    expect(late.calls).toEqual([{ fn: 'cancel', args: [] }]);
  });

  it('settles the current round only once its deadline has passed', async () => {
    const wait = fakePort({ now: 3999, deadline: 4000n });
    await tick(wait.port, wait.log);
    expect(wait.calls).toEqual([]);
    const due = fakePort({ now: 4000, deadline: 4000n });
    const s = await tick(due.port, due.log);
    expect(due.calls).toEqual([{ fn: 'settleRound', args: [] }]);
    expect(s).toMatchObject({ sent: 1, failed: 0 });
  });

  it('marks every overdue defaulter BEFORE settling and BEFORE finalizing', async () => {
    const t = fakePort({ owes: new Set([M(4), M(2)]), snap: { settledRounds: 4 }, deadline: 4000n });
    await tick(t.port, t.log);
    expect(t.calls.map((c) => c.fn)).toEqual(['markDefault', 'markDefault', 'settleRound', 'finalize']);
    expect(t.calls.filter((c) => c.fn === 'markDefault').map((c) => c.args[0])).toEqual([M(2), M(4)]);
  });

  it('does not touch members that owe nothing or are already marked', async () => {
    const t = fakePort({ owes: new Set(), now: 100 });
    await tick(t.port, t.log);
    expect(t.calls).toEqual([]);
  });

  it('after the last round it never settles again: it marks overdue defaulters, then finalizes', async () => {
    const t = fakePort({ snap: { settledRounds: 5 }, owes: new Set([M(4)]) });
    await tick(t.port, t.log);
    expect(t.calls.map((c) => c.fn)).toEqual(['markDefault', 'finalize']);
  });

  it('treats "not due yet / already done" as skipped info, other failures as warnings', async () => {
    const t = fakePort({
      owes: new Set([M(4)]),
      results: (c) =>
        c.fn === 'markDefault'
          ? { sent: false, code: 'GraceNotOver', message: 'x' }
          : { sent: false, code: 'SendFailed', message: 'rpc down' },
    });
    const s = await tick(t.port, t.log);
    expect(s).toMatchObject({ sent: 0, skipped: 1, failed: 1 });
    expect(t.logs.some((l) => l.startsWith('info markDefault skipped'))).toBe(true);
    expect(t.logs.some((l) => l.startsWith('warn settleRound not sent'))).toBe(true);
  });

  it('counts a mined revert as failed and logs it at error level', async () => {
    const t = fakePort({ results: () => ({ sent: true, txHash: `0x${'cd'.repeat(32)}`, gasUsed: 1n, ok: false }) });
    const s = await tick(t.port, t.log);
    expect(s.failed).toBe(1);
    expect(t.logs[0]).toMatch(/^error settleRound sent/);
  });

  it('ignores Paused and terminal circles', async () => {
    for (const state of [STATE.Paused, STATE.Completed, STATE.Cancelled, STATE.Unwound]) {
      const t = fakePort({ snap: { state } });
      const s = await tick(t.port, t.log);
      expect(t.calls).toEqual([]);
      expect(s.circles).toBe(0);
    }
  });
});

describe('loadKeeperConfig', () => {
  const key = `0x${'11'.repeat(32)}`;
  it('reads names only, defaults to Fuji and a 15 second scan', () => {
    const c = loadKeeperConfig({ KEEPER_PRIVATE_KEY: key });
    expect(c.network.name).toBe('fuji');
    expect(c.intervalSeconds).toBe(15);
  });
  it('rejects a missing or malformed key and a bad interval', () => {
    expect(() => loadKeeperConfig({})).toThrow(KeeperConfigError);
    expect(() => loadKeeperConfig({ KEEPER_PRIVATE_KEY: '0x12' })).toThrow(KeeperConfigError);
    expect(() => loadKeeperConfig({ KEEPER_PRIVATE_KEY: key, KEEPER_INTERVAL_SECONDS: '0' })).toThrow(KeeperConfigError);
  });
  it('the error messages never contain the key value', () => {
    try {
      loadKeeperConfig({ KEEPER_PRIVATE_KEY: '0xdeadbeef' });
    } catch (e) {
      expect(String(e)).not.toContain('deadbeef');
    }
  });
});

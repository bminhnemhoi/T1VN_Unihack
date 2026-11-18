import { describe, expect, it } from 'vitest';
import { MAX_CLEANUP_CANCELS, MAX_TRACKED_CIRCLES, STATE, tick, type AttemptResult, type CircleSnapshot, type KeeperFn, type KeeperPort } from '../src/keeper';
import { GAS_HARD_CAP, KeeperConfigError, gasLimitFor, loadKeeperConfig } from '../src/config';

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
  circleList?: readonly `0x${string}`[];
  snaps?: Record<string, Partial<CircleSnapshot>>;
}) {
  const calls: Call[] = [];
  const retired: string[] = [];
  const reads: string[] = [];
  let snap: CircleSnapshot = {
    state: STATE.Active,
    memberCount: 5,
    joinDeadline: 1000n,
    settledRounds: 0,
    members,
    bondRemaining: 48_000_000n,
    bondDeposited: 48_000_000n,
    ...over.snap,
  };
  const owes = over.owes ?? new Set<string>();
  const port: KeeperPort = {
    nowSec: async () => over.now ?? 5000,
    circles: async () => over.circleList ?? [C1],
    snapshot: async (c) => {
      reads.push(c);
      return { ...snap, ...over.snaps?.[c] };
    },
    retire: (c) => void retired.push(c),
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
  return { port, calls, logs, log, retired, reads };
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

  it('a Forming circle with no bond at all: waits before its deadline, then ONE cleanup cancel and is retired (audit A16 L-01)', async () => {
    const early = fakePort({ now: 900, snap: { state: STATE.Forming, bondRemaining: 0n, bondDeposited: 0n } });
    const e = await tick(early.port, early.log);
    expect(early.calls).toEqual([]);
    expect(early.retired).toEqual([]); // the organizer may still deposit before the deadline
    expect(e.ignored).toBe(1);
    const late = fakePort({ now: 1001, snap: { state: STATE.Forming, bondRemaining: 0n, bondDeposited: 0n } });
    await tick(late.port, late.log);
    expect(late.calls).toEqual([{ fn: 'cancel', args: [] }]);
    expect(late.retired).toEqual([C1]);
  });

  it('an Active or Paused circle that never had a bond is ignored for good: no markDefault, settleRound, finalize (audit A16 M-01)', async () => {
    for (const state of [STATE.Active, STATE.Paused]) {
      const t = fakePort({ now: 5000, deadline: 1n, owes: new Set([M(2)]), snap: { state, bondRemaining: 0n, bondDeposited: 0n } });
      const s = await tick(t.port, t.log);
      expect(t.calls).toEqual([]);
      expect(t.retired).toEqual([C1]);
      expect(s).toMatchObject({ ignored: 1, circles: 0, sent: 0 });
    }
  });

  it('a circle whose bond was fully paid out is still served (bondDeposited counts, bondRemaining does not)', async () => {
    const t = fakePort({ now: 5000, deadline: 4000n, snap: { bondRemaining: 0n, bondDeposited: 48_000_000n } });
    await tick(t.port, t.log);
    expect(t.calls).toEqual([{ fn: 'settleRound', args: [] }]);
  });

  it('cleanup cancels of unbonded circles are bounded per scan', async () => {
    const list = Array.from({ length: 9 }, (_, i) => M(100 + i));
    const t = fakePort({ now: 1001, circleList: list, snap: { state: STATE.Forming, bondRemaining: 0n, bondDeposited: 0n } });
    const s = await tick(t.port, t.log);
    expect(t.calls.filter((c) => c.fn === 'cancel')).toHaveLength(MAX_CLEANUP_CANCELS);
    expect(s.ignored).toBe(9);
  });

  it('tracks at most 200 circles per scan, newest first, and logs the cut (audit A16 L-01)', async () => {
    const list = Array.from({ length: 260 }, (_, i) => M(1000 + i));
    const t = fakePort({ now: 100, circleList: list, snap: { state: STATE.Active } });
    await tick(t.port, t.log);
    expect(t.reads).toHaveLength(MAX_TRACKED_CIRCLES);
    expect(t.reads[0]).toBe(M(1259)); // newest first
    expect(t.reads.at(-1)).toBe(M(1060));
    expect(t.logs.some((l) => l.startsWith('warn circle list truncated') && l.includes('"total":260'))).toBe(true);
    const small = fakePort({ now: 100 });
    await tick(small.port, small.log);
    expect(small.logs.some((l) => l.includes('truncated'))).toBe(false);
  });

  it('settles the current round only once its deadline has passed and reports exact wakeup delay before deadline', async () => {
    const wait = fakePort({ now: 3994, deadline: 4000n });
    const w = await tick(wait.port, wait.log);
    expect(wait.calls).toEqual([]);
    expect(w.nextDueInSec).toBe(7); // 4000 + 1 - 3994
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

describe('gasLimitFor', () => {
  it('adds a 20% margin, caps at 5M, and refuses an estimate above the cap', () => {
    expect(gasLimitFor(1_000_000n)).toBe(1_200_000n);
    expect(gasLimitFor(4_500_000n)).toBe(GAS_HARD_CAP);
    expect(gasLimitFor(GAS_HARD_CAP)).toBe(GAS_HARD_CAP);
    expect(gasLimitFor(GAS_HARD_CAP + 1n)).toBeUndefined();
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

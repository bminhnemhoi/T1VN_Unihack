import { describe, expect, it } from 'vitest';
import { MAX_CLEANUP_CANCELS, MAX_CONSECUTIVE_FAILURES, MAX_TRACKED_CIRCLES, SNAPSHOT_AHEAD, STATE, newKeeperMemory, tick, type AttemptResult, type CircleSnapshot, type KeeperFn, type KeeperPort } from '../src/keeper';
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

  it('organizer-led rounds (B28): a demo circle waits 5 minutes after the deadline, a real one 24 hours, before the keeper settles', async () => {
    const turn = fakePort({ now: 4299, deadline: 4000n, snap: { roundDuration: 120 } });
    const t1 = await tick(turn.port, turn.log);
    expect(turn.calls).toEqual([]); // still the organizer's turn
    expect(t1.nextDueInSec).toBe(2); // 4000 + 300 + 1 - 4299
    const late = fakePort({ now: 4300, deadline: 4000n, snap: { roundDuration: 120 } });
    await tick(late.port, late.log);
    expect(late.calls).toEqual([{ fn: 'settleRound', args: [] }]);
    const real = fakePort({ now: 4000 + 86_399, deadline: 4000n, snap: { roundDuration: 30 * 86_400 } });
    await tick(real.port, real.log);
    expect(real.calls).toEqual([]);
    const realLate = fakePort({ now: 4000 + 86_400, deadline: 4000n, snap: { roundDuration: 30 * 86_400 } });
    await tick(realLate.port, realLate.log);
    expect(realLate.calls).toEqual([{ fn: 'settleRound', args: [] }]);
    // An organizer who holds a seat gets no turn: settled at the deadline (audit B28 L-01).
    const seated = fakePort({ now: 4000, deadline: 4000n, snap: { roundDuration: 120, organizer: members[0] } });
    await tick(seated.port, seated.log);
    expect(seated.calls).toEqual([{ fn: 'settleRound', args: [] }]);
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

  // Issue #1: the newest-200 cut must never starve an older funded circle.
  it('an old funded circle is served even when 200 newer unbonded circles with future deadlines fill the scan', async () => {
    const OLD = M(1);
    const spam = Array.from({ length: 200 }, (_, i) => M(1000 + i));
    const t = fakePort({
      now: 5000,
      circleList: [OLD, ...spam],
      deadline: 4000n,
      snap: { state: STATE.Forming, bondRemaining: 0n, bondDeposited: 0n, joinDeadline: 10_000n },
      snaps: { [OLD]: { state: STATE.Active, bondRemaining: 48_000_000n, bondDeposited: 48_000_000n } },
    });
    const mem = newKeeperMemory();
    await tick(t.port, t.log, mem);
    expect(t.reads).not.toContain(OLD); // first scan: the newest 200, as before
    await tick(t.port, t.log, mem);
    expect(t.reads).toContain(OLD); // second scan: least recently read first
    expect(t.calls).toContainEqual({ fn: 'settleRound', args: [] });
    // once seen funded it is read on every scan, however many unbonded circles keep arriving
    const before = t.reads.filter((c) => c === OLD).length;
    await tick(t.port, t.log, mem);
    expect(t.reads.filter((c) => c === OLD).length).toBeGreaterThan(before); // (a settle also re-reads the snapshot)
  });

  it('every circle is read within ceil(n / 200) scans when nothing is funded', async () => {
    const list = Array.from({ length: 450 }, (_, i) => M(2000 + i));
    const t = fakePort({ now: 100, circleList: list, snap: { state: STATE.Forming, bondRemaining: 0n, bondDeposited: 0n, joinDeadline: 10_000n } });
    const mem = newKeeperMemory();
    for (let i = 0; i < 3; i++) await tick(t.port, t.log, mem);
    expect(new Set(t.reads).size).toBe(450);
    expect(t.reads.length).toBeLessThanOrEqual(3 * MAX_TRACKED_CIRCLES);
  });

  // Issue #2: a cleanup cancel that did not go through must not retire the circle.
  it('a failed cleanup cancel keeps the circle eligible; it is retired only after a cancel that went through', async () => {
    const snap = { now: 1001, snap: { state: STATE.Forming, bondRemaining: 0n, bondDeposited: 0n } } as const;
    const sendFailed = fakePort({ ...snap, results: () => ({ sent: false, code: 'SendFailed', message: 'temporary' }) });
    await tick(sendFailed.port, sendFailed.log);
    expect(sendFailed.retired).toEqual([]);

    const reverted = fakePort({ ...snap, results: () => ({ sent: true, txHash: `0x${'ef'.repeat(32)}`, gasUsed: 1n, ok: false }) });
    await tick(reverted.port, reverted.log);
    expect(reverted.retired).toEqual([]);

    // retry on a second scan with the same memory: first attempt fails, second succeeds, then it is retired
    let attempts = 0;
    const retry = fakePort({
      ...snap,
      results: () => (++attempts === 1 ? { sent: false, code: 'SendFailed', message: 'temporary' } : undefined),
    });
    const mem = newKeeperMemory();
    await tick(retry.port, retry.log, mem);
    expect(retry.retired).toEqual([]);
    await tick(retry.port, retry.log, mem);
    expect(retry.calls.filter((c) => c.fn === 'cancel')).toHaveLength(2);
    expect(retry.retired).toEqual([C1]);
  });

  // Fewer round trips: independent reads overlap, every transaction is still sent one at a time.
  it('asks every member whether they owe at once, then marks only the debtors, in member order', async () => {
    const t = fakePort({ now: 5000, deadline: 9000n, owes: new Set([M(2), M(4)]) });
    let inFlight = 0;
    let maxInFlight = 0;
    const owes = t.port.owes;
    t.port.owes = async (c, m) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return owes(c, m);
    };
    await tick(t.port, t.log);
    expect(maxInFlight).toBe(members.length); // all five at the same time
    expect(t.calls.filter((c) => c.fn === 'markDefault').map((c) => c.args[0])).toEqual([M(2), M(4)]);
  });

  it('reads a few circle snapshots ahead (bounded), and still processes the circles one after the other in order', async () => {
    const list = Array.from({ length: 25 }, (_, i) => M(3000 + i));
    const t = fakePort({ now: 100, circleList: list, deadline: 9000n });
    let inFlight = 0;
    let maxInFlight = 0;
    const started: string[] = [];
    const snapshot = t.port.snapshot;
    t.port.snapshot = async (c) => {
      started.push(c);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return snapshot(c);
    };
    const s = await tick(t.port, t.log);
    expect(s.circles).toBe(25);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(SNAPSHOT_AHEAD);
    expect(started).toEqual([...list].reverse()); // newest first, each circle read exactly once
  });

  it('a total outage (many reads failing in a row) stops the scan, and no failing snapshot becomes an unhandled rejection', async () => {
    const list = Array.from({ length: 12 }, (_, i) => M(4000 + i));
    const t = fakePort({ now: 100, circleList: list });
    t.port.snapshot = async () => {
      throw new Error('rpc down');
    };
    await expect(tick(t.port, t.log)).rejects.toThrow('rpc down'); // the whole RPC is down: give up this scan, retry on the next
    expect(t.calls).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 25)); // let any stray rejection surface: vitest fails the run if one does
  });

  describe('one circle whose RPC reads fail must not stop the others', () => {
    // Every circle is Forming, funded and past its join deadline: the keeper sends one cancel for each one it manages to read.
    const forming = { state: STATE.Forming, joinDeadline: 50n } as const;
    const list = Array.from({ length: 6 }, (_, i) => M(5000 + i)); // newest first: 5005 ... 5000

    it('serves every other circle in the same scan, counts the failure and logs it without the error text', async () => {
      const t = fakePort({ now: 100, snap: forming, circleList: list });
      const snapshot = t.port.snapshot;
      t.port.snapshot = async (c) => {
        if (c === M(5003)) throw new Error('rpc 429 https://rpc.example/key-SECRET');
        return snapshot(c);
      };
      const s = await tick(t.port, t.log);
      expect(t.calls.filter((c) => c.fn === 'cancel')).toHaveLength(5); // all but the unreadable one
      expect(s.failed).toBe(1);
      const warn = t.logs.find((l) => l.startsWith('warn circle skipped'));
      expect(warn).toContain(M(5003));
      expect(t.logs.join(' | ')).not.toContain('SECRET'); // a viem error text can carry the RPC URL, and with it a key
    });

    it('a circle that fails in other steps (deadline, owes) is isolated the same way', async () => {
      const t = fakePort({ now: 5000, circleList: list, owes: new Set([members[0]!]) });
      const owes = t.port.owes;
      t.port.owes = async (c, m) => {
        if (c === M(5002)) throw new Error('rpc down');
        return owes(c, m);
      };
      const s = await tick(t.port, t.log);
      expect(s.failed).toBeGreaterThanOrEqual(1);
      expect(t.calls.some((c) => c.fn === 'settleRound')).toBe(true); // the circles after the failing one were still settled
    });

    it('a circle that always fails does not starve the rest over many scans, and rotates to the back', async () => {
      const t = fakePort({ now: 100, snap: forming, circleList: list });
      const snapshot = t.port.snapshot;
      t.port.snapshot = async (c) => {
        if (c === M(5005)) throw new Error('rpc down'); // the newest circle: first in line every time
        return snapshot(c);
      };
      const mem = newKeeperMemory();
      for (let i = 0; i < 3; i++) await tick(t.port, t.log, mem);
      expect(t.calls.filter((c) => c.fn === 'cancel').length).toBeGreaterThanOrEqual(5); // others served at least once
      expect(mem.lastRead.get(M(5005))).toBe(2); // it was tried on every scan, not forgotten
    });

    it('MAX_CONSECUTIVE_FAILURES unreadable circles in a row still end the scan with the error', async () => {
      const t = fakePort({ now: 100, snap: forming, circleList: list });
      const snapshot = t.port.snapshot;
      const dead = new Set(list.slice(-MAX_CONSECUTIVE_FAILURES).map(String)); // the first MAX read in scan order
      t.port.snapshot = async (c) => {
        if (dead.has(c)) throw new Error('rpc down');
        return snapshot(c);
      };
      await expect(tick(t.port, t.log)).rejects.toThrow('rpc down');
    });
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

import { describe, expect, it } from 'vitest';
import { createEntryDebtGuard, type CircleIndexReader } from './entryGuard';

type Address = `0x${string}`;
const addr = (i: number): Address => `0x${i.toString(16).padStart(40, '0')}`;
const WALLET = addr(0xabc);
const OTHER = addr(0xdef);
const clean = { defaulted: false, debt: 0n };

interface Circle {
  state: number; // 0 Forming, 1 Active, 3 Completed, 4 Cancelled, 5 Unwound
  members: Address[];
  info?: Partial<Record<Address, { defaulted: boolean; debt: bigint }>>;
}

function fake(world: Map<Address, Circle>) {
  const calls = { allCircles: 0, state: 0, members: 0, memberInfo: [] as Address[], maxInFlight: 0 };
  let inFlight = 0;
  const track = async <T>(f: () => T): Promise<T> => {
    calls.maxInFlight = Math.max(calls.maxInFlight, ++inFlight);
    await Promise.resolve();
    inFlight--;
    return f();
  };
  const reader: CircleIndexReader = {
    allCircles: async () => (calls.allCircles++, [...world.keys()]),
    state: (c) => track(() => (calls.state++, world.get(c)!.state)),
    members: (c) => track(() => (calls.members++, world.get(c)!.members)),
    memberInfo: (c, w) => track(() => (calls.memberInfo.push(c), world.get(c)!.info?.[w] ?? clean)),
  };
  return { reader, calls };
}

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('entry debt guard (docs/05 8.1, direction A)', () => {
  it('blocks a wallet defaulted with debt left in one of its circles, and names it (G1; G3: counters no longer mask it)', async () => {
    const world = new Map<Address, Circle>([
      [addr(1), { state: 3, members: [WALLET, OTHER] }],
      [addr(2), { state: 3, members: [OTHER, WALLET], info: { [WALLET]: { defaulted: true, debt: 320_000_000n } } }],
    ]);
    const g = createEntryDebtGuard(fake(world).reader);
    expect(await g.check(WALLET)).toEqual({ kind: 'unpaid', circle: addr(2) });
    expect(await g.check(OTHER)).toEqual({ kind: 'clear' });
  });

  it('defaulted but debt cleared (repayDebt, frozen pot, finalize holdback) is clear (G2)', async () => {
    const world = new Map<Address, Circle>([[addr(1), { state: 3, members: [WALLET], info: { [WALLET]: { defaulted: true, debt: 0n } } }]]);
    expect(await createEntryDebtGuard(fake(world).reader).check(WALLET)).toEqual({ kind: 'clear' });
  });

  it('debt without a default (an open shortfall still in grace) does not block', async () => {
    const world = new Map<Address, Circle>([[addr(1), { state: 1, members: [WALLET], info: { [WALLET]: { defaulted: false, debt: 5n } } }]]);
    expect(await createEntryDebtGuard(fake(world).reader).check(WALLET)).toEqual({ kind: 'clear' });
  });

  it('a request reads memberInfo only for the wallet own circles, member lists once, Cancelled never (audit M-02)', async () => {
    const world = new Map<Address, Circle>();
    for (let i = 1; i <= 60; i++) world.set(addr(i), { state: i % 3 === 0 ? 4 : 1, members: i === 7 ? [WALLET] : [OTHER] });
    const f = fake(world);
    const c = clock();
    const g = createEntryDebtGuard(f.reader, { now: c.now });
    expect(await g.check(WALLET)).toEqual({ kind: 'clear' });
    expect(f.calls.memberInfo).toEqual([addr(7)]);
    expect(f.calls.members).toBe(40); // 20 of 60 are Cancelled
    expect(f.calls.maxInFlight).toBeLessThanOrEqual(25);
    for (let i = 0; i < 5; i++) await g.check(WALLET);
    expect(f.calls.state).toBe(60); // the index is shared: no re-read within the refresh window
    c.advance(31_000);
    await g.check(WALLET);
    expect(f.calls.state).toBe(60); // circles past Forming are never re-read
    expect(f.calls.allCircles).toBe(2);
  });

  it('many junk circles do not lock everyone out: the index is read once, in budgeted refreshes (audit M-01)', async () => {
    const world = new Map<Address, Circle>();
    for (let i = 1; i <= 2_500; i++) world.set(addr(i), { state: 4, members: [] });
    world.set(addr(9_999), { state: 3, members: [WALLET] });
    const f = fake(world);
    const c = clock();
    const g = createEntryDebtGuard(f.reader, { now: c.now, maxReadsPerRefresh: 1_000 });
    expect(await g.check(WALLET)).toMatchObject({ kind: 'incomplete' });
    c.advance(30_000);
    expect(await g.check(WALLET)).toMatchObject({ kind: 'incomplete' });
    c.advance(30_000);
    expect(await g.check(WALLET)).toEqual({ kind: 'clear' });
    expect(f.calls.state).toBe(2_501);
  });

  it('a Forming circle holds no debt but is re-read before it is stale; stale or unread means incomplete (fail closed)', async () => {
    const world = new Map<Address, Circle>([[addr(1), { state: 0, members: [WALLET] }]]);
    const f = fake(world);
    const c = clock();
    const g = createEntryDebtGuard(f.reader, { now: c.now });
    expect(await g.check(WALLET)).toEqual({ kind: 'clear' });
    expect(f.calls.memberInfo).toEqual([]);
    // It activates and the wallet runs into debt; the next refresh sees it.
    world.set(addr(1), { state: 1, members: [WALLET], info: { [WALLET]: { defaulted: true, debt: 9n } } });
    c.advance(30_000);
    expect(await g.check(WALLET)).toEqual({ kind: 'unpaid', circle: addr(1) });

    // New circles are read first; while they take the budget, old Forming circles go stale and the gate refuses to
    // guess (incomplete, 503) until they are read again.
    const w2 = new Map<Address, Circle>();
    for (let i = 1; i <= 5; i++) w2.set(addr(100 + i), { state: 0, members: [] });
    const c2 = clock();
    const g2 = createEntryDebtGuard(fake(w2).reader, { now: c2.now, maxReadsPerRefresh: 1 });
    const step = async () => {
      const k = (await g2.check(WALLET)).kind;
      c2.advance(30_000);
      return k;
    };
    const first: string[] = [];
    for (let i = 0; i < 6; i++) first.push(await step());
    expect(first).toEqual(['incomplete', 'incomplete', 'incomplete', 'incomplete', 'clear', 'clear']);
    for (let i = 1; i <= 3; i++) w2.set(addr(200 + i), { state: 4, members: [] });
    const after: string[] = [];
    for (let i = 0; i < 10; i++) after.push(await step());
    expect(after.slice(0, 4)).toEqual(['incomplete', 'incomplete', 'incomplete', 'incomplete']); // 3 unread, then stale
    expect(after.at(-1)).toBe('clear');
  });

  it('concurrent requests share one refresh', async () => {
    const world = new Map<Address, Circle>([[addr(1), { state: 3, members: [WALLET] }]]);
    const f = fake(world);
    const g = createEntryDebtGuard(f.reader);
    await Promise.all([g.check(WALLET), g.check(WALLET), g.check(OTHER)]);
    expect(f.calls.allCircles).toBe(1);
    expect(f.calls.state).toBe(1);
  });

  it('a failed or malformed read throws (the route answers 502), never "clear" (audit L-01)', async () => {
    const base = (over: Partial<CircleIndexReader>): CircleIndexReader => ({
      allCircles: async () => [addr(1)],
      state: async () => 3,
      members: async () => [WALLET],
      memberInfo: async () => ({ defaulted: true, debt: 1n }),
      ...over,
    });
    await expect(createEntryDebtGuard(base({ allCircles: async () => Promise.reject(new Error('rpc')) })).check(WALLET)).rejects.toThrow();
    await expect(createEntryDebtGuard(base({ memberInfo: async () => Promise.reject(new Error('rpc')) })).check(WALLET)).rejects.toThrow();
    await expect(createEntryDebtGuard(base({ memberInfo: async () => [true, 1n] as never })).check(WALLET)).rejects.toThrow();
    await expect(createEntryDebtGuard(base({ memberInfo: async () => ({ defaulted: true, debt: '1' }) as never })).check(WALLET)).rejects.toThrow();
    await expect(createEntryDebtGuard(base({ members: async () => 'x' as never })).check(WALLET)).rejects.toThrow();
    await expect(createEntryDebtGuard(base({ state: async () => '1' as never })).check(WALLET)).rejects.toThrow();
    await expect(createEntryDebtGuard(base({ allCircles: async () => null as never })).check(WALLET)).rejects.toThrow();
  });

  it('a failed refresh is retried on the next request', async () => {
    let fail = true;
    const g = createEntryDebtGuard({
      allCircles: async () => {
        if (fail) throw new Error('rpc');
        return [addr(1)];
      },
      state: async () => 3,
      members: async () => [WALLET],
      memberInfo: async () => clean,
    });
    await expect(g.check(WALLET)).rejects.toThrow();
    fail = false;
    expect(await g.check(WALLET)).toEqual({ kind: 'clear' });
  });
});

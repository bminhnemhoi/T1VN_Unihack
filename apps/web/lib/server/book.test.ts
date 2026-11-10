import { describe, expect, it } from 'vitest';
import type { CircleEvent, CircleView } from 'sdk';
import { assembleBook, BOOK_NOTE, formatVn } from './book';
import { createBookHandler, type BookDeps } from './bookRoute';
import { SlidingWindowLimiter } from './ratelimit';

const circle = '0x1111111111111111111111111111111111111111' as const;
const organizer = '0x2222222222222222222222222222222222222222' as const;
const m1 = '0x3333333333333333333333333333333333333333' as const;
const m2 = '0x4444444444444444444444444444444444444444' as const;
const USDC = (n: number) => BigInt(Math.round(n * 1_000_000));

const view = (over: Partial<CircleView> = {}): CircleView => ({
  address: circle,
  label: 'Hụi tổ 3',
  mode: 'bidding',
  state: 'active',
  organizer,
  params: {
    N: 5,
    C: USDC(100),
    periodSeconds: 30 * 86_400,
    roundDuration: 180,
    commitWindow: 90,
    revealWindow: 60,
    graceSeconds: 120,
    alphaBps: 2000,
    commissionMode: true,
    feeBps: 100,
    reserveBps: 100,
    revealBondBps: 100,
    capBps: 2000,
    joinDeadline: 0,
  },
  startTime: 1_800_000_000,
  currentRound: 3,
  settledRounds: 2,
  bondRemaining: USDC(460),
  reserve: USDC(7.67),
  totalHoldback: USDC(140),
  pausedTotal: 0,
  lateRateBps: 1000,
  coverageBps: 10_000,
  guaranteedCoverageBps: 10_000,
  requiredAllowance: USDC(404),
  ndc19: { perRoundVnd: 13_000_000, organizerActiveCircles: 1, mustNotifyCommune: false },
  members: [
    { address: m2, joinIndex: 1, status: 'live', holdback: 0n, debt: 0n, lateCount: 0, reputation: { completed: 0, onTime: 0, late: 0, defaults: 0, repaid: 0 } },
    { address: m1, joinIndex: 0, status: 'dead', receivedRound: 1, holdback: USDC(80), debt: 0n, lateCount: 0, reputation: { completed: 0, onTime: 0, late: 0, defaults: 0, repaid: 0 } },
  ],
  rounds: [
    { k: 1, phase: 'done', roundStart: 0, commitEndsAt: 0, revealEndsAt: 0, deadline: 0, maxBid: 0n, shortfalls: [] },
    {
      k: 2,
      phase: 'done',
      roundStart: 0,
      commitEndsAt: 0,
      revealEndsAt: 0,
      deadline: 0,
      maxBid: 0n,
      shortfalls: [
        { round: 2, member: m1, amount: USDC(100), fromHoldback: 0n, fromBond: 0n, fromReserve: 0n, uncovered: USDC(5), since: 1, resolved: false, pausedAtSettle: 0, graceEndsAt: 1 },
        { round: 2, member: m2, amount: USDC(100), fromHoldback: 0n, fromBond: 0n, fromReserve: 0n, uncovered: USDC(9), since: 1, resolved: true, pausedAtSettle: 0, graceEndsAt: 1 },
      ],
    },
  ],
  ...over,
});

const ev = (eventName: string, args: Record<string, unknown>, timestamp: number, tx: string): CircleEvent => ({
  eventName,
  args,
  blockNumber: BigInt(timestamp),
  logIndex: 0,
  txHash: tx as `0x${string}`,
  timestamp,
});

const events: CircleEvent[] = [
  ev('RoundSettled', { round: 1, winner: m1, bid: 6n, pot: 1n, payout: USDC(288.48) }, 1_800_000_200, '0xaa'),
  ev('ContributionPulled', { round: 1, member: m2, amount: USDC(94) }, 1_800_000_100, '0xbb'),
  ev('ContributionShortfall', { round: 2, member: m1, amount: USDC(100) }, 1_800_000_400, '0xcc'),
  ev('ShortfallCovered', { round: 2, member: m1, source: 0, amount: USDC(80) }, 1_800_000_400, '0xcc'),
  ev('ShortfallCovered', { round: 2, member: m1, source: 3, amount: USDC(5) }, 1_800_000_400, '0xcc'),
  ev('CircleActivated', { startTime: 1_800_000_000n, guaranteedCoverageBps: 10_000n }, 1_800_000_000, '0xdd'),
];

describe('assembleBook', () => {
  const b = assembleBook(view(), events, 43113);

  it('header carries the terms in USDC and the Snowtrace link', () => {
    expect(b.header).toMatchObject({
      label: 'Hụi tổ 3',
      address: circle,
      organizer,
      members: 5,
      contributionUsdc: '100 USDC',
      periodDays: 30,
      capPerYear: '20%',
      latePerYear: '10%',
      holdback: '20%',
      commission: '1%',
      reserve: '1%',
      bondRemainingUsdc: '460 USDC',
      coverageAtActivation: '100%',
      explorerUrl: `https://testnet.snowtrace.io/address/${circle}`,
    });
  });

  it('lists members in join order with the round they received', () => {
    expect(b.members.map((m) => [m.address, m.joinOrder, m.receivedRound])).toEqual([
      [m1, 1, 1],
      [m2, 2, null],
    ]);
  });

  it('one line per money event, oldest first, with tx hash and link; no VND anywhere', () => {
    expect(b.lines.map((l) => l.kind)).toEqual(['Góp', 'Hốt', 'Thiếu', 'Bù', 'Bù']);
    expect(b.lines[0]).toMatchObject({ round: 1, member: m2, amountUsdc: '94 USDC', tx: '0xbb', txUrl: 'https://testnet.snowtrace.io/tx/0xbb' });
    expect(JSON.stringify(b)).not.toMatch(/VND|\d\s?đ/);
  });

  it('footer: totals, covered excludes the uncovered part, open claims only count unresolved shortfalls', () => {
    expect(b.footer).toMatchObject({
      totalContributedUsdc: '94 USDC',
      totalPaidOutUsdc: '288,48 USDC',
      totalCoveredUsdc: '80 USDC',
      openClaimsUsdc: '5 USDC',
      mustNotifyCommune: false,
      ndc19Warning: null,
      note: BOOK_NOTE,
    });
  });

  it('warns when the Article 14 threshold is crossed', () => {
    const w = assembleBook(view({ ndc19: { perRoundVnd: 1, organizerActiveCircles: 2, mustNotifyCommune: true } }), [], 43113);
    expect(w.footer.ndc19Warning).toContain('Điều 14');
    expect(w.lines).toEqual([]);
    expect(w.header.coverageAtActivation).toBeNull();
  });

  it('formats Vietnam time (UTC+7) regardless of the host zone', () => {
    expect(formatVn(Date.UTC(2026, 10, 10, 7, 5) / 1000)).toBe('10/11/2026 14:05');
  });
});

describe('book route', () => {
  const NOW = 1_800_000_000_000;
  const book = assembleBook(view(), events, 43113);
  const make = (over: Partial<BookDeps> = {}) => {
    const calls = { build: 0 };
    const logs: string[] = [];
    const deps: BookDeps = {
      isCircle: async (a) => a === circle,
      build: async () => {
        calls.build++;
        return book;
      },
      ipLimiter: new SlidingWindowLimiter(1000, 3_600_000, () => NOW),
      now: () => NOW,
      requestId: () => 'r1',
      log: (_l, m) => void logs.push(m),
      ...over,
    };
    return { handler: createBookHandler(deps), calls, logs };
  };
  const get = (h: (r: Request) => Promise<Response>, addr: string, qs = '', init: RequestInit = {}) =>
    h(new Request(`http://x/api/circles/${addr}/so-ho${qs}`, init));

  it('returns the book as JSON (default and format=json)', async () => {
    const { handler } = make();
    for (const qs of ['', '?format=json']) {
      const res = await get(handler, circle, qs);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(((await res.json()) as typeof book).header.address).toBe(circle);
    }
  });

  it('rejects a bad address (400), a stranger (404) and the cut PDF format (400)', async () => {
    const { handler, calls } = make();
    expect(((await (await get(handler, 'abc')).json()) as { error: { code: string } }).error.code).toBe('BadAddress');
    const stranger = await get(handler, '0x9999999999999999999999999999999999999999');
    expect(stranger.status).toBe(404);
    expect(((await stranger.json()) as { error: { code: string } }).error.code).toBe('NotCircle');
    const pdf = await get(handler, circle, '?format=pdf');
    expect(pdf.status).toBe(400);
    expect(((await pdf.json()) as { error: { code: string } }).error.code).toBe('FormatNotSupported');
    expect(calls.build).toBe(0);
  });

  it('only GET', async () => {
    const { handler } = make();
    expect((await get(handler, circle, '', { method: 'POST' })).status).toBe(405);
  });

  it('rate limits per IP with Retry-After', async () => {
    const { handler } = make({ ipLimiter: new SlidingWindowLimiter(2, 3_600_000, () => NOW) });
    const h = { 'x-forwarded-for': '1.2.3.4' };
    await get(handler, circle, '', { headers: h });
    await get(handler, circle, '', { headers: h });
    const res = await get(handler, circle, '', { headers: h });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).not.toBeNull();
    expect((await get(handler, circle, '', { headers: { 'x-forwarded-for': '5.6.7.8' } })).status).toBe(200);
  });

  it('caches a book briefly so reloads do not rescan the chain', async () => {
    const { handler, calls } = make();
    await get(handler, circle);
    await get(handler, circle);
    expect(calls.build).toBe(1);
  });

  it('a chain failure is a 502 in Vietnamese and logs no detail', async () => {
    const { handler, logs } = make({
      build: async () => {
        throw new Error('rpc secret-url');
      },
    });
    const res = await get(handler, circle);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('ChainUnavailable');
    expect(body.error.message).not.toContain('secret');
    expect(logs).toEqual(['so-ho read failed']);
  });
});

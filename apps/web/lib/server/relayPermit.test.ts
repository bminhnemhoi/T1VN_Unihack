import { describe, expect, it } from 'vitest';
import { PERMIT_PER_HOUR, createRelayPermitHandler, type PermitArgs, type RelayPermitDeps } from './relayPermit';
import { createMutex } from './relay';
import { SlidingWindowLimiter } from './ratelimit';

const factory = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const usdc = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;
const circle = '0xcccccccccccccccccccccccccccccccccccccccc' as const;
const stranger = '0xdddddddddddddddddddddddddddddddddddddddd' as const;
const member = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const;
const other = '0xffffffffffffffffffffffffffffffffffffffff' as const;
const relayer = '0x9999999999999999999999999999999999999999' as const;
const NOW = 1_800_000_000_000;
const CHAIN_NOW = 1_800_000_000n;
const REQUIRED = 40_400_000n;

interface Harness {
  deps: RelayPermitDeps;
  sent: PermitArgs[];
  logs: string[];
  state: {
    isCircle: boolean;
    joined: boolean;
    circleState: number;
    permitReverts: boolean;
    allowance: bigint;
    balance: bigint;
    active: number;
    maxActive: number;
  };
}

function harness(): Harness {
  const sent: PermitArgs[] = [];
  const logs: string[] = [];
  const state = {
    isCircle: true,
    joined: true,
    circleState: 1,
    permitReverts: false,
    allowance: 0n,
    balance: 5n * 10n ** 18n,
    active: 0,
    maxActive: 0,
  };
  const publicClient = {
    async readContract(a: { functionName: string; args?: readonly unknown[] }) {
      switch (a.functionName) {
        case 'isCircle':
          return state.isCircle && a.args?.[0] === circle;
        case 'memberInfo':
          return { joined: state.joined && a.args?.[0] === member };
        case 'state':
          return state.circleState;
        case 'requiredAllowance':
          return REQUIRED;
        case 'allowance':
          return state.allowance;
        default:
          throw new Error(`unexpected read ${a.functionName}`);
      }
    },
    async getBlock() {
      return { timestamp: CHAIN_NOW };
    },
    async simulateContract() {
      if (state.permitReverts) throw new Error('ERC2612InvalidSigner');
      return {};
    },
    async getBalance() {
      return state.balance;
    },
  } as unknown as RelayPermitDeps['publicClient'];
  const deps: RelayPermitDeps = {
    publicClient,
    factory,
    usdc,
    sender: {
      address: relayer,
      async permit({ permit }) {
        state.active++;
        state.maxActive = Math.max(state.maxActive, state.active);
        await new Promise((r) => setTimeout(r, 5));
        sent.push(permit);
        state.active--;
        return `0x${sent.length.toString(16).padStart(64, '0')}`;
      },
    },
    ownerLimiter: new SlidingWindowLimiter(PERMIT_PER_HOUR, 3_600_000, () => NOW),
    ipLimiter: new SlidingWindowLimiter(1000, 3_600_000, () => NOW),
    globalLimiter: new SlidingWindowLimiter(1000, 3_600_000, () => NOW),
    sendLock: createMutex(),
    requestId: () => 'req-1',
    now: () => NOW,
    log: (_l, m, f) => void logs.push(JSON.stringify({ m, ...f })),
  };
  return { deps, sent, logs, state };
}

const permitBody = (over: Partial<Record<'owner' | 'spender' | 'value' | 'deadline' | 'v', unknown>> = {}) => ({
  permit: {
    owner: member,
    spender: circle,
    value: '40455000',
    deadline: Number(CHAIN_NOW) + 1800,
    v: 27,
    r: `0x${'ab'.repeat(32)}`,
    s: `0x${'cd'.repeat(32)}`,
    ...over,
  },
});

const post = (h: (r: Request) => Promise<Response>, b: unknown) =>
  h(new Request('http://x/api/relay/permit', { method: 'POST', body: typeof b === 'string' ? b : JSON.stringify(b) }));
const code = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe('POST /api/relay/permit', () => {
  it('sends the member-signed permit and returns the tx hash', async () => {
    const t = harness();
    const res = await post(createRelayPermitHandler(t.deps), permitBody());
    expect(res.status).toBe(200);
    expect(((await res.json()) as { txHash: string }).txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toMatchObject({ owner: member, spender: circle, value: 40_455_000n, v: 27 });
  });

  it('rejects malformed bodies and out-of-range v', async () => {
    const h = createRelayPermitHandler(harness().deps);
    expect((await post(h, 'nope')).status).toBe(400);
    expect((await post(h, { permit: {} })).status).toBe(400);
    expect((await post(h, permitBody({ v: 0 }))).status).toBe(400);
    expect((await post(h, permitBody({ value: '-1' }))).status).toBe(400);
  });

  it('check 1: the spender must be a circle of the factory', async () => {
    const t = harness();
    const res = await post(createRelayPermitHandler(t.deps), permitBody({ spender: stranger }));
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('TargetNotAllowed');
    expect(t.sent).toHaveLength(0);
  });

  it('check 2: the owner must have joined, and the circle must be Forming or Active', async () => {
    const t = harness();
    const h = createRelayPermitHandler(t.deps);
    expect(await code(await post(h, permitBody({ owner: other })))).toBe('NotAMember');
    for (const s of [2, 3, 4, 5]) {
      t.state.circleState = s;
      const res = await post(h, permitBody());
      expect(res.status).toBe(409);
      expect(await code(res)).toBe('WrongState');
    }
    t.state.circleState = 0; // Forming is allowed (join tops up allowance before activation)
    expect((await post(h, permitBody())).status).toBe(200);
    expect(t.sent).toHaveLength(1);
  });

  it('check 3: value must be positive and at most twice requiredAllowance', async () => {
    const t = harness();
    const h = createRelayPermitHandler(t.deps);
    expect(await code(await post(h, permitBody({ value: '0' })))).toBe('ValueNotAllowed');
    expect(await code(await post(h, permitBody({ value: (2n * REQUIRED + 1n).toString() })))).toBe('ValueNotAllowed');
    expect((await post(h, permitBody({ value: (2n * REQUIRED).toString() }))).status).toBe(200);
  });

  it('check 4: deadline must be in (now, now + 1 hour] on chain time', async () => {
    const t = harness();
    const h = createRelayPermitHandler(t.deps);
    const now = Number(CHAIN_NOW);
    expect(await code(await post(h, permitBody({ deadline: now })))).toBe('DeadlineInvalid');
    expect(await code(await post(h, permitBody({ deadline: now - 5 })))).toBe('DeadlineInvalid');
    expect(await code(await post(h, permitBody({ deadline: now + 3601 })))).toBe('DeadlineInvalid');
    expect((await post(h, permitBody({ deadline: now + 3600 }))).status).toBe(200);
  });

  it('check 5: a failing permit is not sent; if the allowance is already enough it is accepted without a transaction', async () => {
    const t = harness();
    const h = createRelayPermitHandler(t.deps);
    t.state.permitReverts = true;
    const bad = await post(h, permitBody());
    expect(bad.status).toBe(422);
    expect(await code(bad)).toBe('InvalidSignature');
    t.state.allowance = 40_455_000n; // front-run: somebody already submitted the same permit
    const skipped = await post(h, permitBody());
    expect(skipped.status).toBe(200);
    expect(await skipped.json()).toEqual({ skipped: true });
    expect(t.sent).toHaveLength(0);
  });

  it('check 6: 10 permits per hour per owner, charged only for permits that would execute', async () => {
    const t = harness();
    const h = createRelayPermitHandler(t.deps);
    t.state.permitReverts = true;
    for (let i = 0; i < PERMIT_PER_HOUR + 3; i++) expect((await post(h, permitBody())).status).toBe(422); // junk is free
    t.state.permitReverts = false;
    for (let i = 0; i < PERMIT_PER_HOUR; i++) expect((await post(h, permitBody())).status).toBe(200);
    const limited = await post(h, permitBody());
    expect(limited.status).toBe(429);
    expect(await code(limited)).toBe('RateLimited');
    expect(t.sent).toHaveLength(PERMIT_PER_HOUR);
  });

  it('shares the IP limit and the global hourly budget, and refuses to send when the relayer is out of AVAX', async () => {
    const t = harness();
    t.deps.globalLimiter = new SlidingWindowLimiter(1, 3_600_000, () => NOW);
    const h = createRelayPermitHandler(t.deps);
    expect((await post(h, permitBody())).status).toBe(200);
    const busy = await post(h, permitBody());
    expect(busy.status).toBe(503);
    expect(await code(busy)).toBe('RelayBusy');

    const t2 = harness();
    t2.state.balance = 4n * 10n ** 15n;
    const empty = await post(createRelayPermitHandler(t2.deps), permitBody());
    expect(empty.status).toBe(503);
    expect(await code(empty)).toBe('RelayUnavailable');
    expect(t2.sent).toHaveLength(0);

    const t3 = harness();
    t3.deps.ipLimiter = new SlidingWindowLimiter(1, 3_600_000, () => NOW);
    const h3 = createRelayPermitHandler(t3.deps);
    expect((await post(h3, permitBody())).status).toBe(200);
    expect((await post(h3, permitBody())).status).toBe(429);
  });

  it('serialises sends through the shared mutex and never logs signature parts', async () => {
    const t = harness();
    const h = createRelayPermitHandler(t.deps);
    await Promise.all([post(h, permitBody()), post(h, permitBody({ owner: member })), post(h, permitBody())]);
    expect(t.state.maxActive).toBe(1);
    const all = t.logs.join('\n');
    expect(all).not.toContain('abababab');
    expect(all).not.toContain('cdcdcdcd');
    expect(all).toContain('"outcome":"sent"');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { commitHash, memorySaltStore, saltKey, type FetchLike, type SaltStore } from 'sdk';
import type { ChainConfig } from './config';
import { devWallet } from './wallet';
import { clearPendingSignedCache, commitBid, depositBond, join, revealBid, settleRound, type TxContext } from './write';

const U = 1_000_000n;
const CIRCLE = '0x00000000000000000000000000000000000000c1' as const;
const HASH = `0x${'1'.repeat(64)}`;
const FUJI = 43113;

type Sent = { url: string; body: { request: { data: string; gas: string; to: string }; signature: string }; headers: Record<string, string> };

const ZERO = `0x${'0'.repeat(64)}`;

function setup(
  over: {
    fetchFn?: FetchLike;
    store?: SaltStore;
    maxBid?: bigint;
    onchainHash?: { hash: string };
    allowance?: bigint;
    balance?: bigint;
    joined?: boolean;
  } = {},
) {
  const sent: Sent[] = [];
  const onchain = over.onchainHash ?? { hash: ZERO };
  const client = {
    async readContract({ functionName }: { functionName: string }) {
      if (functionName === 'params') return { contribution: 10n * U, revealBondBps: 100 };
      if (functionName === 'maxBid') return over.maxBid ?? 600_000n;
      if (functionName === 'nonces') return 0n;
      if (functionName === 'currentRound') return 1;
      if (functionName === 'phase') return 1;
      if (functionName === 'allowance') return over.allowance ?? 0n;
      if (functionName === 'balanceOf') return over.balance ?? 100n * U;
      if (functionName === 'memberInfo') return { joined: Boolean(over.joined) };
      if (functionName === 'name') return 'USDC';
      if (functionName === 'version') return '2';
      if (functionName === 'commitOf') return { hash: onchain.hash };
      throw new Error(`unexpected read ${functionName}`);
    },
    async getBlock() {
      return { timestamp: 1_800_000_000n };
    },
    async waitForTransactionReceipt() {
      return { status: 'success', blockNumber: 7n, gasUsed: 100n, logs: [] };
    },
  };
  const chain = {
    network: 'anvil',
    chainId: 31337,
    factory: '0x00000000000000000000000000000000000000f1',
    registry: '0x00000000000000000000000000000000000000e1',
    usdc: '0x00000000000000000000000000000000000000d1',
    forwarder: '0x00000000000000000000000000000000000000a1',
    fromBlock: 0n,
    vndPerUsdc: 26_000,
    pollMs: 1000,
    client,
  } as unknown as ChainConfig;
  const fetchFn: FetchLike =
    over.fetchFn ??
    (async (url, init) => {
      sent.push({ url, body: JSON.parse(init.body), headers: init.headers });
      return new Response(JSON.stringify({ txHash: HASH }), { status: 200 });
    });
  const store = over.store ?? memorySaltStore();
  const wallet = devWallet(5, 31337);
  const ctx: TxContext = { chain, wallet, fetchFn, saltStore: store };
  return { ctx, sent, store, wallet, onchain };
}

beforeEach(() => {
  clearPendingSignedCache();
});

describe('commitBid', () => {
  it('saves the salt before sending and commits exactly the hash of the saved bid', async () => {
    const { ctx, sent, store, wallet } = setup();
    const r = await commitBid(ctx, CIRCLE, 1, 400_000n);
    expect(r.ok).toBe(true);
    const saved = await store.get(saltKey(CIRCLE, 1, wallet.address));
    expect(saved).toMatchObject({ bid: '400000' });
    const expected = commitHash(CIRCLE, 1, wallet.address, 400_000n, saved!.salt);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body.request.data).toContain(expected.slice(2));
    expect(sent[0]!.body.request.to).toBe(CIRCLE);
    expect(sent[0]!.headers.authorization).toBeUndefined();
  });

  it('refuses a bid above the cap or at/above C, with nothing saved or sent', async () => {
    const { ctx, sent, store } = setup();
    expect(await commitBid(ctx, CIRCLE, 1, 600_001n)).toMatchObject({ ok: false, code: 'BidTooHigh' });
    expect(await commitBid(ctx, CIRCLE, 1, 10n * U)).toMatchObject({ ok: false, code: 'BidTooHigh' });
    expect(sent).toHaveLength(0);
    expect(await store.list()).toHaveLength(0);
  });

  it('does not send when the salt cannot be stored', async () => {
    const broken: SaltStore = {
      get: async () => undefined,
      set: async () => {
        throw new Error('quota');
      },
      list: async () => [],
    };
    const { ctx, sent } = setup({ store: broken });
    expect(await commitBid(ctx, CIRCLE, 1, 1n)).toMatchObject({ ok: false, code: 'SaltNotSaved' });
    expect(sent).toHaveLength(0);
  });

  it('refuses when the wallet is on another chain than the app', async () => {
    const { ctx, sent } = setup();
    ctx.wallet = { ...ctx.wallet, chainId: FUJI };
    expect(await commitBid(ctx, CIRCLE, 1, 1n)).toMatchObject({ ok: false, code: 'WrongChain' });
    expect(sent).toHaveLength(0);
  });
});

describe('revealBid', () => {
  it('says so when nothing was committed on chain', async () => {
    const { ctx, sent } = setup();
    expect(await revealBid(ctx, CIRCLE, 1)).toMatchObject({ ok: false, code: 'NoCommit' });
    expect(sent).toHaveLength(0);
  });

  it('warns clearly and sends nothing when no saved salt matches the commit on chain', async () => {
    const { ctx, sent, onchain } = setup();
    onchain.hash = `0x${'7'.repeat(64)}`;
    const r = await revealBid(ctx, CIRCLE, 1);
    expect(r).toMatchObject({ ok: false, code: 'SaltMissing' });
    expect((r as { message: string }).message).toContain('mất cọc');
    expect(sent).toHaveLength(0);
  });

  it('reveals the bid and salt that were saved by commitBid', async () => {
    const { ctx, sent, store, wallet, onchain } = setup();
    await commitBid(ctx, CIRCLE, 1, 300_000n);
    const saved = (await store.get(saltKey(CIRCLE, 1, wallet.address)))!;
    onchain.hash = commitHash(CIRCLE, 1, wallet.address, 300_000n, saved.salt);
    const r = await revealBid(ctx, CIRCLE, 1);
    expect(r.ok).toBe(true);
    expect(sent[1]!.body.request.data).toContain(saved.salt.slice(2));
  });
});

describe('overwriting a bid (audit H-01)', () => {
  it('keeps both salts and reveals the one that matches the commit on chain, whichever send actually landed', async () => {
    const store = memorySaltStore();
    const first = setup({ store });
    await commitBid(first.ctx, CIRCLE, 1, 100_000n);
    const key = saltKey(CIRCLE, 1, first.wallet.address);
    const saltA = (await store.get(key))!;
    const hashA = commitHash(CIRCLE, 1, first.wallet.address, 100_000n, saltA.salt);
    // second commit: the relay broadcast it but the browser lost the connection (an unclear failure)
    const lost: FetchLike = async () => {
      throw new TypeError('network down');
    };
    const second = setup({ store, fetchFn: lost });
    expect(await commitBid(second.ctx, CIRCLE, 1, 200_000n)).toMatchObject({ ok: false, code: 'NetworkError' });
    const saltB = (await store.get(key))!;
    expect(saltB.salt).not.toBe(saltA.salt);

    // case 1: the first commit is what is on chain
    const asA = setup({ store, onchainHash: { hash: hashA } });
    await revealBid(asA.ctx, CIRCLE, 1);
    expect(asA.sent[0]!.body.request.data).toContain(saltA.salt.slice(2));
    // case 2: the second commit landed after all
    const hashB = commitHash(CIRCLE, 1, first.wallet.address, 200_000n, saltB.salt);
    const asB = setup({ store, onchainHash: { hash: hashB } });
    await revealBid(asB.ctx, CIRCLE, 1);
    expect(asB.sent[0]!.body.request.data).toContain(saltB.salt.slice(2));
  });

  it('refuses the wrong round or a closed commit window before saving anything', async () => {
    const { ctx, sent, store } = setup();
    expect(await commitBid(ctx, CIRCLE, 2, 1n)).toMatchObject({ ok: false, code: 'WrongRound' });
    expect(sent).toHaveLength(0);
    expect(await store.list()).toHaveLength(0);
  });
});

describe('depositBond (audit M-01)', () => {
  it('signs a permit for the bond plus the allowance already granted, so a joined organizer keeps it', async () => {
    const { ctx, sent } = setup({ allowance: 20_200_000n });
    const r = await depositBond(ctx, CIRCLE, 16n * U);
    expect(r.ok).toBe(true);
    // permit.value is the first field of the PermitSig struct inside the call data: bond 16 + 20.2 = 36.2 USDC
    expect(sent[0]!.body.request.data).toContain((36_200_000n).toString(16).padStart(64, '0'));
  });
});

describe('transaction steps (audit B22 L-02)', () => {
  it('steps_go_to_the_run_that_sent_them: two buttons sending at once never see each other\'s steps', async () => {
    const store = memorySaltStore();
    const a = setup({ store });
    const b = setup({ store });
    const seenA: string[] = [];
    const seenB: string[] = [];
    a.ctx.onStep = (s) => seenA.push(s);
    b.ctx.onStep = (s) => seenB.push(s);
    const [ra, rb] = await Promise.all([depositBond(a.ctx, CIRCLE, 10n * U), commitBid(b.ctx, CIRCLE, 1, 100_000n)]);
    expect(ra.ok && rb.ok).toBe(true);
    expect(seenA).toEqual(['sign', 'send', 'confirm']);
    expect(seenB).toEqual(['sign', 'send', 'confirm']);
  });
});

describe('retrying a sealed bid (audit B22 I-01)', () => {
  it('reads the chain first and does not resend a commit this device already landed', async () => {
    const store = memorySaltStore();
    const first = setup({ store });
    await commitBid(first.ctx, CIRCLE, 1, 100_000n);
    const saved = (await store.get(saltKey(CIRCLE, 1, first.wallet.address)))!;
    const landed = commitHash(CIRCLE, 1, first.wallet.address, 100_000n, saved.salt);
    const retry = setup({ store, onchainHash: { hash: landed } });
    expect(await commitBid(retry.ctx, CIRCLE, 1, 100_000n, { resume: true })).toMatchObject({ ok: false, code: 'AlreadyCommitted' });
    expect(retry.sent).toHaveLength(0);
  });

  it('sends when nothing of this device is on chain yet', async () => {
    const { ctx, sent } = setup();
    expect((await commitBid(ctx, CIRCLE, 1, 100_000n, { resume: true })).ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('a receipt that never comes is reported as ReceiptTimeout, so the button offers a reload, not a resend', async () => {
    const { ctx } = setup();
    (ctx.chain.client as unknown as { waitForTransactionReceipt: () => Promise<never> }).waitForTransactionReceipt = async () => {
      throw new Error('timeout');
    };
    const r = await commitBid(ctx, CIRCLE, 1, 100_000n);
    expect(r).toMatchObject({ ok: false, code: 'ReceiptTimeout' });
    expect((r as { message: string }).message).toContain('Đừng gửi lại');
  });
});

describe('B27 signing resilience and zero-balance guards', () => {
  it('reuses the cached EIP-712 signature on manual retry after NetworkError without prompting the wallet signer twice', async () => {
    let signCalls = 0;
    const offline: FetchLike = async () => {
      throw new TypeError('offline');
    };
    const a = setup({ fetchFn: offline });
    const origSign = a.ctx.wallet.signer.signTypedData.bind(a.ctx.wallet.signer);
    a.ctx.wallet = {
      ...a.ctx.wallet,
      signer: {
        address: a.ctx.wallet.signer.address,
        signTypedData: async (args) => {
          signCalls++;
          return origSign(args);
        },
      },
    };
    expect(await settleRound(a.ctx, CIRCLE)).toMatchObject({ ok: false, code: 'NetworkError' });
    expect(signCalls).toBe(1);

    // Network comes back: retrying sends the already-signed payload without calling signTypedData a second time!
    const recovered: Sent[] = [];
    a.ctx.fetchFn = async (url, init) => {
      recovered.push({ url, body: JSON.parse(init.body), headers: init.headers });
      return new Response(JSON.stringify({ txHash: HASH }), { status: 200 });
    };
    expect((await settleRound(a.ctx, CIRCLE)).ok).toBe(true);
    expect(signCalls).toBe(1);
    expect(recovered).toHaveLength(1);
  });

  it('issue #11: a settle that hits TooEarly is resent with the same signature until the block clock catches up', async () => {
    let signCalls = 0;
    const posts: Sent[] = [];
    const early = (n: number): FetchLike => async (url, init) => {
      posts.push({ url, body: JSON.parse(init.body), headers: init.headers });
      if (posts.length <= n) return new Response(JSON.stringify({ error: { code: 'TooEarly', message: 'Chưa đến thời điểm' } }), { status: 422 });
      return new Response(JSON.stringify({ txHash: HASH }), { status: 200 });
    };
    const a = setup({ fetchFn: early(2) });
    const origSign = a.ctx.wallet.signer.signTypedData.bind(a.ctx.wallet.signer);
    a.ctx.wallet = { ...a.ctx.wallet, signer: { address: a.ctx.wallet.signer.address, signTypedData: async (args) => { signCalls++; return origSign(args); } } };
    a.ctx.sleepFn = async () => {};
    expect((await settleRound(a.ctx, CIRCLE)).ok).toBe(true);
    expect(posts).toHaveLength(3);
    expect(signCalls).toBe(1);
    expect(posts[2]!.body).toEqual(posts[0]!.body);
  });

  it('issue #11: gives up after the retry budget and still reports TooEarly', async () => {
    const posts: unknown[] = [];
    const a = setup({
      fetchFn: async (_url, init) => {
        posts.push(init.body);
        return new Response(JSON.stringify({ error: { code: 'TooEarly', message: 'Chưa đến thời điểm' } }), { status: 422 });
      },
    });
    a.ctx.sleepFn = async () => {};
    expect(await settleRound(a.ctx, CIRCLE)).toMatchObject({ ok: false, code: 'TooEarly' });
    expect(posts.length).toBeGreaterThan(1);
    expect(posts.length).toBeLessThanOrEqual(6);
  });

  it('issue #13: a failed chain read while preparing a permit is a network error, not "you cancelled"', async () => {
    const { ctx, sent } = setup();
    const read = ctx.chain.client.readContract.bind(ctx.chain.client);
    (ctx.chain.client as unknown as { readContract: (a: { functionName: string }) => Promise<unknown> }).readContract = async (a) => {
      if (a.functionName === 'name') throw new TypeError('Failed to fetch'); // RPC throttled, CORS-less 429
      return read(a as never);
    };
    const r = await depositBond(ctx, CIRCLE, 48n * U);
    expect(r).toMatchObject({ ok: false, code: 'NetworkError' });
    expect((r as { message: string }).message).toContain('Bấm lại');
    expect(sent).toHaveLength(0);
  });

  it('issue #13: a wallet that really refuses (EIP-1193 code 4001) is still "you cancelled"', async () => {
    const { ctx, sent } = setup();
    ctx.wallet = {
      ...ctx.wallet,
      signer: {
        address: ctx.wallet.signer.address,
        signTypedData: async () => {
          throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
        },
      },
    };
    expect(await depositBond(ctx, CIRCLE, 48n * U)).toMatchObject({ ok: false, code: 'SignRejected' });
    expect(sent).toHaveLength(0);
  });

  it('refuses commitBid only when the wallet cannot pay the reveal deposit (B28)', async () => {
    const { ctx, sent } = setup({ balance: 50_000n }); // 0.05 USDC, the commit pulls a 0.10 USDC deposit
    expect(await commitBid(ctx, CIRCLE, 1, 500_000n)).toMatchObject({ ok: false, code: 'InsufficientBalance' });
    expect(sent).toHaveLength(0);
  });

  it('lets a wallet under one share bid: the share is pulled anyway and the winner pays nothing this round (B28)', async () => {
    const { ctx } = setup({ balance: 2_000_000n }); // 2 USDC < 10 USDC share, > 0.10 deposit
    const r = await commitBid(ctx, CIRCLE, 1, 500_000n);
    expect(r).not.toMatchObject({ code: 'InsufficientBalance' });
  });

  it('short-circuits join cleanly when memberInfo.joined is already true instead of hitting AttestationUsed', async () => {
    const neverFetch: FetchLike = async () => {
      throw new Error('must not request /api/attest when already joined');
    };
    const { ctx } = setup({ joined: true, fetchFn: neverFetch });
    const r = await join(ctx, CIRCLE, { ageConfirmed: true });
    expect(r.ok).toBe(true);
  });
});

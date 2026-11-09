import { describe, expect, it } from 'vitest';
import { commitHash, memorySaltStore, saltKey, type FetchLike, type SaltStore } from 'sdk';
import type { ChainConfig } from './config';
import { devWallet } from './wallet';
import { commitBid, depositBond, revealBid, type TxContext } from './write';

const U = 1_000_000n;
const CIRCLE = '0x00000000000000000000000000000000000000c1' as const;
const HASH = `0x${'1'.repeat(64)}`;
const FUJI = 43113;

type Sent = { url: string; body: { request: { data: string; gas: string; to: string }; signature: string }; headers: Record<string, string> };

const ZERO = `0x${'0'.repeat(64)}`;

function setup(over: { fetchFn?: FetchLike; store?: SaltStore; maxBid?: bigint; onchainHash?: { hash: string }; allowance?: bigint } = {}) {
  const sent: Sent[] = [];
  const onchain = over.onchainHash ?? { hash: ZERO };
  const client = {
    async readContract({ functionName }: { functionName: string }) {
      if (functionName === 'params') return { contribution: 10n * U };
      if (functionName === 'maxBid') return over.maxBid ?? 600_000n;
      if (functionName === 'nonces') return 0n;
      if (functionName === 'currentRound') return 1;
      if (functionName === 'phase') return 1;
      if (functionName === 'allowance') return over.allowance ?? 0n;
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

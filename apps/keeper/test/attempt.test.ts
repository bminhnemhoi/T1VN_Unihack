import { TransactionReceiptNotFoundError } from 'viem';
import { describe, expect, it } from 'vitest';
import { PENDING_FORGET_MS, createAttempt, type AttemptDeps } from '../src/attempt';

const circle = '0x00000000000000000000000000000000000000c1' as const;
type Hex = `0x${string}`;

function fake() {
  let now = 1_000_000;
  const sent: Hex[] = [];
  const mined = new Map<Hex, 'success' | 'reverted'>();
  let receiptWaitFails = false;
  const publicClient = {
    async simulateContract() {
      return {};
    },
    async estimateContractGas() {
      return 100_000n;
    },
    async waitForTransactionReceipt({ hash }: { hash: Hex }) {
      if (receiptWaitFails) throw new Error('HTTP request failed. Status: 429');
      return { status: mined.get(hash) ?? 'success', gasUsed: 90_000n };
    },
    async getTransactionReceipt({ hash }: { hash: Hex }) {
      const status = mined.get(hash);
      if (!status) throw new TransactionReceiptNotFoundError({ hash });
      return { status, gasUsed: 90_000n };
    },
  } as unknown as AttemptDeps['publicClient'];
  const wallet = {
    async writeContract() {
      const hash = `0x${(sent.length + 1).toString(16).padStart(64, '0')}` as Hex;
      sent.push(hash);
      return hash;
    },
  } as unknown as AttemptDeps['wallet'];
  const attempt = createAttempt({ publicClient, wallet, account: {}, now: () => now });
  return {
    attempt,
    sent,
    mined,
    failReceiptWait: (v: boolean) => (receiptWaitFails = v),
    advance: (ms: number) => (now += ms),
  };
}

describe('keeper attempt: a sent transaction whose receipt could not be confirmed', () => {
  it('is not sent a second time while it may still be pending, and is reported once its receipt appears', async () => {
    const t = fake();
    t.failReceiptWait(true); // the tx goes out, then polling for its receipt hits a throttled RPC
    const first = await t.attempt(circle, 'settleRound', []);
    expect(first).toMatchObject({ sent: false, code: 'TxPending' });
    expect(t.sent).toHaveLength(1);

    t.failReceiptWait(false);
    const second = await t.attempt(circle, 'settleRound', []); // next scan: the simulation would still pass
    expect(second).toMatchObject({ sent: false, code: 'TxPending' });
    expect(t.sent).toHaveLength(1); // no twin

    t.mined.set(t.sent[0]!, 'success');
    const third = await t.attempt(circle, 'settleRound', []);
    expect(third).toEqual({ sent: true, txHash: t.sent[0], gasUsed: 90_000n, ok: true });
    expect(t.sent).toHaveLength(1);
  });

  it('a pending tx that turns out reverted starts the usual revert back-off', async () => {
    const t = fake();
    t.failReceiptWait(true);
    await t.attempt(circle, 'cancel', []);
    t.mined.set(t.sent[0]!, 'reverted');
    expect(await t.attempt(circle, 'cancel', [])).toMatchObject({ sent: true, ok: false });
    expect(await t.attempt(circle, 'cancel', [])).toMatchObject({ sent: false, code: 'BackingOff' });
    expect(t.sent).toHaveLength(1);
  });

  it('a tx never mined for PENDING_FORGET_MS is assumed dropped and sent again', async () => {
    const t = fake();
    t.failReceiptWait(true);
    await t.attempt(circle, 'settleRound', []);
    t.failReceiptWait(false);
    t.advance(PENDING_FORGET_MS + 1);
    expect(await t.attempt(circle, 'settleRound', [])).toMatchObject({ sent: true, ok: true });
    expect(t.sent).toHaveLength(2);
  });

  it('pending is tracked per (circle, action, first arg): another action on the same circle is not blocked', async () => {
    const t = fake();
    t.failReceiptWait(true);
    await t.attempt(circle, 'markDefault', ['0x00000000000000000000000000000000000000a1']);
    t.failReceiptWait(false);
    expect(await t.attempt(circle, 'markDefault', ['0x00000000000000000000000000000000000000a2'])).toMatchObject({ sent: true });
    expect(t.sent).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import { createThenDeposit, type CreateFlowActions } from './create-flow';

const CIRCLE = '0x00000000000000000000000000000000000000c1' as const;
const TX = `0x${'2'.repeat(64)}` as const;

function fake(depositFailsFirst: boolean) {
  const calls = { create: 0, deposit: [] as string[] };
  let failNext = depositFailsFirst;
  const a: CreateFlowActions<{ n: number }> = {
    async createCircle() {
      calls.create++;
      return { ok: true, txHash: TX, circle: CIRCLE };
    },
    async depositBond(circle) {
      calls.deposit.push(circle);
      if (failNext) {
        failNext = false;
        return { ok: false, code: 'RelayBusy', message: 'Relay đang bận.' };
      }
      return { ok: true, txHash: TX };
    },
  };
  return { a, calls };
}

describe('createThenDeposit (audit B22 L-01)', () => {
  it('retry_after_deposit_failure_does_not_recreate', async () => {
    const { a, calls } = fake(true);
    let kept: `0x${string}` | undefined;
    const first = await createThenDeposit(a, async () => ({ n: 5 }), 480n, kept, (c) => (kept = c));
    expect(first).toMatchObject({ ok: false, code: 'RelayBusy' });
    expect((first as { message: string }).message).toContain('Nạp lại ký quỹ');
    expect(kept).toBe(CIRCLE);

    const retry = await createThenDeposit(a, async () => ({ n: 5 }), 480n, kept, (c) => (kept = c));
    expect(retry.ok).toBe(true);
    expect(calls.create).toBe(1); // no second circle
    expect(calls.deposit).toEqual([CIRCLE, CIRCLE]); // the bond goes into the same circle
  });

  it('creates once and deposits when both succeed', async () => {
    const { a, calls } = fake(false);
    const r = await createThenDeposit(a, async () => ({ n: 5 }), 480n, undefined, () => {});
    expect(r.ok).toBe(true);
    expect(calls).toEqual({ create: 1, deposit: [CIRCLE] });
  });

  it('stops before depositing when the circle could not be created', async () => {
    const calls = { deposit: 0 };
    const a: CreateFlowActions<null> = {
      createCircle: async () => ({ ok: false, code: 'SignRejected', message: 'Bạn đã huỷ.' }),
      depositBond: async () => {
        calls.deposit++;
        return { ok: true, txHash: TX };
      },
    };
    let kept: `0x${string}` | undefined;
    expect(await createThenDeposit(a, async () => null, 1n, undefined, (c) => (kept = c))).toMatchObject({ ok: false, code: 'SignRejected' });
    expect(kept).toBeUndefined();
    expect(calls.deposit).toBe(0);
  });
});

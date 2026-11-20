/**
 * One keeper transaction: simulate, estimate, send, wait for the receipt. Split out of the viem port so it can be
 * tested with fake clients.
 *
 * A transaction that was SENT but whose receipt could not be confirmed (the receipt poll hit a throttled RPC, or the
 * 180 s wait ran out) is remembered as pending. Until its receipt shows up, the same (circle, action) is not sent again:
 * before it is mined the simulation still passes, so a resend would only queue a twin that reverts and burns gas.
 * A pending transaction with no receipt after `PENDING_FORGET_MS` is assumed dropped and may be sent again.
 */
import { TransactionReceiptNotFoundError, type PublicClient, type WalletClient } from 'viem';
import { decodeError, huiCircleFullAbi } from 'sdk';
import { REVERT_BACKOFF_SECONDS, gasLimitFor } from './config.js';
import type { AttemptResult, KeeperFn } from './keeper.js';

type Address = `0x${string}`;
type Hex = `0x${string}`;

export const PENDING_FORGET_MS = 10 * 60_000;

export interface AttemptDeps {
  publicClient: Pick<PublicClient, 'simulateContract' | 'estimateContractGas' | 'waitForTransactionReceipt' | 'getTransactionReceipt'>;
  wallet: Pick<WalletClient, 'writeContract'>;
  account: unknown;
  now?: () => number;
}

export function createAttempt(deps: AttemptDeps): (circle: Address, fn: KeeperFn, args: readonly unknown[]) => Promise<AttemptResult> {
  const now = deps.now ?? Date.now;
  // (circle, action) pairs whose transaction was mined but reverted: do not burn gas on them every scan.
  const revertedUntil = new Map<string, number>();
  // (circle, action) pairs with a sent transaction whose receipt is not confirmed yet.
  const pending = new Map<string, { hash: Hex; at: number }>();

  const mined = (key: string, hash: Hex, receipt: { status: string; gasUsed: bigint }): AttemptResult => {
    const ok = receipt.status === 'success';
    if (!ok) revertedUntil.set(key, now() + REVERT_BACKOFF_SECONDS * 1000);
    return { sent: true, txHash: hash, gasUsed: receipt.gasUsed, ok };
  };
  const stillPending = (hash: Hex): AttemptResult => ({
    sent: false,
    code: 'TxPending',
    message: `transaction ${hash} was sent; waiting for its receipt before sending again`,
  });

  return async (circle, fn, args) => {
    const key = `${circle}:${fn}:${String(args[0] ?? '')}`;
    const until = revertedUntil.get(key);
    if (until !== undefined && now() < until) {
      return { sent: false, code: 'BackingOff', message: 'a previous attempt reverted on-chain; waiting to retry' };
    }

    const waiting = pending.get(key);
    if (waiting) {
      try {
        const receipt = await deps.publicClient.getTransactionReceipt({ hash: waiting.hash });
        pending.delete(key);
        return mined(key, waiting.hash, receipt);
      } catch (e) {
        const notFound = e instanceof TransactionReceiptNotFoundError;
        if (!notFound || now() - waiting.at < PENDING_FORGET_MS) return stillPending(waiting.hash);
        pending.delete(key); // never mined for a long time: dropped, send it again below
      }
    }

    const call = { address: circle, abi: huiCircleFullAbi, functionName: fn, args, account: deps.account } as never;
    let gas: bigint;
    try {
      await deps.publicClient.simulateContract(call);
      const estimate = await deps.publicClient.estimateContractGas(call);
      const limit = gasLimitFor(estimate);
      if (limit === undefined) {
        return { sent: false, code: 'GasAboveCap', message: `estimate ${estimate} exceeds the 5,000,000 cap; mark defaulters first` };
      }
      gas = limit;
    } catch (e) {
      const d = decodeError(e);
      return { sent: false, code: d.code, message: d.message };
    }

    let txHash: Hex;
    try {
      txHash = await deps.wallet.writeContract({ ...(call as object), gas } as never);
    } catch (e) {
      const d = decodeError(e);
      return { sent: false, code: d.code === 'Unknown' ? 'SendFailed' : d.code, message: d.message };
    }
    try {
      const receipt = await deps.publicClient.waitForTransactionReceipt({ hash: txHash });
      return mined(key, txHash, receipt);
    } catch {
      // The transaction is out there: remember it instead of reporting "not sent" and sending a twin next scan.
      pending.set(key, { hash: txHash, at: now() });
      return stillPending(txHash);
    }
  };
}

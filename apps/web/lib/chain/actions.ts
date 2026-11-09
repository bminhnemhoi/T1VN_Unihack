'use client';
/**
 * `useHuiActions()`: the write flows of `write.ts` bound to the current wallet and chain. Every action returns a
 * `TxResult` (never throws for expected problems) and, after a mined success, refreshes all A10 queries.
 *
 *   const actions = useHuiActions();
 *   const r = await actions?.commitBid(circle, round, bid);   // actions is null until chain AND wallet are ready
 *   if (!r.ok) show(r.message);                               // Vietnamese
 */
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { exportSalts, importSalts, indexedDbSaltStore } from 'sdk';
import { chainKey } from './hooks';
import { useChain } from './provider';
import { useHuiWallet } from './walletProvider';
import * as w from './write';

type Address = `0x${string}`;

export function useHuiActions() {
  const chain = useChain();
  const { wallet, getAccessToken } = useHuiWallet();
  const qc = useQueryClient();
  return useMemo(() => {
    if (!chain || !wallet) return null;
    const ctx: w.TxContext = {
      chain,
      wallet,
      getAccessToken,
      onMined: () => qc.invalidateQueries({ queryKey: chainKey(chain.chainId) }),
    };
    return {
      createCircle: (p: w.CreateCircleInput) => w.createCircle(ctx, p),
      depositBond: (circle: Address, amount: bigint) => w.depositBond(ctx, circle, amount),
      join: (circle: Address, o: { ageConfirmed: boolean }) => w.join(ctx, circle, o),
      leave: (circle: Address) => w.leave(ctx, circle),
      activate: (circle: Address) => w.activate(ctx, circle),
      withdrawBond: (circle: Address) => w.withdrawBond(ctx, circle),
      commitBid: (circle: Address, round: number, bid: bigint) => w.commitBid(ctx, circle, round, bid),
      revealBid: (circle: Address, round: number) => w.revealBid(ctx, circle, round),
      payLate: (circle: Address, round: number) => w.payLate(ctx, circle, round),
      repayDebt: (circle: Address, principal: bigint) => w.repayDebt(ctx, circle, principal),
      claim: (circle: Address) => w.claim(ctx, circle),
      settleRound: (circle: Address) => w.settleRound(ctx, circle),
      markDefault: (circle: Address, member: Address) => w.markDefault(ctx, circle, member),
      finalize: (circle: Address) => w.finalize(ctx, circle),
      cancel: (circle: Address) => w.cancel(ctx, circle),
      /** Password-protected backup of this wallet's sealed-bid salts (file text to download). */
      exportSaltBackup: (password: string) =>
        exportSalts(indexedDbSaltStore, password, undefined, (key) => key.split('#')[0]!.endsWith(`:${wallet.address.toLowerCase()}`)),
      /** Restore a backup file; returns how many entries were written. Throws `SaltBackupError`. */
      importSaltBackup: (fileText: string, password: string) => importSalts(indexedDbSaltStore, fileText, password),
    };
  }, [chain, wallet, getAccessToken, qc]);
}

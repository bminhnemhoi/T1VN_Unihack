'use client';
/**
 * The one place a screen asks "what circle am I showing": sample data when nothing is deployed (`useChain()` is null),
 * the chain otherwise. Both come back as the same `SampleCircleData`, so the screens do not care.
 */
import { useMemo } from 'react';
import { useChain } from '@/lib/chain/provider';
import { NotACircleError, useCircle, useCircles } from '@/lib/chain/hooks';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { toLedger, toSampleCircle } from '@/lib/chain/adapter';
import { SAMPLE_CIRCLES, SAMPLE_WALLET, type SampleCircle } from '@/lib/sample';
import { getSampleCircle, isCircleId, type SampleCircleData, type SampleShortfall } from '@/lib/sample-circles';
import { isAddress, viewToCircleData } from './circleData';

export type CircleDataState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: SampleCircleData; source: 'sample' | 'chain'; refetch?: () => void };

const ERROR = 'Không đọc được dây này từ mạng. Kiểm tra kết nối rồi thử lại.';

export function useCircleData(id: string): CircleDataState {
  const chain = useChain();
  const { wallet } = useHuiWallet();
  const q = useCircle(chain && isAddress(id) ? id : undefined);
  const viewer = wallet?.address;
  const dataUpdatedAt = q.dataUpdatedAt;
  const data = useMemo(
    () => (q.data ? viewToCircleData(q.data, viewer, Date.now()) : undefined),
    // `dataUpdatedAt` re-stamps the clock on every poll
    [q.data, viewer, dataUpdatedAt],
  );
  if (!chain) return isCircleId(id) ? { status: 'ready', data: getSampleCircle(id), source: 'sample' } : { status: 'missing' };
  if (!isAddress(id)) return { status: 'missing' };
  if (q.error instanceof NotACircleError) return { status: 'missing' };
  if (q.isError && !data) return { status: 'error', message: ERROR };
  if (!data) return { status: 'loading' };
  return { status: 'ready', data, source: 'chain', refetch: () => void q.refetch() };
}

export interface WalletSummary {
  perRound: bigint;
  paidSoFar: bigint;
  /** Circles in which the viewer has already received the pot. */
  received: number;
  /** Circles in which the viewer has not received yet. */
  waiting: number;
}

export type MyCirclesState =
  | { status: 'loading' }
  | { status: 'login' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      source: 'sample' | 'chain';
      circles: SampleCircle[];
      /** Ceiling of the bid round that is running, per circle id (bidding circles only). */
      capNow: Record<string, bigint>;
      /** The viewer's most urgent open shortfall, if any. */
      late?: { circle: SampleCircleData; shortfall: SampleShortfall };
      wallet: WalletSummary;
    };

/** "Dây của tôi": the circles the connected wallet organizes or sits in (chain), or the four samples. */
export function useMyCircles(): MyCirclesState {
  const chain = useChain();
  const { wallet, status } = useHuiWallet();
  const q = useCircles();
  const viewer = wallet?.address;
  const updated = q.dataUpdatedAt;
  const ready = useMemo((): Extract<MyCirclesState, { status: 'ready' }> | undefined => {
    if (!q.data || !viewer) return undefined;
    const nowMs = Date.now();
    const mine = q.data.filter((v) => v.organizer.toLowerCase() === viewer.toLowerCase() || v.members.some((m) => m.address.toLowerCase() === viewer.toLowerCase()));
    const datas = mine.map((v) => viewToCircleData(v, viewer, nowMs));
    const capNow: Record<string, bigint> = {};
    let perRound = 0n;
    let paidSoFar = 0n;
    let received = 0;
    let waiting = 0;
    let late: { circle: SampleCircleData; shortfall: SampleShortfall } | undefined;
    mine.forEach((v, i) => {
      const d = datas[i]!;
      const run = v.rounds.find((r) => r.k === v.currentRound);
      if (v.mode === 'bidding' && v.state === 'active' && run && (run.phase === 'commit' || run.phase === 'reveal')) capNow[v.address] = run.maxBid;
      if (d.viewer < 0) return;
      if (v.state === 'active') perRound += v.params.C;
      for (const row of toLedger(v)) {
        const cell = row.cells?.[d.viewer];
        if (cell?.kind === 'paid') paidSoFar += cell.amount;
      }
      if (d.winnerByRound.includes(d.viewer)) received++;
      else if (v.state === 'active' || v.state === 'paused') waiting++;
      const open = d.shortfalls.find((s) => s.member === d.viewer && s.status === 'grace');
      if (open && (!late || (open.graceSecondsLeft ?? 0) < (late.shortfall.graceSecondsLeft ?? 0))) late = { circle: d, shortfall: open };
    });
    return {
      status: 'ready',
      source: 'chain',
      circles: mine.map((v) => toSampleCircle(v, viewer, Math.floor(nowMs / 1000))),
      capNow,
      late,
      wallet: { perRound, paidSoFar, received, waiting },
    };
  }, [q.data, viewer, updated]);
  if (!chain) {
    return {
      status: 'ready',
      source: 'sample',
      circles: SAMPLE_CIRCLES,
      capNow: {},
      wallet: { perRound: SAMPLE_WALLET.perRound, paidSoFar: SAMPLE_WALLET.paidSoFar, received: 0, waiting: 1 },
    };
  }
  if (status === 'loading') return { status: 'loading' };
  if (!viewer) return { status: 'login' };
  if (q.isError && !ready) return { status: 'error', message: ERROR };
  return ready ?? { status: 'loading' };
}

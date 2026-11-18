'use client';
import { useEffect, useRef, useState } from 'react';
import { useChain } from '@/lib/chain/provider';
import { advanceChainSec } from './chainClock';

export { advanceChainSec, deriveLivePhase, windowLeftSec, type LiveRoomPhase } from './chainClock';

const SYNC_INTERVAL_MS = 20_000;

export function useChainNowSec(fallbackMs?: number): number {
  const chain = useChain();
  const offsetRef = useRef(0);
  const [sec, setSec] = useState<number>(() => Math.floor((fallbackMs ?? Date.now()) / 1000));

  useEffect(() => {
    if (!chain) return;
    let alive = true;
    const sync = async () => {
      try {
        const t0 = Date.now();
        const block = await chain.client.getBlock({ blockTag: 'latest' });
        if (!alive) return;
        const rttHalf = Math.round((Date.now() - t0) / 2);
        offsetRef.current = Number(block.timestamp) * 1000 - (Date.now() - rttHalf);
        setSec((prev) => advanceChainSec(Date.now(), offsetRef.current, prev));
      } catch {
        /* keep existing offset when RPC hiccups */
      }
    };
    void sync();
    const syncTimer = setInterval(() => void sync(), SYNC_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(syncTimer);
    };
  }, [chain]);

  useEffect(() => {
    const tickTimer = setInterval(() => {
      setSec((prev) => advanceChainSec(Date.now(), offsetRef.current, prev));
    }, 1000);
    return () => clearInterval(tickTimer);
  }, []);

  return sec;
}

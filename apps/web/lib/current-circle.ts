'use client';
/**
 * Which circle the "Dây" and "Sổ hụi" tabs open: the last circle the viewer looked at (remembered in this browser only),
 * else the sample room on sample data, else the viewer's first running circle on chain data.
 */
import { useEffect, useState } from 'react';
import { FUJI_EVIDENCE } from 'config';
import { useChain } from '@/lib/chain/provider';
import { useMyCircles } from '@/lib/live/useCircleData';

export { tabOf, type AppTab } from '@/lib/app-tabs';

const KEY = 'huisafe.lastCircle';

export function rememberCircle(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage blocked: the tabs fall back to the default circle
  }
}

function readCircle(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** True for an id this deployment can open: a sample id on sample data, an address on chain data. */
const fits = (id: string, onChain: boolean) => (onChain ? /^0x[0-9a-fA-F]{40}$/.test(id) : !id.startsWith('0x'));

export function useCurrentCircle(pathname: string): string | null {
  const onChain = useChain() !== null;
  const my = useMyCircles();
  const [stored, setStored] = useState<string | null>(null);
  const fromPath = /^\/circles\/([^/]+)/.exec(pathname)?.[1];
  const here = fromPath && fromPath !== 'new' ? fromPath : undefined;
  useEffect(() => {
    if (here) rememberCircle(here);
    setStored(readCircle());
  }, [here]);
  if (here) return here;
  if (stored && fits(stored, onChain)) return stored;
  if (!onChain) return 'demo';
  if (my.status === 'ready') {
    const first = my.circles.find((c) => c.state === 'active') ?? my.circles[0];
    if (first) return first.href.replace('/circles/', '');
  }
  return FUJI_EVIDENCE.defaultCircle;
}

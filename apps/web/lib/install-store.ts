'use client';
/** What the install offer needs to know about transactions: how many were confirmed, and whether one is in flight. */
import { useSyncExternalStore } from 'react';

interface Signals {
  successes: number;
  busy: number;
}
let state: Signals = { successes: 0, busy: 0 };
const listeners = new Set<() => void>();
const set = (patch: Partial<Signals>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const SERVER: Signals = { successes: 0, busy: 0 };

export const txBegin = (): void => set({ busy: state.busy + 1 });
export const txEnd = (): void => set({ busy: Math.max(0, state.busy - 1) });
export const txSuccess = (): void => set({ successes: state.successes + 1 });

export function useInstallSignals(): Signals {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
}

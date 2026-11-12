'use client';
/**
 * Demo-strip state (sample mode only): "Thử: …" cycles the network the sample screens pretend to have, so reviewers
 * can see the loading, empty and error states (lamng-design-rule §1); "Tua nhanh" moves the sample round to its next
 * phase. Nothing here touches the chain. Deterministic: no randomness, fixed latencies.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type DemoNet = 'ok' | 'slow' | 'fail' | 'empty';
export const DEMO_NETS: DemoNet[] = ['ok', 'slow', 'fail', 'empty'];
export const NET_LABEL: Record<DemoNet, string> = { ok: 'thường', slow: 'mạng chậm', fail: 'lỗi mạng', empty: 'tài khoản mới' };
/** How long a sample read takes in each mode (ms). "ok" stays under the 100 ms threshold: nothing is shown. */
export const NET_LATENCY: Record<DemoNet, number> = { ok: 0, slow: 2200, fail: 1600, empty: 0 };
/** Sign / send / confirm durations of a sample transaction (ms); "fail" breaks at the send step. */
export const TX_LATENCY: Record<DemoNet, [number, number, number]> = { ok: [300, 400, 700], slow: [900, 1300, 2600], fail: [700, 1200, 0], empty: [300, 400, 700] };

interface DemoState {
  net: DemoNet;
  /** Bumped by every change of `net`, so screens restart their sample read. */
  epoch: number;
  /** Bumped by "Tua nhanh". */
  ffwd: number;
}

let state: DemoState = { net: 'ok', epoch: 0, ffwd: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER: DemoState = { net: 'ok', epoch: 0, ffwd: 0 };

export function useDemo(): DemoState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

export function setDemoNet(net: DemoNet): void {
  state = { ...state, net, epoch: state.epoch + 1 };
  emit();
}

export function cycleDemoNet(): DemoNet {
  const next = DEMO_NETS[(DEMO_NETS.indexOf(state.net) + 1) % DEMO_NETS.length]!;
  setDemoNet(next);
  return next;
}

export function fastForward(): void {
  state = { ...state, ffwd: state.ffwd + 1 };
  emit();
}

export const demoNet = (): DemoNet => state.net;

/**
 * lamng-design-rule §1 timing: nothing for short waits, the indicator only after `delay` ms, and once shown it stays
 * at least `hold` ms so it never flashes.
 */
export function useShowAfter(active: boolean, delay = 180, hold = 300): boolean {
  const [show, setShow] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    if (active) {
      const t = setTimeout(() => {
        shownAt.current = performance.now();
        setShow(true);
      }, delay);
      return () => clearTimeout(t);
    }
    if (!show) return;
    const left = hold - (performance.now() - shownAt.current);
    if (left <= 0) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(false), left);
    return () => clearTimeout(t);
  }, [active, delay, hold, show]);
  return show;
}

export type SampleLoad = { status: 'loading' | 'error' | 'empty' | 'ready'; refreshing: boolean; stale: boolean };

/**
 * A sample read under the demo network. Data already on screen stays on screen: switching to "lỗi mạng" keeps it and
 * marks it stale (retry chip); "mạng chậm" reloads with a skeleton. A screen opened while the network fails shows the
 * error state; "tài khoản mới" shows the empty state.
 */
export function useSampleLoad(enabled: boolean): SampleLoad {
  const { net, epoch } = useDemo();
  const [s, setS] = useState<SampleLoad>(() => ({ status: !enabled || net === 'ok' ? 'ready' : net === 'empty' ? 'empty' : 'loading', refreshing: false, stale: false }));
  const mounted = useRef(false);
  const shown = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const first = !mounted.current;
    mounted.current = true;
    if (net === 'empty') {
      setS({ status: 'empty', refreshing: false, stale: false });
      shown.current = false;
      return;
    }
    if (net === 'ok') {
      setS({ status: 'ready', refreshing: false, stale: false });
      shown.current = true;
      return;
    }
    // A screen that already shows data keeps it when the network fails (stale-while-revalidate).
    const keep = net === 'fail' && shown.current && !first;
    setS(keep ? { status: 'ready', refreshing: true, stale: false } : { status: 'loading', refreshing: false, stale: false });
    const t = setTimeout(() => {
      if (net === 'fail') {
        setS(keep ? { status: 'ready', refreshing: false, stale: true } : { status: 'error', refreshing: false, stale: false });
        if (!keep) shown.current = false;
      } else {
        setS({ status: 'ready', refreshing: false, stale: false });
        shown.current = true;
      }
    }, NET_LATENCY[net]);
    return () => clearTimeout(t);
    // `epoch` restarts the read on every change of mode, even to the same one
  }, [enabled, net, epoch]);
  return s;
}

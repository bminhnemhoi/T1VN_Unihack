'use client';
/**
 * The hidden-circles list of one wallet, kept in localStorage (B25) and shared by the Overview and Cài đặt. Storage can be
 * missing or throw (private window, blocked data): the list then lives in memory for the session and nothing breaks.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { hiddenKey, parseHidden, withHidden, withoutHidden, type HiddenCircle } from '@/lib/hidden-circles';

const memory = new Map<string, string>(); // fallback when localStorage cannot be used
const parsed = new Map<string, { raw: string | null; list: HiddenCircle[] }>(); // keeps the snapshot identity stable per raw value
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}
function writeRaw(key: string, value: string): void {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* kept in memory */
  }
}

function snapshot(owner?: string): HiddenCircle[] {
  const key = hiddenKey(owner);
  const raw = readRaw(key);
  const hit = parsed.get(key);
  if (hit && hit.raw === raw) return hit.list;
  const list = parseHidden(raw);
  parsed.set(key, { raw, list });
  return list;
}
const EMPTY: HiddenCircle[] = [];

export function useHiddenCircles(owner?: string) {
  const hidden = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      window.addEventListener('storage', l);
      return () => {
        listeners.delete(l);
        window.removeEventListener('storage', l);
      };
    },
    () => snapshot(owner),
    () => EMPTY,
  );
  const hide = useCallback(
    (c: HiddenCircle) => {
      writeRaw(hiddenKey(owner), JSON.stringify(withHidden(snapshot(owner), c)));
      emit();
    },
    [owner],
  );
  const unhide = useCallback(
    (id: string) => {
      writeRaw(hiddenKey(owner), JSON.stringify(withoutHidden(snapshot(owner), id)));
      emit();
    },
    [owner],
  );
  return { hidden, hide, unhide };
}

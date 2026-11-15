'use client';
/** Open state of the first-run guide, shared by the frame (auto-open) and Cài đặt ("Xem lại hướng dẫn"). */
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openOnboarding(): void {
  open = true;
  emit();
}
export function closeOnboarding(): void {
  open = false;
  emit();
}
export function useOnboardingOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}

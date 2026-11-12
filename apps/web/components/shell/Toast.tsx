'use client';

import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'error';
interface Item {
  id: number;
  message: string;
  tone: Tone;
  /** Playing its 150 ms exit before it leaves the list. */
  leaving?: boolean;
}
interface ToastApi {
  show: (message: string, tone?: Tone) => void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(Ctx);

/** Message that every "needs wallet / network" control shows. Always Vietnamese, always says what is going on. */
export const SOON_MESSAGE = 'Chức năng này cần đăng nhập và nối mạng, sắp có. Hiện là màn hình mẫu, chưa có gì được gửi đi.';

/**
 * Small toast stack. The live region is always mounted (so screen readers announce new messages),
 * toasts last 5 s, can be dismissed, and never trap focus.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);
  // Exit is quieter than the entrance: fade and drop 8 px in 150 ms, then the item leaves the list.
  const dismiss = useCallback((id: number) => {
    setItems((l) => l.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
    setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), 150);
  }, []);
  const show = useCallback(
    (message: string, tone: Tone = 'info') => {
      const id = next.current++;
      // Same text twice in a row replaces the old toast instead of stacking.
      setItems((l) => [...l.filter((i) => i.message !== message).slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-24 z-50 flex flex-col items-center gap-2 md:bottom-8"
      >
        {items.map((i) => (
          <div
            key={i.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border-2 px-4 py-3 text-base font-semibold shadow-lg duration-150',
              i.leaving ? 'pointer-events-none animate-out fade-out slide-out-to-bottom-2 fill-mode-forwards ease-in' : 'animate-in fade-in slide-in-from-bottom-2 ease-out',
              i.tone === 'error' ? 'border-destructive bg-card text-destructive' : 'border-white/30 bg-foreground text-background',
            )}
          >
            <p className="flex-1 leading-snug">{i.message}</p>
            <button
              type="button"
              onClick={() => dismiss(i.id)}
              aria-label="Đóng thông báo"
              className="-m-2 grid size-11 shrink-0 place-content-center rounded-full opacity-80 transition-opacity hover:opacity-100 active:opacity-60"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

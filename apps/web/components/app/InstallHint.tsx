'use client';
/**
 * "Thêm vào màn hình chính" (B23 part 3). A small card above the phone menu, offered only at a good moment (see
 * `shouldOfferInstall`): never on the landing, never during a transaction or the first-run guide, and it backs off for 14
 * days after "Để sau". Android Chrome gets the real install prompt; iPhone Safari gets the share-sheet instructions.
 */
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { detectInstallPlatform, readInstallMemory, shouldOfferInstall, withVisit, writeInstallMemory, type InstallMemory, type InstallPlatform } from '@/lib/install-offer';
import { useInstallSignals } from '@/lib/install-store';
import { useOnboardingOpen } from '@/lib/onboarding-store';
import s from './InstallHint.module.css';

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallHint() {
  const pathname = usePathname();
  const onboardingOpen = useOnboardingOpen();
  const { successes, busy } = useInstallSignals();
  const [mem, setMem] = useState<InstallMemory | null>(null);
  const [env, setEnv] = useState<{ phone: boolean; standalone: boolean } | null>(null);
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const prompt = useRef<PromptEvent | null>(null);
  const offeredAt = useRef(0);
  const drag = useRef<number | null>(null);

  const remember = useCallback((next: InstallMemory) => {
    setMem(next);
    writeInstallMemory(next);
  }, []);

  useEffect(() => {
    const now = Date.now();
    const m = withVisit(readInstallMemory(), now);
    writeInstallMemory(m);
    setMem(m);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const phone = window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 760;
    setEnv({ phone, standalone });
    const detect = () => setPlatform(detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints, prompt.current !== null));
    detect();
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own card instead of the browser's mini bar
      prompt.current = e as PromptEvent;
      detect();
    };
    const onInstalled = () =>
      setMem((cur) => {
        const next = { ...(cur ?? { days: [], dismissedAt: [] }), installed: true };
        writeInstallMemory(next);
        return next;
      });
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const offer =
    mem !== null &&
    env !== null &&
    shouldOfferInstall({
      phone: env.phone,
      standalone: env.standalone,
      installed: mem.installed,
      successSinceOffer: successes > offeredAt.current,
      visitDays: mem.days.length,
      txBusy: busy > 0,
      onboardingOpen,
      pathname,
      dismissedAt: mem.dismissedAt,
      now: Date.now(),
      platform,
    });

  useEffect(() => {
    if (offer && !visible) {
      offeredAt.current = successes;
      setVisible(true);
    }
    // A busy moment takes the card away without counting as "Để sau"; the next good moment brings it back.
    if (visible && (busy > 0 || onboardingOpen)) setVisible(false);
  }, [offer, visible, successes, busy, onboardingOpen]);

  const close = useCallback(
    (snooze: boolean) => {
      setLeaving(true);
      window.setTimeout(() => {
        setVisible(false);
        setLeaving(false);
      }, 180);
      if (snooze && mem) remember({ ...mem, dismissedAt: [...mem.dismissedAt, Date.now()] });
    },
    [mem, remember],
  );

  const add = async () => {
    const p = prompt.current;
    if (!p) return close(true);
    prompt.current = null;
    await p.prompt();
    const choice = await p.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    if (choice.outcome === 'accepted' && mem) {
      remember({ ...mem, installed: true });
      setVisible(false);
    } else close(true);
  };

  if (!visible || !platform) return null;
  return (
    <aside
      className={`${s.card}${leaving ? ` ${s.out}` : ''}`}
      role="region"
      aria-label="Gợi ý thêm vào màn hình chính"
      data-testid="install-hint"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        drag.current = e.clientY;
      }}
      onPointerUp={(e) => {
        if (drag.current !== null && e.clientY - drag.current > 48) close(true);
        drag.current = null;
      }}
      onPointerCancel={() => (drag.current = null)}
    >
      <img className={s.icon} src="/brand/icon.svg" alt="" width={40} height={40} />
      <p className={s.text}>
        {platform === 'android' ? (
          'Thêm HụiSafe vào màn hình chính để mở nhanh như app.'
        ) : (
          <>
            Thêm HụiSafe vào màn hình chính: bấm nút Chia sẻ
            <svg className={s.share} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
            </svg>
            , rồi chọn &quot;Thêm vào MH chính&quot;.
          </>
        )}
      </p>
      <button type="button" className={s.close} aria-label="Đóng" onClick={() => close(true)}>
        <X aria-hidden />
      </button>
      <div className={s.actions}>
        {platform === 'android' ? (
          <button type="button" className={`${s.btn} ${s.main}`} onClick={() => void add()}>
            Thêm
          </button>
        ) : (
          <button type="button" className={`${s.btn} ${s.main}`} onClick={() => close(true)}>
            Đã hiểu
          </button>
        )}
        <button type="button" className={`${s.btn} ${s.ghost}`} onClick={() => close(true)}>
          Để sau
        </button>
      </div>
    </aside>
  );
}

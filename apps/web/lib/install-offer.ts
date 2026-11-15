/**
 * When to offer "Thêm vào màn hình chính" (B23 part 3). Pure rules plus small helpers for the browser state, so every
 * branch is testable. The offer is polite: phones only, never while something is going on, only after a good moment,
 * and it backs off for 14 days after "Để sau" (at most 3 times in all).
 */
export const DAY_MS = 86_400_000;
export const SNOOZE_DAYS = 14;
export const MAX_OFFERS = 3;

/** `android` = the browser handed us a install prompt (`beforeinstallprompt`); `ios` = Safari on iPhone or iPad, which has none. */
export type InstallPlatform = 'android' | 'ios';

export interface InstallState {
  /** Coarse pointer and 760px wide or less. */
  phone: boolean;
  /** Already running as an app (`display-mode: standalone`, `navigator.standalone`). */
  standalone: boolean;
  /** Installed earlier (`appinstalled`, or the prompt was accepted). */
  installed: boolean;
  /** A transaction was confirmed (joined, created, bid) since the last offer. */
  successSinceOffer: boolean;
  /** Number of distinct days this browser opened the app. */
  visitDays: number;
  /** A transaction is in flight right now. */
  txBusy: boolean;
  /** The first-run guide is open. */
  onboardingOpen: boolean;
  pathname: string;
  /** Times "Để sau" (or the close button) was pressed, as epoch ms. */
  dismissedAt: number[];
  now: number;
  platform: InstallPlatform | null;
}

export function shouldOfferInstall(s: InstallState): boolean {
  if (s.platform === null) return false;
  if (!s.phone || s.standalone || s.installed) return false;
  if (s.pathname === '/') return false; // the landing is for reading, not for installing
  if (s.txBusy || s.onboardingOpen) return false;
  if (s.dismissedAt.length >= MAX_OFFERS) return false;
  const last = s.dismissedAt.length > 0 ? Math.max(...s.dismissedAt) : null;
  if (last !== null && s.now - last < SNOOZE_DAYS * DAY_MS) return false;
  return s.successSinceOffer || s.visitDays >= 2;
}

/** `ios` only for Safari itself (other iOS browsers lay out the share sheet differently); `android` needs the saved prompt. */
export function detectInstallPlatform(ua: string, maxTouchPoints: number, hasPrompt: boolean): InstallPlatform | null {
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (ios) return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios' : null;
  return hasPrompt ? 'android' : null;
}

export interface InstallMemory {
  /** Local calendar days (YYYY-MM-DD), newest last, at most 10. */
  days: string[];
  dismissedAt: number[];
  installed: boolean;
}

export const INSTALL_KEY = 'huisafe.install';
const empty = (): InstallMemory => ({ days: [], dismissedAt: [], installed: false });

type Store = Pick<Storage, 'getItem' | 'setItem'>;
function browserStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readInstallMemory(store: Store | null = browserStore()): InstallMemory {
  if (!store) return empty();
  try {
    const raw = JSON.parse(store.getItem(INSTALL_KEY) ?? 'null') as Partial<InstallMemory> | null;
    return {
      days: Array.isArray(raw?.days) ? raw.days.filter((d) => typeof d === 'string').slice(-10) : [],
      dismissedAt: Array.isArray(raw?.dismissedAt) ? raw.dismissedAt.filter((n) => typeof n === 'number') : [],
      installed: raw?.installed === true,
    };
  } catch {
    return empty();
  }
}

export function writeInstallMemory(m: InstallMemory, store: Store | null = browserStore()): void {
  if (!store) return;
  try {
    store.setItem(INSTALL_KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable: the offer just works without memory */
  }
}

/** Local calendar day of a moment, as YYYY-MM-DD. */
export const dayOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Notes today as a visit day. Returns the same memory when today is already there. */
export function withVisit(m: InstallMemory, now: number): InstallMemory {
  const today = dayOf(now);
  return m.days.includes(today) ? m : { ...m, days: [...m.days, today].slice(-10) };
}

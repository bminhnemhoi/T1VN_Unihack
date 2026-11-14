/**
 * First-run guide (B23, part 2). Two questions, then a short guide that depends on the answers. Everything stays in this
 * browser (localStorage): nothing is sent to the server or to the assistant. Pure functions only, so the rules are testable.
 */
import { FUJI_EVIDENCE } from 'config';

export type PlayedBefore = 'new' | 'played';
export type Purpose = 'invite' | 'own' | 'look';
export interface Answers {
  played?: PlayedBefore;
  purpose?: Purpose;
}

/** One screen of the guide. `learn-N` are the four cards for people new to hụi, `played` the single card for the others. */
export type StepId = 'q-played' | 'q-purpose' | 'learn-1' | 'learn-2' | 'learn-3' | 'learn-4' | 'played' | 'tour';

/** The screens in order, given the answer to question 1 (not answered yet counts as "new": the longer path). */
export function stepsFor(played: PlayedBefore | undefined): StepId[] {
  return played === 'played'
    ? ['q-played', 'q-purpose', 'played', 'tour']
    : ['q-played', 'q-purpose', 'learn-1', 'learn-2', 'learn-3', 'learn-4', 'tour'];
}

/** localStorage key of the "already seen" flag of a wallet. */
export const onboardedKey = (address: string): string => `huisafe.onboarded.${address.toLowerCase()}`;
const answersKey = (address: string): string => `huisafe.onboarding.${address.toLowerCase()}`;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** `true`/`false`, or `null` when this browser gives no storage (then the guide never opens by itself). */
export function readOnboarded(address: string, store: Store | null = browserStore()): boolean | null {
  if (!store) return null;
  try {
    return store.getItem(onboardedKey(address)) === '1';
  } catch {
    return null;
  }
}

/** Marks the guide as seen and keeps the answers, on this browser only. Failures are ignored: the app never depends on it. */
export function markOnboarded(address: string, answers: Answers, store: Store | null = browserStore()): void {
  if (!store) return;
  try {
    store.setItem(onboardedKey(address), '1');
    store.setItem(answersKey(address), JSON.stringify(answers));
  } catch {
    /* private mode or full storage: skip */
  }
}

export interface AutoShowState {
  /** Signed in with a wallet. */
  signedIn: boolean;
  /** The wallet's circles have been read from the chain (not still loading, not sample data). */
  circlesLoaded: boolean;
  circleCount: number;
  /** From `readOnboarded`: `null` = no usable storage. */
  onboarded: boolean | null;
  /** Routes where a modal would sit on top of the job the person is already doing (an invite link, the login page). */
  busyRoute: boolean;
}

/** Opens by itself right after a wallet's first login, if that wallet is in no circle yet and has not seen the guide. */
export function shouldAutoShowOnboarding(s: AutoShowState): boolean {
  return s.signedIn && s.circlesLoaded && s.circleCount === 0 && s.onboarded === false && !s.busyRoute;
}

/** Routes where the guide does not open by itself. */
export function isBusyRoute(pathname: string): boolean {
  return pathname === '/dang-nhap' || pathname.startsWith('/moi/');
}

/** USDC wallet with nothing in it: the last screen then points to the faucet. */
export const needsFaucet = (usdc: bigint | undefined): boolean => usdc === 0n;

/** The main button of the last screen, by answer 2. `href` is null when it opens the paste box instead. */
export function tourAction(purpose: Purpose | undefined, onChain: boolean): { label: string; href: string | null } {
  if (purpose === 'own') return { label: 'Mở dây đầu tiên', href: '/circles/new' };
  if (purpose === 'look') return { label: 'Xem dây mẫu', href: onChain ? `/circles/${FUJI_EVIDENCE.defaultCircle}` : '/circles/demo' };
  return { label: 'Dán link mời', href: null };
}

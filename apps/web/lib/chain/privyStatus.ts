/**
 * Pure decisions for the Privy wallet state (issue #6). Kept apart from `privyHost.tsx` so they can be unit-tested.
 *
 * Signed in at Privy but no embedded wallet yet means Privy is still creating it: show "loading" for a grace period.
 * If the wallet never appears (a hung "Creating your wallet" dialog), fall back to "logged-out" so the login button is
 * offered again. `privy.login()` is a no-op while a session exists ("user is already logged in"), so in that state the
 * button must end the session first and then open the login dialog, which creates the wallet again.
 */
import type { HuiWalletValue } from './walletContext';

/** How long a signed-in session may wait for its embedded wallet before the UI offers a clean retry. */
export const WALLET_CREATION_GRACE_MS = 15_000;

export interface PrivyState {
  ready: boolean;
  authenticated: boolean;
  hasWallet: boolean;
  /** Signed in without a wallet for longer than `WALLET_CREATION_GRACE_MS`. */
  stuck: boolean;
}

export function privyStatus(s: PrivyState): HuiWalletValue['status'] {
  if (!s.ready) return 'loading';
  if (s.authenticated && s.hasWallet) return 'ready';
  if (s.authenticated && !s.stuck) return 'loading';
  return 'logged-out';
}

/** What the login button must do. */
export function loginAction(s: Pick<PrivyState, 'authenticated' | 'hasWallet'>): 'login' | 'reset-then-login' {
  return s.authenticated && !s.hasWallet ? 'reset-then-login' : 'login';
}

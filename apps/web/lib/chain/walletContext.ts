/**
 * The shape `useHuiWallet()` returns, and the context both wallet implementations fill. Kept apart from the Privy code so
 * the screens (and the provider) never pull `@privy-io/react-auth` into the first load: Privy lives in `privyHost.tsx`
 * and is fetched after the page is interactive.
 */
import { createContext } from 'react';
import type { HuiWallet } from './wallet';

export type WalletStatus = 'loading' | 'logged-out' | 'ready' | 'unavailable';

export interface HuiWalletValue {
  status: WalletStatus;
  wallet?: HuiWallet;
  login(): void;
  logout(): void;
  /** Privy access token for `/api/attest` and `createCircle`; `null` for the dev wallet. */
  getAccessToken(): Promise<string | null>;
  /** Dev wallet only: which anvil account (0..9). */
  devIndex?: number;
  setDevIndex?(index: number): void;
}

export const UNAVAILABLE: HuiWalletValue = {
  status: 'unavailable',
  login() {},
  logout() {},
  getAccessToken: async () => null,
};

export const WalletCtx = createContext<HuiWalletValue>(UNAVAILABLE);

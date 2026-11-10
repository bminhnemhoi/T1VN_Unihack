'use client';
/**
 * `useHuiWallet()` for the screens. With `NEXT_PUBLIC_PRIVY_APP_ID` set (a public identifier by design) the wallet is
 * the Privy embedded wallet, login via Google or email; Privy is loaded lazily (see `privyHost.tsx`) and until it
 * arrives `status` is 'loading'. Without the id, and only when the chain is the local anvil node, a dev wallet is used
 * (anvil default accounts, picked by index). On any other chain without Privy there is no wallet and `status` is
 * 'unavailable'. Secrets (`PRIVY_APP_SECRET`) are never read here.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useChain } from './provider';
import { ANVIL_CHAIN_ID, devWallet } from './wallet';
import { UNAVAILABLE, WalletCtx, type HuiWalletValue } from './walletContext';
import type { PrivyHostProps } from './privyHost';

export type { HuiWalletValue, WalletStatus } from './walletContext';

export function useHuiWallet(): HuiWalletValue {
  return useContext(WalletCtx);
}

function DevBridge({ children }: { children: ReactNode }) {
  const chain = useChain();
  const [index, setIndex] = useState<number | undefined>(undefined);
  const wallet = useMemo(() => {
    if (index === undefined || chain?.chainId !== ANVIL_CHAIN_ID) return undefined;
    try {
      return devWallet(index, chain.chainId); // throws in a production build: stay logged out instead of crashing the tree
    } catch {
      return undefined;
    }
  }, [index, chain?.chainId]);
  const value = useMemo<HuiWalletValue>(
    () => ({
      status: chain?.chainId !== ANVIL_CHAIN_ID ? 'unavailable' : wallet ? 'ready' : 'logged-out',
      wallet,
      login: () => setIndex((i) => i ?? 5),
      logout: () => setIndex(undefined),
      getAccessToken: async () => null,
      devIndex: index,
      setDevIndex: setIndex,
    }),
    [chain?.chainId, wallet, index],
  );
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

/** Runs `fn` once the browser is idle (or soon after, where `requestIdleCallback` does not exist). */
function whenIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: 2_000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 200);
  return () => window.clearTimeout(id);
}

/** Privy keeps its session in localStorage under `privy:*`. No such entry means nobody is signed in on this browser. */
function hasPrivySession(): boolean {
  try {
    return Object.keys(window.localStorage).some((name) => name.startsWith('privy:'));
  } catch {
    return true; // storage blocked: let Privy find out
  }
}

/**
 * Privy is about 1 MB of script, so it is not fetched for a visitor who has no session: they see 'logged-out' at once and
 * the chunk loads when they press "Đăng nhập" (the press is remembered and replayed once Privy is ready). A returning
 * visitor (a `privy:*` entry in localStorage) gets it when the browser is idle, to restore the session. Until the first
 * check finishes (and while Privy starts) `status` is 'loading'.
 */
function LazyPrivy({ appId, children }: { appId: string; children: ReactNode }) {
  const [Host, setHost] = useState<ComponentType<PrivyHostProps> | null>(null);
  const [live, setLive] = useState<HuiWalletValue | null>(null);
  const [failed, setFailed] = useState(false);
  const [session, setSession] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const started = useRef(false);
  const wantLogin = useRef(false);

  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    import('./privyHost').then(
      (m) => setHost(() => m.PrivyHost),
      () => setFailed(true),
    );
  }, []);
  useEffect(() => {
    const has = hasPrivySession();
    setSession(has ? 'yes' : 'no');
    return has ? whenIdle(load) : undefined;
  }, [load]);

  const onValue = useCallback((v: HuiWalletValue) => {
    setLive(v);
    if (wantLogin.current && v.status === 'logged-out') {
      wantLogin.current = false;
      v.login();
    } else if (v.status === 'ready' || v.status === 'unavailable') {
      wantLogin.current = false; // already signed in: a stale press must not reopen the login after a later logout
    }
  }, []);

  const stub = useMemo<HuiWalletValue>(
    () =>
      failed
        ? UNAVAILABLE
        : {
            status: session === 'no' ? 'logged-out' : 'loading',
            login: () => {
              wantLogin.current = true;
              load();
            },
            logout() {},
            getAccessToken: async () => null,
          },
    [failed, load, session],
  );

  return (
    <WalletCtx.Provider value={live ?? stub}>
      {children}
      {Host && <Host appId={appId} onValue={onValue} />}
    </WalletCtx.Provider>
  );
}

/** Place inside `<ChainProvider>`. `privyAppId` defaults to `NEXT_PUBLIC_PRIVY_APP_ID`. */
export function HuiWalletProvider({ privyAppId, children }: { privyAppId?: string; children: ReactNode }) {
  const appId = privyAppId ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    return process.env.NODE_ENV === 'production' ? <WalletCtx.Provider value={UNAVAILABLE}>{children}</WalletCtx.Provider> : <DevBridge>{children}</DevBridge>;
  }
  return <LazyPrivy appId={appId}>{children}</LazyPrivy>;
}

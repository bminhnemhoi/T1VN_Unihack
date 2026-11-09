'use client';
/**
 * `useHuiWallet()` for the screens. With `NEXT_PUBLIC_PRIVY_APP_ID` set (a public identifier by design) the wallet is
 * the Privy embedded wallet, login via Google or email. Without it, and only when the chain is the local anvil node,
 * a dev wallet is used (anvil default accounts, picked by index). On any other chain without Privy there is no wallet
 * and `status` is 'unavailable'. Secrets (`PRIVY_APP_SECRET`) are never read here.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createWalletClient, custom } from 'viem';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { avalancheFuji } from 'viem/chains';
import type { TypedDataSigner } from 'sdk';
import { useChain } from './provider';
import { ANVIL_CHAIN_ID, devWallet, type HuiWallet } from './wallet';

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

const UNAVAILABLE: HuiWalletValue = {
  status: 'unavailable',
  login() {},
  logout() {},
  getAccessToken: async () => null,
};
const Ctx = createContext<HuiWalletValue>(UNAVAILABLE);

export function useHuiWallet(): HuiWalletValue {
  return useContext(Ctx);
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
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function PrivyBridge({ children }: { children: ReactNode }) {
  const chain = useChain();
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const embedded = wallets.find((w) => w.walletClientType === 'privy');

  const signer = useMemo<TypedDataSigner | undefined>(() => {
    if (!embedded || !chain) return undefined;
    return {
      address: embedded.address as `0x${string}`,
      async signTypedData(args) {
        await embedded.switchChain(chain.chainId);
        const provider = await embedded.getEthereumProvider();
        const client = createWalletClient({ account: embedded.address as `0x${string}`, transport: custom(provider) });
        return client.signTypedData(args as never);
      },
    };
  }, [embedded, chain]);

  const wallet = useMemo<HuiWallet | undefined>(
    () => (signer && chain ? { kind: 'privy', address: signer.address, chainId: chain.chainId, signer } : undefined),
    [signer, chain],
  );
  const token = useCallback(() => getAccessToken(), [getAccessToken]);
  const value = useMemo<HuiWalletValue>(
    () => ({
      status: !ready ? 'loading' : authenticated && wallet ? 'ready' : 'logged-out',
      wallet,
      login: () => void login(),
      logout: () => void logout(),
      getAccessToken: token,
    }),
    [ready, authenticated, wallet, login, logout, token],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Place inside `<ChainProvider>`. `privyAppId` defaults to `NEXT_PUBLIC_PRIVY_APP_ID`. */
export function HuiWalletProvider({ privyAppId, children }: { privyAppId?: string; children: ReactNode }) {
  const appId = privyAppId ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    return process.env.NODE_ENV === 'production' ? <Ctx.Provider value={UNAVAILABLE}>{children}</Ctx.Provider> : <DevBridge>{children}</DevBridge>;
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: avalancheFuji,
        supportedChains: [avalancheFuji],
        loginMethods: ['google', 'email'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
      }}
    >
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  );
}

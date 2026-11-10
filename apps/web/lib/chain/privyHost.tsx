'use client';
/**
 * The Privy half of the wallet. Imported dynamically by `walletProvider.tsx` (only when `NEXT_PUBLIC_PRIVY_APP_ID` is
 * set), so `@privy-io/react-auth` is a separate chunk instead of part of the first load of every page.
 *
 * It does not wrap the app. It renders next to the app's children and reports its `HuiWalletValue` upward, so the
 * children tree keeps its place (no remount, no lost form state) when this chunk arrives.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { createWalletClient, custom } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import type { TypedDataSigner } from 'sdk';
import { useChain } from './provider';
import type { HuiWallet } from './wallet';
import type { HuiWalletValue } from './walletContext';

function usePrivyValue(): HuiWalletValue {
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
  return useMemo<HuiWalletValue>(
    () => ({
      status: !ready ? 'loading' : authenticated && wallet ? 'ready' : 'logged-out',
      wallet,
      login: () => void login(),
      logout: () => void logout(),
      getAccessToken: token,
    }),
    [ready, authenticated, wallet, login, logout, token],
  );
}

function Reporter({ onValue }: { onValue: (v: HuiWalletValue) => void }) {
  const value = usePrivyValue();
  useEffect(() => onValue(value), [value, onValue]);
  return null;
}

export interface PrivyHostProps {
  appId: string;
  onValue: (v: HuiWalletValue) => void;
}

export function PrivyHost({ appId, onValue }: PrivyHostProps) {
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
      <Reporter onValue={onValue} />
    </PrivyProvider>
  );
}

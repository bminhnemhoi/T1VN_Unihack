'use client';
/**
 * The Privy half of the wallet. Imported dynamically by `walletProvider.tsx` (only when `NEXT_PUBLIC_PRIVY_APP_ID` is
 * set), so `@privy-io/react-auth` is a separate chunk instead of part of the first load of every page.
 *
 * It does not wrap the app. It renders next to the app's children and reports its `HuiWalletValue` upward, so the
 * children tree keeps its place (no remount, no lost form state) when this chunk arrives.
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import { createWalletClient, custom } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { PrivyProvider, usePrivy, useWallets, type PrivyClientConfig } from '@privy-io/react-auth';
import type { TypedDataSigner } from 'sdk';
import { useChain } from './provider';
import type { HuiWallet } from './wallet';
import type { HuiWalletValue } from './walletContext';

/**
 * Privy hands out new function and wallet objects on its own re-renders. The value reported upward must change only when
 * something the app can see changes (ready, signed in, wallet address, chain): otherwise `Reporter` -> `onValue` ->
 * `setLive` re-renders Privy, which hands out new objects again, and React stops with "Maximum update depth exceeded"
 * (error #185) the moment Privy loads. Functions read the latest Privy objects through a ref when they are called.
 */
function usePrivyValue(): HuiWalletValue {
  const chain = useChain();
  const privy = usePrivy();
  const { wallets } = useWallets();
  const embedded = wallets.find((w) => w.walletClientType === 'privy');
  const latest = useRef({ privy, embedded });
  latest.current = { privy, embedded };

  const address = embedded?.address as `0x${string}` | undefined;
  const chainId = chain?.chainId;
  const wallet = useMemo<HuiWallet | undefined>(() => {
    if (!address || chainId === undefined) return undefined;
    const signer: TypedDataSigner = {
      address,
      async signTypedData(args) {
        const w = latest.current.embedded;
        if (!w || w.address.toLowerCase() !== address.toLowerCase()) throw new Error('Privy wallet changed');
        await w.switchChain(chainId);
        const provider = await w.getEthereumProvider();
        const client = createWalletClient({ account: address, transport: custom(provider) });
        return client.signTypedData(args as never);
      },
    };
    return { kind: 'privy', address, chainId, signer };
  }, [address, chainId]);

  const { ready, authenticated } = privy;
  return useMemo<HuiWalletValue>(
    () => ({
      status: !ready ? 'loading' : authenticated && wallet ? 'ready' : 'logged-out',
      wallet,
      login: () => void latest.current.privy.login(),
      logout: () => void latest.current.privy.logout(),
      getAccessToken: () => latest.current.privy.getAccessToken(),
    }),
    [ready, authenticated, wallet],
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

/** Module constant: a new `config` object on every render makes PrivyProvider re-initialise. */
const PRIVY_CONFIG = {
  defaultChain: avalancheFuji,
  supportedChains: [avalancheFuji],
  loginMethods: ['google', 'email'],
  embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
} satisfies PrivyClientConfig;

/** Memoised: the parent's own state updates (it stores the reported value) must not re-render the Privy tree. */
export const PrivyHost = memo(function PrivyHost({ appId, onValue }: PrivyHostProps) {
  return (
    <PrivyProvider appId={appId} config={PRIVY_CONFIG}>
      <Reporter onValue={onValue} />
    </PrivyProvider>
  );
});

'use client';
/**
 * The Privy half of the wallet. Imported dynamically by `walletProvider.tsx` (only when `NEXT_PUBLIC_PRIVY_APP_ID` is
 * set), so `@privy-io/react-auth` is a separate chunk instead of part of the first load of every page.
 *
 * It does not wrap the app. It renders next to the app's children and reports its `HuiWalletValue` upward, so the
 * children tree keeps its place (no remount, no lost form state) when this chunk arrives.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createWalletClient, custom, verifyTypedData } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { PrivyProvider, usePrivy, useSignTypedData, useWallets, type PrivyClientConfig } from '@privy-io/react-auth';
import { huiCircleFullAbi, huiFactoryAbi, type TypedDataSigner } from 'sdk';
import { WALLET_CREATION_GRACE_MS, loginAction, privyStatus } from './privyStatus';
import { quietSignAllowed } from './quietSign';
import { useChain } from './provider';
import type { HuiWallet } from './wallet';
import type { HuiWalletValue } from './walletContext';

/**
 * Privy hands out new function and wallet objects on its own re-renders. The value reported upward must change only when
 * something the app can see changes (ready, signed in, wallet address, chain): otherwise `Reporter` -> `onValue` ->
 * `setLive` re-renders Privy, which hands out new objects again, and React stops with "Maximum update depth exceeded"
 * (error #185) the moment Privy loads. Functions read the latest Privy objects through a ref when they are called.
 */
/** Typed data with every bigint as a decimal string: the Privy hook serialises to JSON, EIP-712 reads them the same. */
function jsonSafe(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jsonSafe(x)]));
  return v;
}

function usePrivyValue(): HuiWalletValue {
  const chain = useChain();
  const privy = usePrivy();
  const { wallets } = useWallets();
  const embedded = wallets.find((w) => w.walletClientType === 'privy');
  const { signTypedData: privySign } = useSignTypedData();
  const latest = useRef({ privy, embedded, privySign, chain });
  latest.current = { privy, embedded, privySign, chain };

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
        // B28: HụiSafe's own forward requests and circle permits are signed without Privy's pop-up (the app's button
        // and step indicator are the confirmation); anything else keeps the pop-up. See lib/chain/quietSign.ts.
        const ch = latest.current.chain;
        // Freeze the request before checking it: what is checked is exactly what gets signed (audit B28 L-03).
        args = structuredClone(args);
        const quiet =
          ch !== null &&
          (await quietSignAllowed(args as never, {
            address,
            chainId,
            forwarder: ch.forwarder,
            usdc: ch.usdc,
            factory: ch.factory,
            isCircle: async (a) => (await ch.client.readContract({ address: ch.factory, abi: huiFactoryAbi, functionName: 'isCircle', args: [a] })) as boolean,
            requiredAllowance: async (a) => (await ch.client.readContract({ address: a, abi: huiCircleFullAbi, functionName: 'requiredAllowance' })) as bigint,
            nowSec: () => Math.floor(Date.now() / 1000),
          }));
        if (quiet) {
          try {
            const { signature } = await latest.current.privySign(jsonSafe(args) as never, { address, uiOptions: { showWalletUIs: false } });
            // Never hand out a signature that does not verify locally: on any mismatch, fall back to the pop-up path.
            if (await verifyTypedData({ address, ...(args as object), signature: signature as `0x${string}` } as never)) return signature as `0x${string}`;
          } catch {
            /* fall through to the Privy pop-up */
          }
        }
        const provider = await w.getEthereumProvider();
        const client = createWalletClient({ account: address, transport: custom(provider) });
        return client.signTypedData(args as never);
      },
    };
    return { kind: 'privy', address, chainId, signer };
  }, [address, chainId]);

  const { ready, authenticated } = privy;
  // Issue #6: signed in but no embedded wallet yet. Start a grace timer; if the wallet never shows up, report
  // "logged-out" so the user is not stuck behind a dead "Creating your wallet" dialog (see lib/chain/privyStatus.ts).
  const pending = ready && authenticated && !wallet;
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!pending) {
      setStuck(false);
      return;
    }
    const t = setTimeout(() => setStuck(true), WALLET_CREATION_GRACE_MS);
    return () => clearTimeout(t);
  }, [pending]);
  return useMemo<HuiWalletValue>(
    () => ({
      status: privyStatus({ ready, authenticated, hasWallet: wallet !== undefined, stuck }),
      wallet,
      login: () => {
        const { privy: p, embedded: w } = latest.current;
        if (loginAction({ authenticated: p.authenticated, hasWallet: w !== undefined }) === 'reset-then-login') {
          void (async () => {
            try {
              await p.logout();
            } finally {
              latest.current.privy.login();
            }
          })();
        } else {
          void p.login();
        }
      },
      logout: () => void latest.current.privy.logout(),
      getAccessToken: () => latest.current.privy.getAccessToken(),
    }),
    [ready, authenticated, wallet, stuck],
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

'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { erc20Abi } from 'viem';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';

type Address = `0x${string}`;

export interface WalletBalance {
  /** USDC in base units (6 decimals). */
  usdc: bigint;
  /** AVAX in wei. Not needed to use HụiSafe (the relayer pays gas); shown so a tester knows what the wallet holds. */
  avax: bigint;
}

/** USDC and AVAX balance of a wallet on the deployed chain, refreshed on the chain's poll interval. Read only. */
export function useWalletBalance(owner: Address | undefined): UseQueryResult<WalletBalance> {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'balance', owner?.toLowerCase()),
    enabled: Boolean(chain && owner),
    refetchInterval: chain?.pollMs,
    // Keep the last numbers on screen while refreshing (lamng-design-rule section 1).
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const [usdc, avax] = await Promise.all([
        chain!.client.readContract({ address: chain!.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [owner!] }),
        chain!.client.getBalance({ address: owner! }),
      ]);
      return { usdc, avax };
    },
  });
}

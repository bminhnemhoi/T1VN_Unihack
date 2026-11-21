'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { huiCircleFullAbi, iReputationRegistryAbi } from 'sdk';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';
import { hasUnresolvedDefault } from '@/lib/entryRules';

type Address = `0x${string}`;

/**
 * Issue #17: does this wallet have an unresolved default (docs/05 section 8.1)? Read only, so the invite page can warn
 * before the person ticks and signs, instead of `/api/attest` refusing at the end. The server stays the gate.
 */
export function useUnresolvedDefault(circle: Address | undefined, owner: Address | undefined): UseQueryResult<boolean> {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'unresolved-default', circle?.toLowerCase(), owner?.toLowerCase()),
    enabled: Boolean(chain && circle && owner),
    staleTime: 30_000,
    queryFn: async () => {
      const registry = (await chain!.client.readContract({ address: circle!, abi: huiCircleFullAbi, functionName: 'reputation' })) as Address;
      const rep = (await chain!.client.readContract({
        address: registry,
        abi: iReputationRegistryAbi,
        functionName: 'reputationOf',
        args: [owner!],
      })) as { defaults: number; repaid: number };
      return hasUnresolvedDefault(rep);
    },
  });
}

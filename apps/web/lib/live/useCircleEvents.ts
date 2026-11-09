'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getCircleEvents, huiCircleFullAbi, type CircleEvent } from 'sdk';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';

type Address = `0x${string}`;

/** Every event of one circle, oldest first, with block timestamps. Feeds the book (sổ hụi) and the transaction links. */
export function useCircleEvents(circle: Address | undefined): UseQueryResult<CircleEvent[]> {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'events', circle?.toLowerCase()),
    enabled: Boolean(chain && circle),
    refetchInterval: chain?.pollMs,
    queryFn: () => getCircleEvents(chain!.client, circle!, { fromBlock: chain!.fromBlock, withTimestamps: true }),
  });
}

/** Claimable balance (`claimable(address)`) of a wallet in a circle: money the circle could not push and waits for `claim()`. */
export function useClaimable(circle: Address | undefined, member: Address | undefined): UseQueryResult<bigint> {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'claimable', circle?.toLowerCase(), member?.toLowerCase()),
    enabled: Boolean(chain && circle && member),
    refetchInterval: chain?.pollMs,
    queryFn: async () => (await chain!.client.readContract({ address: circle!, abi: huiCircleFullAbi, functionName: 'claimable', args: [member!] })) as bigint,
  });
}

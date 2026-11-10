'use client';
/**
 * The two v1.2 parameters `CircleView` does not carry yet (phi and the agreement hash), read straight from `params()`.
 * Kept as its own small query so the screens do not wait on the SDK read layer (A14 adds both to `CircleView`; when it does,
 * this hook and its single call site in `useCircleData` can go).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { huiCircleFullAbi } from 'sdk';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';

type Address = `0x${string}`;

export interface CircleExtras {
  /** phi in bps (docs/03 section 2.7); 0 = fixed fee. */
  commissionShareBps: number;
  /** `keccak256` of the agreement text the organizer committed to (ADR-27). */
  termsHash: `0x${string}`;
}

export function useCircleExtras(circle: Address | undefined): UseQueryResult<CircleExtras> {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'extras', circle?.toLowerCase()),
    enabled: Boolean(chain && circle),
    // Immutable after activation, so no polling; a circle still forming is re-read when the page is opened again.
    staleTime: 60_000,
    queryFn: async (): Promise<CircleExtras> => {
      const p = (await chain!.client.readContract({ address: circle!, abi: huiCircleFullAbi, functionName: 'params' })) as {
        commissionShareBps: number;
        termsHash: `0x${string}`;
      };
      return { commissionShareBps: Number(p.commissionShareBps), termsHash: p.termsHash };
    },
  });
}

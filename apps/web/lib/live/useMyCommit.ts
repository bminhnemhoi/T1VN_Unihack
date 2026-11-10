'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { huiCircleFullAbi, loadSalt } from 'sdk';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';

type Address = `0x${string}`;
const ZERO = `0x${'0'.repeat(64)}`;

export interface MyCommit {
  /** The wallet has sealed a bid in this round. */
  committed: boolean;
  revealed: boolean;
  /** Only meaningful once revealed. */
  bid: bigint;
  /** The secret needed to open the bid is stored on this device. */
  saltOnDevice: boolean;
}

/** What `commitOf(round, member)` says on chain, plus whether this browser still has the salt. */
export function useMyCommit(circle: Address | undefined, round: number, member: Address | undefined): UseQueryResult<MyCommit> {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'commit', circle?.toLowerCase(), round, member?.toLowerCase()),
    enabled: Boolean(chain && circle && member && round > 0),
    refetchInterval: chain?.pollMs,
    queryFn: async (): Promise<MyCommit> => {
      const c = (await chain!.client.readContract({
        address: circle!,
        abi: huiCircleFullAbi,
        functionName: 'commitOf',
        args: [round, member!],
      })) as { hash: string; revealed: boolean; bid: bigint };
      const committed = c.hash !== ZERO;
      let saltOnDevice = false;
      try {
        saltOnDevice = committed && (await loadSalt(circle!, round, member!)) !== undefined;
      } catch {
        saltOnDevice = false;
      }
      return { committed, revealed: c.revealed, bid: c.bid, saltOnDevice };
    },
  });
}

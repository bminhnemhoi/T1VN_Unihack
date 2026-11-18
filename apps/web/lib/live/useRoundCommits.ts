'use client';
/**
 * Live head-block `commitOf(round, member)` reader for every joined seat of an active bidding round.
 * Multicall3 batches all seats into ONE JSON-RPC request, giving 0-second-lag multiplayer status
 * ("Phong bì #1", "Cao nhất") even before the explorer indexes recent blocks.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { huiCircleFullAbi, type RoundCommitView } from 'sdk';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';

type Address = `0x${string}`;
const ZERO = `0x${'0'.repeat(64)}`;

export function useRoundCommits(
  circle: Address | undefined,
  round: number,
  members: readonly Address[],
  enabled: boolean,
): UseQueryResult<RoundCommitView[]> {
  const chain = useChain();
  const keyMembers = members.map((m) => m.toLowerCase()).join(',');
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'round-commits', circle?.toLowerCase(), round, keyMembers),
    enabled: Boolean(chain && circle && round > 0 && members.length > 0 && enabled),
    refetchInterval: chain?.pollMs,
    queryFn: async (): Promise<RoundCommitView[]> => {
      const rows = await Promise.all(
        members.map(async (member) => {
          const c = (await chain!.client.readContract({
            address: circle!,
            abi: huiCircleFullAbi,
            functionName: 'commitOf',
            args: [round, member],
          })) as { hash: string; commitIndex: number; revealed: boolean; bid: bigint };
          if (!c || c.hash === ZERO || Number(c.commitIndex) === 0) return null;
          const out: RoundCommitView = {
            member,
            commitIndex: Number(c.commitIndex),
            revealed: Boolean(c.revealed),
            ...(c.revealed ? { bid: BigInt(c.bid) } : {}),
          };
          return out;
        }),
      );
      return rows.filter((r): r is RoundCommitView => r !== null).sort((a, b) => a.commitIndex - b.commitIndex);
    },
  });
}

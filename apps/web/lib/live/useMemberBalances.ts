'use client';
/**
 * Reads USDC balances of joined members while a circle is in `Forming`, so the Organizer can verify every seat still
 * holds at least 1 round contribution (`C`) right before pressing "Bắt đầu dây" — without exposing exact wallet totals.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { erc20Abi } from 'viem';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';

type Address = `0x${string}`;

export function useMemberBalances(members: readonly Address[], enabled: boolean): UseQueryResult<Record<string, bigint>> {
  const chain = useChain();
  const keyMembers = members.map((m) => m.toLowerCase()).join(',');
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'member-balances', keyMembers),
    enabled: Boolean(chain && members.length > 0 && enabled),
    refetchInterval: chain ? Math.max(chain.pollMs, 6_000) : undefined,
    queryFn: async (): Promise<Record<string, bigint>> => {
      const balances = await Promise.all(
        members.map((m) =>
          chain!.client.readContract({
            address: chain!.usdc,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [m],
          }) as Promise<bigint>,
        ),
      );
      const out: Record<string, bigint> = {};
      members.forEach((m, i) => {
        out[m.toLowerCase()] = BigInt(balances[i] ?? 0n);
      });
      return out;
    },
  });
}

'use client';
/**
 * Read hooks over `packages/sdk` (A10, no wallet writes). They stay disabled (`data` undefined, `enabled: false`)
 * when the network is not deployed. Query keys start with ['huisafe', chainId, ...] so the write side (A11) can
 * invalidate them after a mined transaction.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getAddress } from 'viem';
import {
  listCircles,
  readCircle,
  readMemberStanding,
  readOrganizerStanding,
  reputationOf,
  type CircleView,
  type ReputationRecord,
  type TierResult,
} from 'sdk';
import { useChain } from './provider';

type Address = `0x${string}`;

const normalizeAddress = (a: Address | undefined): Address | undefined => {
  if (!a) return undefined;
  try {
    return getAddress(a.toLowerCase());
  } catch {
    return undefined;
  }
};

export const chainKey = (chainId: number, ...rest: unknown[]) => ['huisafe', chainId, ...rest] as const;

/** One circle as the docs/05 `CircleView`. */
export function useCircle(address: Address | undefined): UseQueryResult<CircleView> {
  const chain = useChain();
  const norm = normalizeAddress(address);
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'circle', norm?.toLowerCase()),
    enabled: Boolean(chain && norm),
    refetchInterval: chain?.pollMs,
    queryFn: () =>
      readCircle(chain!.client, norm!, { fromBlock: chain!.fromBlock, factory: chain!.factory, vndPerUsdc: chain!.vndPerUsdc }),
  });
}

/** Circle views of everything in the directory, or of one organizer's circles. */
export function useCircles(opts: { organizer?: Address } = {}): UseQueryResult<CircleView[]> {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'circles', opts.organizer?.toLowerCase() ?? 'all'),
    enabled: Boolean(chain),
    refetchInterval: chain ? Math.max(chain.pollMs * 2, 10_000) : undefined,
    queryFn: async () => {
      const addrs = await listCircles(chain!.client, chain!.factory, opts);
      return Promise.all(
        addrs.map((a) =>
          readCircle(chain!.client, a, { fromBlock: chain!.fromBlock, factory: chain!.factory, vndPerUsdc: chain!.vndPerUsdc }),
        ),
      );
    },
  });
}

export interface ReputationData {
  record: ReputationRecord;
  /** Member badge (Mới / Tin cậy / Lâu năm) and what is missing for the next one. */
  member: TierResult;
  /** Organizer badge, derived from the circles this wallet ran. */
  organizer: TierResult;
}

/** Counters from the registry plus both badges for a wallet. Display only. */
export function useReputation(address: Address | undefined): UseQueryResult<ReputationData> {
  const chain = useChain();
  return useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'reputation', address?.toLowerCase()),
    enabled: Boolean(chain && address),
    refetchInterval: chain ? chain.pollMs * 4 : undefined,
    queryFn: async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const o = { factory: chain!.factory, registry: chain!.registry, fromBlock: chain!.fromBlock, nowSec };
      const [record, member, organizer] = await Promise.all([
        reputationOf(chain!.client, chain!.registry, address!),
        readMemberStanding(chain!.client, address!, o),
        readOrganizerStanding(chain!.client, address!, o),
      ]);
      return { record, member: member.result, organizer: organizer.result };
    },
  });
}

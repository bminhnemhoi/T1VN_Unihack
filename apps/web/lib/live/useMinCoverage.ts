'use client';
/**
 * The activation floor (`minCoverageBps`) the contract enforces in `activate()`. Fuji deploys with 10000 (ADR-22), so a
 * hard-coded 50% would show "enough to start" for a circle the chain then rejects with `CoverageTooLow`.
 *
 *  - a circle that exists: its own immutable `minCoverageBps()` (copied from the factory at `initialize`);
 *  - the create form (no circle yet): `factory.config().minCoverageBps`, which applies to circles created from now on;
 *  - sample data (nothing deployed): the Fuji value.
 * Until the chain answers, the Fuji value is used as well, which errs on the strict side (never claims "enough" too early).
 */
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_MIN_COVERAGE_BPS, huiCircleAbi, huiFactoryAbi } from 'sdk';
import { chainKey } from '@/lib/chain/hooks';
import { useChain } from '@/lib/chain/provider';

type Address = `0x${string}`;

export function useMinCoverageBps(circle?: Address): bigint {
  const chain = useChain();
  const q = useQuery({
    queryKey: chainKey(chain?.chainId ?? 0, 'minCoverage', circle?.toLowerCase() ?? 'factory'),
    enabled: Boolean(chain),
    // The floor of an existing circle never changes; the factory one only changes through `setConfig`.
    staleTime: circle ? Infinity : 60_000,
    queryFn: async (): Promise<bigint> => {
      if (circle) {
        const v = await chain!.client.readContract({ address: circle, abi: huiCircleAbi, functionName: 'minCoverageBps' });
        return BigInt(v);
      }
      const cfg = await chain!.client.readContract({ address: chain!.factory, abi: huiFactoryAbi, functionName: 'config' });
      return BigInt(cfg.minCoverageBps);
    },
  });
  return chain && q.data !== undefined ? q.data : DEFAULT_MIN_COVERAGE_BPS;
}

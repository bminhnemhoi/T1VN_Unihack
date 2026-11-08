/**
 * Pre-computed facts block (`DU_KIEN`) built from the draft with `huiMath` (docs/07 3.2 item 2).
 * Trusted input for the model: derived only from validated numbers, never from free text or on-chain labels.
 */
import { formatBps, huiMath, parseUsdc, previewCircle, usdcToVnd } from 'sdk';
import { NOTIFY_THRESHOLD_VND, VND_PER_USDC } from './config';
import type { CircleDraft } from './schemas';
import { toDecimal } from './units';

const percent = (bps: bigint): string => formatBps(bps).replace('%', '');

export function buildFacts(draft: CircleDraft, circle?: string): Record<string, unknown> {
  const n = BigInt(draft.N);
  const c = parseUsdc(draft.C)!;
  const bond = parseUsdc(draft.bondUsdc) ?? 0n;
  const alpha = BigInt(draft.alphaBps);
  const p = previewCircle({
    n,
    c,
    periodDays: BigInt(draft.periodDays),
    alphaBps: alpha,
    bond,
    capBps: BigInt(draft.capBps),
  });
  const revealBond = huiMath.bpsOf(c, BigInt(draft.revealBondBps));
  const roundValueUsdc = n * c;
  const roundValueVnd = usdcToVnd(roundValueUsdc, VND_PER_USDC);
  const active = draft.organizerActiveCircles;
  return {
    circle: circle ?? null,
    mode: draft.mode,
    N: draft.N,
    contributionUsdc: toDecimal(c),
    periodDays: draft.periodDays,
    demoMode: draft.demoMode,
    alphaBps: draft.alphaBps,
    alphaPercent: percent(alpha),
    bondUsdc: toDecimal(bond),
    maxExposureUsdc: toDecimal(p.maxExposure),
    guaranteedCoverageBps: Number(p.coverageBps),
    guaranteedCoveragePercent: percent(p.coverageBps),
    canActivate: p.canActivate,
    bondFor100Usdc: toDecimal(p.bondFor100),
    bondMissingToActivateUsdc: toDecimal(p.bondMissing),
    requiredAllowanceUsdc: toDecimal((n - 1n) * (c + revealBond)),
    maxBidByRound: p.bidRows.map((r) => ({ k: r.k, payers: r.payers, maxBidUsdc: toDecimal(r.maxBid) })),
    article14: {
      vndPerUsdcReference: VND_PER_USDC,
      roundValueUsdc: toDecimal(roundValueUsdc),
      roundValueVnd: roundValueVnd.toString(),
      thresholdVnd: NOTIFY_THRESHOLD_VND.toString(),
      roundValueReachesThreshold: roundValueVnd >= NOTIFY_THRESHOLD_VND,
      organizerActiveCircles: active ?? null,
      organizerHasTwoOrMoreCircles: active === undefined ? null : active >= 2,
      mustNotifyCommune: roundValueVnd >= NOTIFY_THRESHOLD_VND || (active !== undefined && active >= 2),
    },
  };
}

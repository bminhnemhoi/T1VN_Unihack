/**
 * Pure chain-synced clock & live phase derivation (tested without React/JSX).
 * Eliminates double-subtraction (`until - nowMs - elapsed`) and immediately transitions phases at exact boundaries.
 */
export type LiveRoomPhase = 'commit' | 'reveal' | 'settle' | 'done';

/** Compute monotonic chain-synced Unix seconds from wall-clock `nowMs`, `offsetMs` and `prevSec`. */
export function advanceChainSec(nowMs: number, offsetMs: number, prevSec: number): number {
  const next = Math.floor((nowMs + offsetMs) / 1000);
  // Hold steady across minor RPC jitter (<= 5s) so countdowns never jump backwards.
  if (prevSec > 0 && next < prevSec && prevSec - next <= 5) return prevSec;
  return next;
}

/** Derive the active round's phase directly from `chainNowSec` and the round's exact boundary timestamps. */
export function deriveLivePhase(
  round:
    | {
        phase: string;
        commitEndsAt: number;
        revealEndsAt: number;
        deadline: number;
      }
    | undefined,
  chainNowSec: number,
): LiveRoomPhase {
  if (!round) return 'commit';
  if (round.phase === 'done') return 'done';
  if (chainNowSec < round.commitEndsAt) return 'commit';
  if (chainNowSec < round.revealEndsAt) return 'reveal';
  return 'settle';
}

/** Remaining seconds in the current window (`commitEndsAt`, `revealEndsAt`, or `deadline`). */
export function windowLeftSec(untilSec: number | undefined, chainNowSec: number): number {
  if (untilSec === undefined || untilSec <= 0) return 0;
  return Math.max(0, untilSec - chainNowSec);
}

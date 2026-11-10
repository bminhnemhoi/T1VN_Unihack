/**
 * View model for the UI (docs/05 section 7.1). Amounts are `bigint` USDC base units (6 decimals); timestamps are Unix
 * seconds as `number`. The product shows USDC only: VND exists solely as `ndc19.perRoundVnd` for the Decree 19
 * Article 14 threshold check, never as a display amount (user decision 09/11).
 */
type Address = `0x${string}`;

export type MemberStatus = 'live' | 'dead' | 'frozen' | 'defaultedDead';

export interface ReputationRecord {
  completed: number;
  onTime: number;
  late: number;
  defaults: number;
  repaid: number;
}

export interface MemberView {
  address: Address;
  joinIndex: number;
  status: MemberStatus;
  receivedRound?: number;
  holdback: bigint;
  debt: bigint;
  lateCount: number;
  reputation: ReputationRecord;
}

export interface ShortfallView {
  round: number;
  member: Address;
  amount: bigint;
  fromHoldback: bigint;
  fromBond: bigint;
  fromReserve: bigint;
  uncovered: bigint;
  /**
   * Principal that was covered when the round settled, per source (from `ShortfallCovered` events). The `from*` and
   * `uncovered` fields above shrink as the debtor repays; this one never does, so "Đã bù" can always be shown.
   * Always set by `readCircle`; optional in the type only so hand-built fixtures keep compiling.
   */
  covered?: { holdback: bigint; bond: bigint; reserve: bigint; uncovered: bigint };
  since: number;
  resolved: boolean;
  /** `pausedTotal` at the moment the round settled (rebuilt from `CircleUnpaused` events). */
  pausedAtSettle: number;
  /** since + grace + pause time after settlement (docs/03 section 6.8). */
  graceEndsAt: number;
}

export type RoundPhaseName = 'not-started' | 'commit' | 'reveal' | 'awaiting-settle' | 'done';

export interface RoundView {
  k: number;
  phase: RoundPhaseName;
  roundStart: number;
  commitEndsAt: number;
  revealEndsAt: number;
  deadline: number;
  /** Bid ceiling for rounds not yet settled; 0n once settled (the winning bid is in `bid`). */
  maxBid: bigint;
  winner?: Address;
  bid?: bigint;
  pot?: bigint;
  payout?: bigint;
  holdback?: bigint;
  fee?: bigint;
  premium?: bigint;
  uncovered?: bigint;
  settledAt?: number;
  shortfalls: ShortfallView[];
}

export type CircleStateName = 'forming' | 'active' | 'paused' | 'completed' | 'cancelled' | 'unwound';

export interface CircleView {
  address: Address;
  label: string;
  mode: 'fixed' | 'bidding';
  state: CircleStateName;
  organizer: Address;
  params: {
    N: number;
    C: bigint;
    periodSeconds: number;
    roundDuration: number;
    commitWindow: number;
    revealWindow: number;
    graceSeconds: number;
    alphaBps: number;
    commissionMode: boolean;
    feeBps: number;
    reserveBps: number;
    revealBondBps: number;
    capBps: number;
    joinDeadline: number;
    /** phi in bps of the interest room (docs/03 2.7); 0 = fixed fee. Always set by `readCircle` (optional for fixtures). */
    commissionShareBps?: number;
    /** keccak256 of the agreement text (ADR-27); compare with `verifyTerms`. Always set by `readCircle`. */
    termsHash?: `0x${string}`;
  };
  startTime?: number;
  currentRound: number;
  settledRounds: number;
  /**
   * The fields from here to `claimable` (and `params.commissionShareBps`/`termsHash`, `ShortfallView.covered`) are
   * always set by `readCircle`; they are optional in the type only so hand-built fixtures keep compiling (A14).
   */
  /** Total bond the organizer has deposited (never decreases; `bondRemaining` does). */
  bondDeposited?: bigint;
  bondRemaining: bigint;
  reserve: bigint;
  totalHoldback: bigint;
  pausedTotal: number;
  lateRateBps: number;
  coverageBps: number;
  guaranteedCoverageBps: number;
  requiredAllowance: bigint;
  /** Reveal bond one commit pulls, USDC base units (`revealBondBps` x C). */
  revealBond?: bigint;
  /** The factory's minimum coverage for `activate()` (10_000 on Fuji, ADR-22). */
  minCoverageBps?: number;
  /**
   * `claimable(address)` for the organizer, every member, anybody who got a `PaymentDeferred` and `opts.viewer`;
   * keys are lowercase addresses, zero balances are left out.
   */
  claimable?: Record<string, bigint>;
  ndc19: { perRoundVnd: number; organizerActiveCircles: number; mustNotifyCommune: boolean };
  members: MemberView[];
  rounds: RoundView[];
}

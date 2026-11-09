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
  };
  startTime?: number;
  currentRound: number;
  settledRounds: number;
  bondRemaining: bigint;
  reserve: bigint;
  totalHoldback: bigint;
  pausedTotal: number;
  lateRateBps: number;
  coverageBps: number;
  guaranteedCoverageBps: number;
  requiredAllowance: bigint;
  ndc19: { perRoundVnd: number; organizerActiveCircles: number; mustNotifyCommune: boolean };
  members: MemberView[];
  rounds: RoundView[];
}

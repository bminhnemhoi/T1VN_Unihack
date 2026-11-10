/**
 * Chain reads for the UI (docs/05 sections 7.1 and 7.2, ADR-07: no indexer). `readCircle` builds a `CircleView` from
 * contract views (merged ABI incl. the lens views) plus events. Only plain viem calls; works with any `PublicClient`.
 */
import { bytesToString, hexToBytes, type PublicClient } from 'viem';
import { DEFAULT_VND_PER_USDC, ND19_ARTICLE14_THRESHOLD_VND } from 'config';
import { huiCircleFullAbi } from './abi';
import { huiCircleAbi, huiFactoryAbi, iReputationRegistryAbi } from './generated';
import type {
  CircleStateName,
  CircleView,
  MemberStatus,
  MemberView,
  ReputationRecord,
  RoundPhaseName,
  RoundView,
  ShortfallView,
} from './view';

type Address = `0x${string}`;
type Hex = `0x${string}`;

const STATES: readonly CircleStateName[] = ['forming', 'active', 'paused', 'completed', 'cancelled', 'unwound'];
const PHASES: readonly RoundPhaseName[] = ['not-started', 'commit', 'reveal', 'awaiting-settle', 'done'];

/** One decoded circle event with its position. `timestamp` is filled only when requested. */
export interface CircleEvent {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
  txHash: Hex;
  timestamp?: number;
}

export interface EventOptions {
  fromBlock?: bigint;
  toBlock?: bigint;
  /** Blocks per `getLogs` call; public RPCs cap the range (docs/04 section 7). */
  chunk?: bigint;
  withTimestamps?: boolean;
}

/** Value of Decree 19 Article 14: N x C converted to VND (conservative reading, docs/05 section 12.2). Internal only. */
export function vndPerRound(n: number, c: bigint, vndPerUsdc: number = DEFAULT_VND_PER_USDC): number {
  return Number((BigInt(n) * c * BigInt(Math.round(vndPerUsdc))) / 1_000_000n);
}

/** `getLogs` for all circle events in chunks, oldest first. */
export async function getCircleEvents(
  client: PublicClient,
  circle: Address,
  opts: EventOptions = {},
): Promise<CircleEvent[]> {
  const chunk = opts.chunk ?? 2_000n;
  const latest = opts.toBlock ?? (await client.getBlockNumber({ cacheTime: 0 }));
  const out: CircleEvent[] = [];
  for (let from = opts.fromBlock ?? 0n; from <= latest; from += chunk) {
    const to = from + chunk - 1n > latest ? latest : from + chunk - 1n;
    const logs = await client.getContractEvents({ address: circle, abi: huiCircleAbi, fromBlock: from, toBlock: to });
    for (const l of logs) {
      out.push({
        eventName: String((l as { eventName?: string }).eventName),
        args: ((l as { args?: unknown }).args ?? {}) as Record<string, unknown>,
        blockNumber: l.blockNumber,
        logIndex: l.logIndex,
        txHash: l.transactionHash,
      });
    }
  }
  if (opts.withTimestamps) {
    const cache = new Map<bigint, number>();
    for (const e of out) {
      if (!cache.has(e.blockNumber)) {
        cache.set(e.blockNumber, Number((await client.getBlock({ blockNumber: e.blockNumber })).timestamp));
      }
      e.timestamp = cache.get(e.blockNumber);
    }
  }
  return out;
}

/** Factory directory: every circle, or the ones of one organizer. */
export async function listCircles(
  client: PublicClient,
  factory: Address,
  opts: { organizer?: Address } = {},
): Promise<Address[]> {
  const list = opts.organizer
    ? await client.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'circlesOf', args: [opts.organizer] })
    : await client.readContract({ address: factory, abi: huiFactoryAbi, functionName: 'allCircles' });
  return [...list];
}

/** Reputation counters of a wallet (display only). */
export async function reputationOf(client: PublicClient, registry: Address, member: Address): Promise<ReputationRecord> {
  const r = await client.readContract({
    address: registry,
    abi: iReputationRegistryAbi,
    functionName: 'reputationOf',
    args: [member],
  });
  return { completed: r.completed, onTime: r.onTime, late: r.late, defaults: r.defaults, repaid: r.repaid };
}

export interface ReadCircleOptions {
  /** First block to scan for events (deployment block). Default 0 (fine on anvil). */
  fromBlock?: bigint;
  /** Factory address: enables `ndc19.organizerActiveCircles`. */
  factory?: Address;
  vndPerUsdc?: number;
  /** Pre-fetched events, to avoid a second scan. */
  events?: CircleEvent[];
  /** Wallet whose `claimable` balance must be in `CircleView.claimable` even if it never got a deferred payment. */
  viewer?: Address;
}

const statusOf = (received: boolean, defaulted: boolean, joined: boolean): MemberStatus => {
  if (received) return defaulted ? 'defaultedDead' : 'dead';
  return joined && defaulted ? 'frozen' : 'live';
};

const trimLabel = (b: Hex): string => bytesToString(hexToBytes(b)).replace(/\0+$/, '');

/** Build the docs/05 7.1 `CircleView` of `circle`. */
export async function readCircle(client: PublicClient, circle: Address, opts: ReadCircleOptions = {}): Promise<CircleView> {
  const rd = <T,>(functionName: string, args: readonly unknown[] = []): Promise<T> =>
    client.readContract({ address: circle, abi: huiCircleFullAbi, functionName, args } as never) as Promise<T>;

  const [p, stateIdx, organizer, startTime, pausedTotal, settled, bondDeposited, bondRemaining, reserve, totalHoldback] = await Promise.all([
    rd<RawParams>('params'),
    rd<number>('state'),
    rd<Address>('organizer'),
    rd<bigint>('startTime'),
    rd<bigint>('pausedTotal'),
    rd<number>('settledRounds'),
    rd<bigint>('bondDeposited'),
    rd<bigint>('bondRemaining'),
    rd<bigint>('reserve'),
    rd<bigint>('totalHoldback'),
  ]);
  const [coverage, guaranteed, requiredAllowance, revealBond, minCoverageBps, lateRateBps, currentRound, phaseIdx, registry, memberAddrs] =
    await Promise.all([
      rd<bigint>('coverageIndexBps'),
      rd<bigint>('guaranteedCoverageBps'),
      rd<bigint>('requiredAllowance'),
      rd<bigint>('revealBond'),
      rd<number>('minCoverageBps'),
      rd<number>('lateRateBps'),
      rd<number>('currentRound'),
      rd<number>('phase'),
      rd<Address>('reputation'),
      rd<Address[]>('members'),
    ]);

  const state = STATES[stateIdx] ?? 'forming';
  const n = p.memberCount;
  const events = opts.events ?? (await getCircleEvents(client, circle, { fromBlock: opts.fromBlock, withTimestamps: false }));

  const members: MemberView[] = await Promise.all(
    memberAddrs.map(async (addr): Promise<MemberView> => {
      const [mi, rep] = await Promise.all([rd<RawMember>('memberInfo', [addr]), reputationOf(client, registry, addr)]);
      return {
        address: addr,
        joinIndex: mi.joinIndex,
        status: statusOf(mi.received, mi.defaulted, mi.joined),
        receivedRound: mi.received ? mi.receivedRound : undefined,
        holdback: mi.holdback,
        debt: mi.debt,
        lateCount: mi.lateCount,
        reputation: rep,
      };
    }),
  );

  // pausedTotal at each moment, rebuilt from CircleUnpaused(at, pausedTotal) so the grace end matches the contract.
  const unpauses = events
    .filter((e) => e.eventName === 'CircleUnpaused')
    .map((e) => ({ at: Number(e.args.at), total: Number(e.args.pausedTotal) }))
    .sort((a, b) => a.at - b.at);
  const pausedAt = (t: number): number => unpauses.filter((u) => u.at <= t).reduce((_, u) => u.total, 0);

  // Principal covered per source when each round settled; the contract's own `from*` fields shrink on repayment.
  const SOURCES = ['holdback', 'bond', 'reserve', 'uncovered'] as const;
  const coveredOf = (round: number, member: Address): ShortfallView['covered'] => {
    const out = { holdback: 0n, bond: 0n, reserve: 0n, uncovered: 0n };
    for (const e of events) {
      if (e.eventName !== 'ShortfallCovered' || Number(e.args.round) !== round) continue;
      if (String(e.args.member).toLowerCase() !== member.toLowerCase()) continue;
      const src = SOURCES[Number(e.args.source)];
      if (src) out[src] += e.args.amount as bigint;
    }
    return out;
  };

  // Deferred payments (`claim()` balances): organizer, members, anybody with a PaymentDeferred, plus the viewer.
  const claimAddrs = new Map<string, Address>();
  for (const a of [organizer, ...memberAddrs, ...(opts.viewer ? [opts.viewer] : [])]) claimAddrs.set(a.toLowerCase(), a);
  for (const e of events) if (e.eventName === 'PaymentDeferred') claimAddrs.set(String(e.args.to).toLowerCase(), e.args.to as Address);
  const claimable: Record<string, bigint> = {};
  await Promise.all(
    [...claimAddrs.entries()].map(async ([key, a]) => {
      const v = await rd<bigint>('claimable', [a]);
      if (v > 0n) claimable[key] = v;
    }),
  );

  const started = state !== 'forming' && state !== 'cancelled';
  const pairs = events
    .filter((e) => e.eventName === 'ContributionShortfall')
    .map((e) => ({ k: Number(e.args.round), member: e.args.member as Address }));

  const rounds: RoundView[] = await Promise.all(
    Array.from({ length: n }, (_, i) => i + 1).map(async (k): Promise<RoundView> => {
      const isSettled = k <= settled;
      const [start, dl, info, mb] = started
        ? await Promise.all([
            rd<bigint>('roundStart', [k]),
            rd<bigint>('deadline', [k]),
            isSettled ? rd<RawRound>('roundInfo', [k]) : Promise.resolve(undefined),
            isSettled ? Promise.resolve(0n) : rd<bigint>('maxBid', [k]),
          ])
        : [0n, 0n, undefined, 0n];
      const shortfalls: ShortfallView[] = await Promise.all(
        pairs
          .filter((x) => x.k === k)
          .map(async ({ member }): Promise<ShortfallView> => {
            const sf = await rd<RawShortfall>('shortfallOf', [k, member]);
            const pas = pausedAt(Number(sf.since));
            return {
              round: k,
              member,
              amount: sf.amount,
              fromHoldback: sf.fromHoldback,
              fromBond: sf.fromBond,
              fromReserve: sf.fromReserve,
              uncovered: sf.uncovered,
              covered: coveredOf(k, member),
              since: Number(sf.since),
              resolved: sf.resolved,
              pausedAtSettle: pas,
              graceEndsAt: Number(sf.since) + p.graceSeconds + (Number(pausedTotal) - pas),
            };
          }),
      );
      const phase: RoundPhaseName = isSettled ? 'done' : k === currentRound && started ? (PHASES[phaseIdx] ?? 'not-started') : 'not-started';
      const v: RoundView = {
        k,
        phase,
        roundStart: Number(start),
        commitEndsAt: Number(start) + p.commitWindow,
        revealEndsAt: Number(start) + p.commitWindow + p.revealWindow,
        deadline: Number(dl),
        maxBid: mb,
        shortfalls,
      };
      if (info) {
        v.winner = info.winner;
        v.bid = info.winningBid;
        v.pot = info.pot;
        v.payout = info.payout;
        v.holdback = info.holdback;
        v.fee = info.fee;
        v.premium = info.premium;
        v.uncovered = info.uncovered;
        v.settledAt = Number(info.settledAt);
      }
      return v;
    }),
  );

  const activeCircles = opts.factory
    ? Number(await client.readContract({ address: opts.factory, abi: huiFactoryAbi, functionName: 'activeCirclesOf', args: [organizer] }))
    : 0;
  const perRoundVnd = vndPerRound(n, p.contribution, opts.vndPerUsdc);

  return {
    address: circle,
    label: trimLabel(p.label),
    mode: p.mode === 0 ? 'fixed' : 'bidding',
    state,
    organizer,
    params: {
      N: n,
      C: p.contribution,
      periodSeconds: p.periodSeconds,
      roundDuration: p.roundDuration,
      commitWindow: p.commitWindow,
      revealWindow: p.revealWindow,
      graceSeconds: p.graceSeconds,
      alphaBps: p.alphaBps,
      commissionMode: p.commissionMode,
      feeBps: p.feeBps,
      reserveBps: p.reserveBps,
      revealBondBps: p.revealBondBps,
      capBps: p.capBps,
      joinDeadline: Number(p.joinDeadline),
      commissionShareBps: p.commissionShareBps,
      termsHash: p.termsHash,
    },
    startTime: started ? Number(startTime) : undefined,
    currentRound,
    settledRounds: settled,
    bondDeposited,
    bondRemaining,
    reserve,
    totalHoldback,
    pausedTotal: Number(pausedTotal),
    lateRateBps,
    coverageBps: Number(coverage),
    guaranteedCoverageBps: Number(guaranteed),
    requiredAllowance,
    revealBond,
    minCoverageBps: Number(minCoverageBps),
    claimable,
    ndc19: {
      perRoundVnd,
      organizerActiveCircles: activeCircles,
      mustNotifyCommune: perRoundVnd >= ND19_ARTICLE14_THRESHOLD_VND || activeCircles >= 2,
    },
    members,
    rounds,
  };
}

interface RawParams {
  mode: number;
  memberCount: number;
  contribution: bigint;
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
  joinDeadline: bigint;
  label: Hex;
  commissionShareBps: number;
  termsHash: Hex;
}
interface RawMember {
  joined: boolean;
  received: boolean;
  defaulted: boolean;
  joinIndex: number;
  receivedRound: number;
  lateCount: number;
  holdback: bigint;
  debt: bigint;
}
interface RawRound {
  winner: Address;
  winningBid: bigint;
  pot: bigint;
  payout: bigint;
  holdback: bigint;
  fee: bigint;
  premium: bigint;
  uncovered: bigint;
  settledAt: bigint;
}
interface RawShortfall {
  amount: bigint;
  fromHoldback: bigint;
  fromBond: bigint;
  fromReserve: bigint;
  uncovered: bigint;
  since: bigint;
  resolved: boolean;
}

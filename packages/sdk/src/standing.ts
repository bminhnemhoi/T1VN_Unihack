/**
 * Gather the inputs of the reputation badges from the chain (registry counters, circles' `memberInfo.debt`, event
 * timestamps) and compute the tier. Display only. Cost grows with the number of circles; fine for the contest scale.
 */
import type { PublicClient } from 'viem';
import { huiCircleFullAbi } from './abi';
import { getCircleEvents, listCircles, reputationOf } from './read';
import {
  memberTier,
  organizerTier,
  summarizeOrganizerCircle,
  type MemberReputationInput,
  type OrganizerReputationInput,
  type TierResult,
} from './reputation';

type Address = `0x${string}`;

/**
 * Badges are display-only and a page shows one per member, all asking about the same circles within a moment: events
 * read less than this long ago are reused instead of asking the explorer again (the invite page made 30 getLogs for 10 circles).
 */
export const STANDING_EVENTS_MAX_AGE_MS = 5_000;

export interface StandingOptions {
  factory: Address;
  registry: Address;
  fromBlock?: bigint;
  nowSec: number;
}

async function blockTime(client: PublicClient, blockNumber: bigint): Promise<number> {
  return Number((await client.getBlock({ blockNumber })).timestamp);
}

export async function readMemberStanding(
  client: PublicClient,
  member: Address,
  o: StandingOptions,
): Promise<{ input: MemberReputationInput; result: TierResult }> {
  const [rep, circles] = await Promise.all([reputationOf(client, o.registry, member), listCircles(client, o.factory)]);
  let unpaidDebt = 0n;
  let firstBlock: bigint | undefined;
  // `memberInfo` is a cheap eth_call: ask every circle at once. The event scans below stay one at a time and in order,
  // because Fuji's public RPC throttles bursts of getLogs (A18).
  const infos = await Promise.all(
    circles.map(
      (c) =>
        client.readContract({ address: c, abi: huiCircleFullAbi, functionName: 'memberInfo', args: [member] }) as Promise<{
          joined: boolean;
          debt: bigint;
        }>,
    ),
  );
  for (const [i, c] of circles.entries()) {
    const info = infos[i]!;
    if (!info.joined) continue;
    unpaidDebt += info.debt;
    const joined = (await getCircleEvents(client, c, { fromBlock: o.fromBlock, maxAgeMs: STANDING_EVENTS_MAX_AGE_MS })).find(
      (e) => e.eventName === 'MemberJoined' && String(e.args.member).toLowerCase() === member.toLowerCase(),
    );
    if (joined && (firstBlock === undefined || joined.blockNumber < firstBlock)) firstBlock = joined.blockNumber;
  }
  const input: MemberReputationInput = {
    completed: rep.completed,
    onTime: rep.onTime,
    late: rep.late,
    defaults: rep.defaults,
    unpaidDebt,
    firstEventAt: firstBlock === undefined ? undefined : await blockTime(client, firstBlock),
    nowSec: o.nowSec,
  };
  return { input, result: memberTier(input) };
}

export async function readOrganizerStanding(
  client: PublicClient,
  organizer: Address,
  o: StandingOptions,
): Promise<{ input: OrganizerReputationInput; result: TierResult }> {
  // The organizer's own member standing does not depend on the loop below: start it first, so the two overlap.
  const ownPromise = readMemberStanding(client, organizer, o);
  ownPromise.catch(() => undefined); // if the loop below throws first, this must not surface as an unhandled rejection
  const circles = await listCircles(client, o.factory, { organizer });
  let finished = 0;
  let bondUsed = 0;
  let firstBlock: bigint | undefined;
  for (const c of circles) {
    const events = await getCircleEvents(client, c, { fromBlock: o.fromBlock, maxAgeMs: STANDING_EVENTS_MAX_AGE_MS });
    const s = summarizeOrganizerCircle(events);
    if (s.finished) finished++;
    if (s.bondUsedForDefault) bondUsed++;
    const first = events[0];
    if (first && (firstBlock === undefined || first.blockNumber < firstBlock)) firstBlock = first.blockNumber;
  }
  const own = await ownPromise;
  const input: OrganizerReputationInput = {
    finishedCircles: finished,
    circlesBondUsedForDefault: bondUsed,
    firstCircleAt: firstBlock === undefined ? undefined : await blockTime(client, firstBlock),
    unpaidDefault: own.input.unpaidDebt > 0n,
    nowSec: o.nowSec,
  };
  return { input, result: organizerTier(input) };
}

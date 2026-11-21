/**
 * The "unpaid default" gate of POST /api/attest (docs/05 section 8.1, direction A of docs/DE-XUAT-SUA-LUAT-NO-21-11.md).
 * A wallet is blocked when some circle of the factory has it `defaulted` with `debt > 0`. The registry counters
 * (`defaults`, `repaid`) are NOT used: a debt cleared by a frozen member's pot or by the holdback at `finalize` never
 * records `repaid` (an honest wallet would stay blocked), and one default can record `repaid` twice (an indebted wallet
 * would slip through). A wallet not marked yet but with a shortfall past its grace end is blocked too (audit 21/11
 * L-02: the keeper skips unbonded circles and circles outside the newest 200, so such a shortfall may never be marked);
 * whether `markDefault(wallet)` would succeed is asked of the contract itself (an eth_call, nothing is sent).
 *
 * Cost (audit of 21/11, M-01 and M-02): a request reads `memberInfo` only for the circles the wallet belongs to. Which
 * wallets belong to which circle comes from an index shared by all requests: the member list of a circle is fixed once
 * it leaves Forming (no join or leave after `activate`), so it is read once; Cancelled circles never hold debt; a
 * Forming circle cannot hold debt yet and is re-read at most every `formingMaxAgeMs`. A debt needs at least
 * roundDuration (>= 120 s) plus grace (>= 60 s) after `activate` (docs/03 3.1), so a Forming circle seen less than
 * 150 s ago cannot hide one. Index reads are budgeted per refresh; while some circle is unread or stale the gate
 * answers `incomplete` (503, fail closed) instead of guessing. Every read failure or malformed answer throws (502).
 */
type Address = `0x${string}`;

/** `CircleState` of docs/05 section 2. */
const FORMING = 0;
const CANCELLED = 4;

export interface CircleIndexReader {
  allCircles(): Promise<readonly Address[]>;
  state(circle: Address): Promise<number>;
  members(circle: Address): Promise<readonly Address[]>;
  memberInfo(circle: Address, wallet: Address): Promise<{ defaulted: boolean; debt: bigint }>;
  /** True when `markDefault(wallet)` would succeed now (a shortfall past its grace end, not marked yet). */
  overdueUnmarked(circle: Address, wallet: Address): Promise<boolean>;
}

export interface EntryGuardOptions {
  now?: () => number;
  /** The circle list and the stale Forming circles are re-read at most this often (shared by all requests). */
  refreshEveryMs?: number;
  /** A Forming circle read longer ago than this may have activated and run into debt: the gate refuses to guess. */
  formingMaxAgeMs?: number;
  /** Circles read per refresh at most (each: `state`, and `members` once past Forming); the rest waits for the next refresh. */
  maxReadsPerRefresh?: number;
  /** Reads in flight at once: Fuji's public RPC throttles bursts. */
  concurrency?: number;
}

export const ENTRY_REFRESH_EVERY_MS = 30_000;
export const ENTRY_FORMING_MAX_AGE_MS = 150_000;
export const ENTRY_MAX_READS_PER_REFRESH = 1_000;
export const ENTRY_SCAN_CONCURRENCY = 25;

export type UnpaidDefaultScan =
  | { kind: 'clear' }
  | { kind: 'unpaid'; circle: Address }
  | { kind: 'overdue'; circle: Address }
  | { kind: 'incomplete'; unread: number };

type Entry = { kind: 'forming'; checkedAt: number } | { kind: 'none' } | { kind: 'members'; set: ReadonlySet<string> };

class MalformedRead extends Error {}

async function inBatches<T, R>(items: readonly T[], size: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(f))));
  return out;
}

function addressList(v: unknown, what: string): readonly Address[] {
  if (!Array.isArray(v) || v.some((a) => typeof a !== 'string')) throw new MalformedRead(`${what} is not an address list`);
  return v as Address[];
}

export function createEntryDebtGuard(reader: CircleIndexReader, o: EntryGuardOptions = {}) {
  const now = o.now ?? Date.now;
  const refreshEvery = o.refreshEveryMs ?? ENTRY_REFRESH_EVERY_MS;
  const formingMaxAge = o.formingMaxAgeMs ?? ENTRY_FORMING_MAX_AGE_MS;
  const maxReads = o.maxReadsPerRefresh ?? ENTRY_MAX_READS_PER_REFRESH;
  const concurrency = o.concurrency ?? ENTRY_SCAN_CONCURRENCY;

  const index = new Map<Address, Entry>();
  let circles: readonly Address[] = [];
  let refreshedAt: number | undefined;
  let refreshing: Promise<void> | undefined;

  async function readOne(c: Address, t: number): Promise<void> {
    const st = await reader.state(c);
    if (typeof st !== 'number' || !Number.isInteger(st)) throw new MalformedRead('state is not a number');
    if (st === FORMING) index.set(c, { kind: 'forming', checkedAt: t });
    else if (st === CANCELLED) index.set(c, { kind: 'none' });
    else index.set(c, { kind: 'members', set: new Set(addressList(await reader.members(c), 'members').map((a) => a.toLowerCase())) });
  }

  async function refresh(): Promise<void> {
    const t = now();
    circles = addressList(await reader.allCircles(), 'allCircles');
    refreshedAt = t;
    // Unread circles first, then the Forming ones read longest ago.
    const todo = circles
      .filter((c) => {
        const e = index.get(c);
        return !e || (e.kind === 'forming' && t - e.checkedAt >= refreshEvery);
      })
      .sort((a, b) => age(b, t) - age(a, t));
    // One unit per circle: its `state`, plus one `members` read the first time it is seen past Forming.
    await inBatches(todo.slice(0, maxReads), concurrency, (c) => readOne(c, t));
  }

  function age(c: Address, t: number): number {
    const e = index.get(c);
    return !e ? Number.MAX_SAFE_INTEGER : e.kind === 'forming' ? t - e.checkedAt : -1;
  }

  async function ensureFresh(): Promise<void> {
    if (refreshedAt !== undefined && now() - refreshedAt < refreshEvery) return;
    refreshing ??= refresh().finally(() => {
      refreshing = undefined;
    });
    await refreshing;
  }

  return {
    async check(wallet: Address): Promise<UnpaidDefaultScan> {
      await ensureFresh();
      const t = now();
      const w = wallet.toLowerCase();
      let unread = 0;
      const mine: Address[] = [];
      for (const c of circles) {
        const e = index.get(c);
        if (!e || (e.kind === 'forming' && t - e.checkedAt > formingMaxAge)) unread++;
        else if (e.kind === 'members' && e.set.has(w)) mine.push(c);
      }
      if (unread > 0) return { kind: 'incomplete', unread };
      const infos = await inBatches(mine, concurrency, (c) => reader.memberInfo(c, wallet));
      const owing: Address[] = [];
      for (const [i, mi] of infos.entries()) {
        if (!mi || typeof mi.defaulted !== 'boolean' || typeof mi.debt !== 'bigint') throw new MalformedRead('memberInfo has an unexpected shape');
        if (mi.defaulted && mi.debt > 0n) return { kind: 'unpaid', circle: mine[i]! };
        if (!mi.defaulted && mi.debt > 0n) owing.push(mine[i]!);
      }
      // Only circles where the wallet owes without a mark: one simulated markDefault each.
      const overdue = await inBatches(owing, concurrency, (c) => reader.overdueUnmarked(c, wallet));
      for (const [i, o] of overdue.entries()) {
        if (typeof o !== 'boolean') throw new MalformedRead('overdueUnmarked is not a boolean');
        if (o) return { kind: 'overdue', circle: owing[i]! };
      }
      return { kind: 'clear' };
    },
  };
}

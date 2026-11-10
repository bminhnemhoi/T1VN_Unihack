/**
 * "Sổ hụi" as JSON (docs/05 sections 8.3 and 10; Decree 19 Articles 12-13): header, member list, one line per money
 * movement and a footer, all rebuilt from the circle's own events and views. No personal data: wallet addresses only
 * (nicknames live in the organizer's browser, never here). Amounts are USDC strings (docs/05 12.2); no VND.
 */
import type { PublicClient } from 'viem';
import { formatBps, formatUsdc, getCircleEvents, readCircle, type CircleEvent, type CircleView } from 'sdk';
import { bookTotals, eventsToLines, type BookLine } from '../live/bookLines';

type Address = `0x${string}`;

export const BOOK_NOTE = 'Bản in này dựng từ dữ liệu on-chain tại thời điểm in.';
export const SNOWTRACE = 'https://testnet.snowtrace.io';

export interface BookMember {
  address: string;
  joinOrder: number;
  receivedRound: number | null;
  status: string;
}

export interface BookRow {
  /** Unix seconds of the block; null when the node could not give it. */
  time: number | null;
  timeVn: string;
  round: number;
  member: string;
  kind: string;
  detail: string | null;
  amountUsdc: string;
  tx: string;
  txUrl: string;
}

export interface BookJson {
  header: {
    label: string;
    address: string;
    organizer: string;
    mode: 'fixed' | 'bidding';
    state: string;
    members: number;
    contributionUsdc: string;
    periodDays: number;
    startTime: number | null;
    startVn: string | null;
    capPerYear: string;
    latePerYear: string;
    commission: string;
    reserve: string;
    holdback: string;
    bondRemainingUsdc: string;
    coverageAtActivation: string | null;
    explorerUrl: string;
    chainId: number;
  };
  members: BookMember[];
  lines: BookRow[];
  footer: {
    totalContributedUsdc: string;
    totalPaidOutUsdc: string;
    totalCoveredUsdc: string;
    openClaimsUsdc: string;
    mustNotifyCommune: boolean;
    ndc19Warning: string | null;
    note: string;
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "10/11/2026 14:05" in Vietnam time (UTC+7, no DST), without depending on the host's time zone. */
export function formatVn(sec: number): string {
  const d = new Date((sec + 7 * 3600) * 1000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const STATUS_VI: Record<string, string> = {
  live: 'Chưa hốt',
  dead: 'Đã hốt',
  frozen: 'Đóng băng',
  defaultedDead: 'Đã hốt, vỡ nợ',
};

const STATE_VI: Record<string, string> = {
  forming: 'Đang gom người',
  active: 'Đang chạy',
  paused: 'Tạm dừng',
  completed: 'Đã kết thúc',
  cancelled: 'Đã hủy',
  unwound: 'Đã tất toán khẩn cấp',
};

/** Pure: builds the book from an already-read view and its events. */
export function assembleBook(view: CircleView, events: CircleEvent[], chainId: number): BookJson {
  const explorer = `${SNOWTRACE}/address/${view.address}`;
  const lines: BookLine[] = eventsToLines(events, (a) => a, { organizer: view.organizer, commission: view.params.commissionMode });
  const claims = view.rounds.reduce((sum, r) => sum + r.shortfalls.filter((s) => !s.resolved).reduce((a, s) => a + s.uncovered, 0n), 0n);
  const totals = bookTotals(lines, claims);
  const activated = events.find((e) => e.eventName === 'CircleActivated');
  const p = view.params;
  const fixed = view.mode === 'fixed';
  const rows: BookRow[] = lines
    .map((l) => ({ l, time: l.ms > 0 ? Math.floor(l.ms / 1000) : null }))
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0) || a.l.round - b.l.round)
    .map(({ l, time }) => ({
      time,
      timeVn: time === null ? '' : formatVn(time),
      round: l.round,
      member: l.member,
      kind: l.kind,
      detail: l.detail ?? null,
      amountUsdc: formatUsdc(l.amount),
      tx: l.tx,
      txUrl: `${SNOWTRACE}/tx/${l.tx}`,
    }));

  return {
    header: {
      label: view.label,
      address: view.address,
      organizer: view.organizer,
      mode: view.mode,
      state: STATE_VI[view.state] ?? view.state,
      members: p.N,
      contributionUsdc: formatUsdc(p.C),
      periodDays: Math.round(p.periodSeconds / 86_400),
      startTime: view.startTime ?? null,
      startVn: view.startTime ? formatVn(view.startTime) : null,
      capPerYear: fixed ? 'Không có lãi' : formatBps(p.capBps),
      latePerYear: formatBps(view.lateRateBps),
      commission: formatBps(p.feeBps),
      reserve: formatBps(p.reserveBps),
      holdback: formatBps(p.alphaBps),
      bondRemainingUsdc: formatUsdc(view.bondRemaining),
      coverageAtActivation: activated ? formatBps(Number(activated.args.guaranteedCoverageBps ?? 0)) : null,
      explorerUrl: explorer,
      chainId,
    },
    members: [...view.members]
      .sort((a, b) => a.joinIndex - b.joinIndex)
      .map((m) => ({
        address: m.address,
        joinOrder: m.joinIndex + 1,
        receivedRound: m.receivedRound ?? null,
        status: STATUS_VI[m.status] ?? m.status,
      })),
    lines: rows,
    footer: {
      totalContributedUsdc: formatUsdc(totals.contributed),
      totalPaidOutUsdc: formatUsdc(totals.paidOut),
      totalCoveredUsdc: formatUsdc(totals.covered),
      openClaimsUsdc: formatUsdc(totals.claims),
      mustNotifyCommune: view.ndc19.mustNotifyCommune,
      ndc19Warning: view.ndc19.mustNotifyCommune
        ? 'Dây này chạm ngưỡng phải thông báo cho UBND cấp xã (Nghị định 19/2019, Điều 14). Xem mục Thông báo UBND.'
        : null,
      note: BOOK_NOTE,
    },
  };
}

export interface BuildBookOptions {
  factory: Address;
  fromBlock: bigint;
  chainId: number;
}

/** Reads the chain (events with block times, then the views) and assembles the book. */
export async function buildBook(client: PublicClient, circle: Address, opts: BuildBookOptions): Promise<BookJson> {
  const events = await getCircleEvents(client, circle, { fromBlock: opts.fromBlock, withTimestamps: true });
  const view = await readCircle(client, circle, { fromBlock: opts.fromBlock, factory: opts.factory, events });
  return assembleBook(view, events, opts.chainId);
}

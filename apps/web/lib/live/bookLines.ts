/**
 * The "sổ hụi" rebuilt from the circle's own events (docs/05 section 10): one line per money movement, with the real
 * transaction hash. Pure; `nameOf` turns a wallet into the name the screen shows.
 */
import type { CircleEvent } from 'sdk';

export type BookKind =
  | 'Góp'
  | 'Thiếu'
  | 'Bù'
  | 'Hốt'
  | 'Nhả tiền giữ lại'
  | 'Vỡ nợ'
  | 'Trả trễ'
  | 'Hoàn'
  | 'Trả nợ'
  | 'Hoa hồng'
  | 'Thưởng đúng hạn';

export interface BookLine {
  ms: number;
  round: number;
  member: string;
  kind: BookKind;
  detail?: string;
  amount: bigint;
  /** Full transaction hash. */
  tx: string;
}

const SOURCE = ['tiền giữ lại', 'ký quỹ', 'quỹ dự phòng', 'chưa bù được'] as const;
const big = (v: unknown): bigint => (typeof v === 'bigint' ? v : BigInt(String(v ?? 0)));

export interface BookTotals {
  contributed: bigint;
  paidOut: bigint;
  /** Shortfall actually covered by holdback, bond or reserve (the "chưa bù được" part is a claim, not cover). */
  covered: bigint;
  /** Still-open claims (uncovered amounts nobody has repaid yet). */
  claims: bigint;
}

const UNCOVERED = 'chưa bù được';

/** Footer of the book (docs/05 section 10): totals of the lines plus the open claims read from the circle. */
export function bookTotals(lines: BookLine[], claims: bigint): BookTotals {
  const sum = (pick: (l: BookLine) => boolean) => lines.filter(pick).reduce((a, l) => a + l.amount, 0n);
  return {
    contributed: sum((l) => l.kind === 'Góp'),
    paidOut: sum((l) => l.kind === 'Hốt'),
    covered: sum((l) => l.kind === 'Bù' && l.detail !== UNCOVERED),
    claims,
  };
}

export interface BookOptions {
  /** Organizer wallet, to mark the round the organizer's own seat took ("không thu hoa hồng"). */
  organizer?: string;
  /** The circle pays a commission at all (`commissionMode`); without it nothing needs explaining. */
  commission?: boolean;
}

export function eventsToLines(events: CircleEvent[], nameOf: (address: string) => string, opts: BookOptions = {}): BookLine[] {
  const out: BookLine[] = [];
  for (const e of events) {
    const a = e.args;
    const base = { ms: (e.timestamp ?? 0) * 1000, tx: e.txHash };
    const round = Number(a.round ?? 0);
    const member = nameOf(String(a.member ?? ''));
    switch (e.eventName) {
      case 'ContributionPulled':
        out.push({ ...base, round, member, kind: 'Góp', amount: big(a.amount) });
        break;
      case 'ContributionShortfall':
        out.push({ ...base, round, member, kind: 'Thiếu', amount: big(a.amount) });
        break;
      case 'ShortfallCovered':
        out.push({ ...base, round, member, kind: 'Bù', detail: SOURCE[Number(a.source)] ?? '', amount: big(a.amount) });
        break;
      case 'RoundSettled': {
        const own = Boolean(opts.commission && opts.organizer && String(a.winner ?? '').toLowerCase() === opts.organizer.toLowerCase() && big(a.fee) === 0n);
        out.push({ ...base, round, member: nameOf(String(a.winner ?? '')), kind: 'Hốt', detail: own ? 'thực nhận, không thu hoa hồng (chân của chủ hụi)' : 'thực nhận', amount: big(a.payout) });
        break;
      }
      case 'FeePaid':
        out.push({ ...base, round, member: nameOf(String(a.organizer ?? '')), kind: 'Hoa hồng', detail: 'trả ngay lúc chi kỳ', amount: big(a.amount) });
        break;
      case 'ReserveShared':
        out.push({ ...base, round: 0, member, kind: 'Thưởng đúng hạn', detail: `chia quỹ dự phòng, trọng số ${Number(a.weight ?? 0)}`, amount: big(a.amount) });
        break;
      case 'HoldbackReleased':
        out.push({ ...base, round, member, kind: 'Nhả tiền giữ lại', amount: big(a.amount) });
        break;
      case 'LatePaid':
        out.push({ ...base, round, member, kind: 'Trả trễ', detail: `kèm lãi ${big(a.lateFee)}`, amount: big(a.amount) });
        break;
      case 'ShortfallRestored':
        out.push({ ...base, round, member, kind: 'Hoàn', detail: SOURCE[Number(a.source)] ?? '', amount: big(a.amount) });
        break;
      case 'MemberDefaulted':
        out.push({ ...base, round, member, kind: 'Vỡ nợ', amount: 0n });
        break;
      case 'DebtRepaid':
        out.push({ ...base, round: 0, member, kind: 'Trả nợ', amount: big(a.principal) });
        break;
      default:
        break;
    }
  }
  return out;
}

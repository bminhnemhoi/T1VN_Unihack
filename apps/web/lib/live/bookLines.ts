/**
 * The "sổ hụi" rebuilt from the circle's own events (docs/05 section 10): one line per money movement, with the real
 * transaction hash. Pure; `nameOf` turns a wallet into the name the screen shows.
 */
import type { CircleEvent } from 'sdk';

export type BookKind = 'Góp' | 'Thiếu' | 'Bù' | 'Hốt' | 'Nhả tiền giữ lại' | 'Vỡ nợ' | 'Trả trễ' | 'Hoàn' | 'Trả nợ';

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

export function eventsToLines(events: CircleEvent[], nameOf: (address: string) => string): BookLine[] {
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
      case 'RoundSettled':
        out.push({ ...base, round, member: nameOf(String(a.winner ?? '')), kind: 'Hốt', detail: 'thực nhận', amount: big(a.payout) });
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

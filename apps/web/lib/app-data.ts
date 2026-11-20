/**
 * Pure data of the web-app views (no React): the ledger cells, the "Vừa xảy ra" feed and the money format. Built from
 * the same `SampleCircleData` as the receipts, so sample and chain data give the same lines.
 */
import { formatUsdcNumber } from 'sdk';
import { bondUsedThrough, coverOf, settledRound, type SampleCircleData } from '@/lib/sample-circles';

/** USDC with at least two decimals, like the approved prototype: "396,00", "3,287671". */
export const usdc2 = (u: bigint): string => {
  const s = formatUsdcNumber(u);
  return s.includes(',') ? s : `${s},00`;
};
const f = usdc2;

/** Seat i as the prototype names it: M1, M2, ... */
export const av = (i: number) => `M${i + 1}`;

export type Kind = 'pay' | 'win' | 'miss' | 'now' | 'later';
export interface Cell {
  kind: Kind;
  v: string;
  note: string;
}
export const KIND: Record<Kind, string> = { pay: 'Góp', win: 'Hốt', miss: 'Thiếu', now: 'Đang chạy', later: 'Chưa tới' };
export const GLYPH: Record<Kind, string> = { pay: '', win: 'H', miss: '✕', now: '•', later: '' };
const SRC = [
  ['holdback', 'từ tiền giữ lại'],
  ['bond', 'từ ký quỹ'],
  ['reserve', 'từ quỹ dự phòng'],
  ['uncovered', 'chưa ai bù'],
] as const;

/** Every member x round cell and the bond left after each round, from the same data as the receipts. */
export function ledgerOf(c: SampleCircleData): { cells: Cell[][]; bond: (bigint | null)[]; k: number } {
  const n = Number(c.terms.n);
  const C = c.terms.c;
  // A circle still gathering, or cancelled before it opened, has no round running: every cell is "not yet" (k = 0).
  const neverRan = c.state === 'forming' || c.ended === 'cancelled';
  const k = neverRan ? 0 : c.state === 'completed' && !c.ended ? n + 1 : c.settled + 1;
  const cells = c.seats.map((_, i): Cell[] =>
    Array.from({ length: n }, (_, j): Cell => {
      const r = j + 1;
      const received = c.winnerByRound.slice(0, r - 1).includes(i);
      const dead = c.shortfalls.find((x) => x.member === i && x.status === 'defaulted' && x.round < r);
      if (r <= c.settled) {
        const s = settledRound(c, r);
        if (s.winner === i) return { kind: 'win', v: `+${f(s.payout)}`, note: `hốt với thăm ${f(s.bid)}` };
        const sf = c.shortfalls.find((x) => x.round === r && x.member === i);
        if (sf) {
          const cv = coverOf(sf);
          const from = SRC.filter(([key]) => cv[key] > 0n).map(([key, word]) => `${f(cv[key])} ${word}`);
          return { kind: 'miss', v: `−${f(sf.amount)}`, note: `không đóng${from.length ? ` · bù ${from.join(' + ')}` : ''}${sf.status === 'paid' ? ' · đã trả trễ' : ''}` };
        }
        return { kind: 'pay', v: `−${f(received ? C : C - s.bid)}`, note: received ? 'đã hốt, góp đủ' : 'góp đúng hạn' };
      }
      if (r === k) {
        if (dead) return { kind: 'miss', v: '—', note: `vỡ nợ · ký quỹ sẽ bù ${f(C)}` };
        return { kind: 'now', v: '—', note: received ? `đã hốt · sẽ góp đủ ${f(C)}` : i === c.viewer ? 'kỳ này của bạn đang chạy' : 'kỳ này đang chạy' };
      }
      return { kind: 'later', v: '—', note: c.ended === 'cancelled' ? 'dây đã hủy trước khi chạy' : c.state === 'forming' ? 'dây chưa bắt đầu' : 'chưa tới kỳ này' };
    }),
  );
  const bond = Array.from({ length: n }, (_, j) => (j + 1 <= c.settled ? c.bond - bondUsedThrough(c, j + 1) : null));
  return { cells, bond, k };
}


export interface Bubble {
  av: string;
  me: boolean;
  k: number;
  text: string;
  v: string;
}

/** What happened in a circle, newest first, rebuilt from its rounds and shortfalls (same numbers as the receipts). */
export function feedOf(c: SampleCircleData): Bubble[] {
  const out: Bubble[] = [];
  for (let r = 1; r <= c.settled; r++) {
    const s = settledRound(c, r);
    const received = new Set(c.winnerByRound.slice(0, r - 1));
    const short = c.shortfalls.filter((x) => x.round === r);
    out.push({ av: av(s.winner), me: s.winner === c.viewer, k: r, text: `${s.winner === c.viewer ? 'Bạn hốt' : 'Hốt'} với thăm ${f(s.bid)}`, v: f(s.payout) });
    if (c.viewer >= 0 && c.viewer !== s.winner && !short.some((x) => x.member === c.viewer))
      out.push({ av: av(c.viewer), me: true, k: r, text: 'Bạn góp đúng hạn', v: `−${f(received.has(c.viewer) ? c.terms.c : c.terms.c - s.bid)}` });
    for (const x of short) {
      if (coverOf(x).bond > 0n) out.push({ av: 'CH', me: false, k: r, text: `Ký quỹ bù ${f(coverOf(x).bond)} cho ${av(x.member)}`, v: f(coverOf(x).bond) });
      if (x.status === 'defaulted') out.push({ av: av(x.member), me: x.member === c.viewer, k: r, text: 'Quá ân hạn, ghi vỡ nợ', v: `−${f(x.amount)}` });
      else out.push({ av: av(x.member), me: x.member === c.viewer, k: r, text: x.status === 'paid' ? 'Trả trễ trong ân hạn' : 'Chưa đóng, còn trong ân hạn', v: `−${f(x.amount)}` });
    }
  }
  return out.reverse();
}


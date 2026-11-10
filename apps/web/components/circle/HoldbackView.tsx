'use client';

import { useState } from 'react';
import { formatUsdc, huiMath } from 'sdk';
import { CirclePageHead } from '@/components/circle/CirclePageHead';
import { LedgerList } from '@/components/LedgerList';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type SampleCircleData } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

/** S10: how much of a pot is held back and how it comes back, one instalment per round paid on time (docs/03 section 2.2). */
export function HoldbackView({ c }: { c: SampleCircleData }) {
  const t = c.terms;
  const n = Number(t.n);
  const myRound = c.winnerByRound.indexOf(c.viewer) + 1; // 0 when the viewer has not received
  const futureRounds = Array.from({ length: n - c.settled }, (_, i) => c.settled + 1 + i).filter((k) => k < n);
  const [what, setWhat] = useState(String(futureRounds[0] ?? n - 1));
  const k = myRound > 0 ? myRound : Number(what);
  const held = huiMath.holdbackFor(t.alphaBps, t.n, BigInt(k), t.c);
  const each = huiMath.releasePerRound(t.alphaBps, t.c);

  // Row r: after round r settles, the holdback left (INV-06: alpha x (n - r) x C while every payment is on time).
  const rows = Array.from({ length: n - k }, (_, i) => {
    const r = k + 1 + i;
    const left = huiMath.holdbackFor(t.alphaBps, t.n, BigInt(r), t.c);
    return { r, released: each, left, done: r <= c.settled };
  });
  const nowHeld = (i: number): bigint => {
    // Chain data: the real amount the contract holds for this seat.
    const real = c.live?.view.members.find((m) => m.joinIndex === i);
    if (real) return real.holdback;
    const r = c.winnerByRound.indexOf(i) + 1;
    const defaulted = c.shortfalls.some((s) => s.member === i && s.status === 'defaulted');
    return r > 0 && !defaulted ? huiMath.holdbackFor(t.alphaBps, t.n, BigInt(c.settled), t.c) : 0n;
  };
  const totalNow = c.seats.reduce((a, _, i) => a + nowHeld(i), 0n);

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <CirclePageHead circle={c} title="Tiền giữ lại">
        Người hốt bị giữ lại một phần tiền hốt để bù nếu họ ngừng đóng. Đóng đủ, đúng hạn thì nhận lại hết, mỗi kỳ một ít.
      </CirclePageHead>

      {myRound === 0 && c.state !== 'completed' && futureRounds.length > 0 && (
        <div className="mt-6">
          <p id="neu-hot" className="text-muted-foreground">
            Bạn chưa hốt nên chưa bị giữ lại tiền. Xem thử nếu bạn hốt ở kỳ
          </p>
          <ToggleGroup type="single" variant="outline" value={what} onValueChange={(v) => v && setWhat(v)} aria-labelledby="neu-hot" className="mt-1 flex-wrap">
            {futureRounds.map((r) => (
              <ToggleGroupItem key={r} value={String(r)} className={TOGGLE_ON}>
                Kỳ {r}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
        <section aria-labelledby="lich-nha" className="to-giay p-6">
          <h2 id="lich-nha" className="font-display text-h2 font-bold">
            {myRound > 0 ? `Bạn hốt kỳ ${myRound}: giữ ${formatUsdc(held)}` : `Nếu hốt kỳ ${k}: giữ ${formatUsdc(held)}`}
          </h2>
          <p className="so-ke mt-2 text-lead">
            Nhả {formatUsdc(each)} sau mỗi kỳ bạn đóng đủ, đúng hạn. Còn {n - k} kỳ.
          </p>
          {rows.length === 0 ? (
            <p className="mt-3 text-muted-foreground">Kỳ cuối không giữ lại gì, vì sau đó không còn kỳ nào để đóng.</p>
          ) : (
            <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Lịch nhả tiền giữ lại, kéo ngang để xem hết">
              <table className="w-full min-w-[22rem] text-base">
                <caption className="sr-only">Lịch nhả tiền giữ lại</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-3 font-semibold">Sau kỳ</th>
                    <th scope="col" className="p-3 text-right font-semibold">Nhả</th>
                    <th scope="col" className="p-3 text-right font-semibold">Còn giữ</th>
                    <th scope="col" className="p-3 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="dong-ke">
                    <th scope="row" className="p-3 text-left font-semibold">Kỳ {k} (lúc hốt)</th>
                    <td className="so-ke p-3 text-right">{formatUsdc(0n)}</td>
                    <td className="so-ke p-3 text-right">{formatUsdc(held)}</td>
                    <td className="p-3">{myRound > 0 ? 'Đã giữ' : 'Nếu hốt'}</td>
                  </tr>
                  {rows.map((x) => (
                    <tr key={x.r} className="dong-ke last:border-b-0">
                      <th scope="row" className="p-3 text-left font-semibold">Kỳ {x.r}</th>
                      <td className="so-ke p-3 text-right">{formatUsdc(x.released)}</td>
                      <td className="so-ke p-3 text-right">{formatUsdc(x.left)}</td>
                      <td className="p-3">{myRound > 0 ? (x.done ? 'Đã nhả' : 'Chưa tới') : 'Dự kiến'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-muted-foreground">
            Tiền giữ lại dùng để bù nếu bạn ngừng đóng sau khi hốt. Đóng đủ thì nhận lại hết. Kỳ nào trả trễ thì không nhả phần của kỳ đó; phần còn lại trả khi dây kết thúc.
          </p>
        </section>

        <section aria-labelledby="ai-dang-giu" className="o-phang p-6">
          <h2 id="ai-dang-giu" className="font-display text-h3 font-bold">
            Đang giữ của từng người
          </h2>
          {c.settled === 0 ? (
            <p className="mt-2 text-muted-foreground">Chưa kỳ nào được chi nên chưa ai bị giữ lại tiền.</p>
          ) : (
            <>
              <LedgerList
                className="mt-2"
                items={c.seats.flatMap((s, i) => (s.joined ? [{ label: s.name, value: formatUsdc(nowHeld(i)) }] : []))}
              />
              <p className="so-ke mt-3 rounded-lg bg-secondary p-3">
                Tổng đang giữ {formatUsdc(totalNow)}. Khi không ai vỡ nợ, tổng này bằng tỷ lệ giữ lại nhân với phần người đã hốt còn phải đóng:{' '}
                {formatUsdc(huiMath.bpsOf(huiMath.exposure(t.n, BigInt(c.settled), t.c), t.alphaBps))}.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

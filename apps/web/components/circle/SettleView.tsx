'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { huiMath } from 'sdk';
import { CirclePageHead, EmptyNote } from '@/components/circle/CirclePageHead';
import { LedgerList } from '@/components/LedgerList';
import { useToast } from '@/components/shell/Toast';
import { Button } from '@/components/ui/button';
import { settleCleanCircle } from '@/lib/hui-calc';
import { formatCents } from '@/lib/money';
import { getSampleCircle, type CircleId } from '@/lib/sample-circles';
import { cn } from '@/lib/utils';

/** S12: closing the books ("tất toán"): paid in, received, net, interest on bids, the on-time reward from the reserve, and "Nhận tiền". */
export function SettleView({ id }: { id: CircleId }) {
  const c = getSampleCircle(id);
  const { show } = useToast();
  const [claimed, setClaimed] = useState(false);
  const done = c.state === 'completed';
  const s = useMemo(
    () => (done ? settleCleanCircle({ terms: c.terms, winnerByRound: c.winnerByRound, bids: c.bids, bond: c.bond }) : undefined),
    [c, done],
  );

  if (!done || !s) {
    return (
      <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
        <CirclePageHead circle={c} title="Tất toán" />
        <EmptyNote title="Dây này chưa kết thúc">
          Tất toán chỉ có sau khi kỳ cuối đã chi và hết thời gian trả trễ. Muốn xem bản tất toán trông thế nào, mở{' '}
          <Link href="/circles/da-xong/tat-toan" className="font-semibold text-primary underline underline-offset-4">
            dây Hụi chị em văn phòng đã kết thúc
          </Link>
          .
        </EmptyNote>
      </main>
    );
  }

  const t = c.terms;
  const me = s.members[c.viewer]!;
  const n = Number(t.n);
  const each = huiMath.releasePerRound(t.alphaBps, t.c);
  // Holdback comes back one instalment per later round; only the rounding dust is left for the final payout.
  const dust = me.holdbackBack - each * BigInt(n - me.round);
  const finalPayout = me.reward + (dust > 0n ? dust : 0n);

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <CirclePageHead circle={c} title="Tất toán">
        Dây đã chi đủ {n} kỳ và đóng sổ. Mọi người đóng đúng hạn nên không ai bị vỡ nợ.
      </CirclePageHead>

      <section aria-labelledby="rong" className="nen-muc mt-8 rounded-xl p-6 md:p-8">
        <h2 id="rong" className="font-display text-h1 font-bold">
          {me.net >= 0n ? `Bạn lời ròng ${formatCents(me.net)}` : `Bạn trả ròng ${formatCents(-me.net)}`}
        </h2>
        <p className="so-ke mt-3 text-lead text-[#dfe5f0]">
          Đã góp {formatCents(me.paid)}, đã nhận {formatCents(me.received + me.holdbackBack + me.reward)} (hốt kỳ {me.round}, tiền giữ lại, thưởng đúng hạn).
        </p>
        <p className="mt-1 text-[#c9d2e0]">Phần ròng gồm lãi thăm và tiền công chủ hụi; hụi không sinh lời thêm từ đâu khác.</p>
        {claimed ? (
          <p role="status" className="so-ke mt-5 rounded-xl border-2 border-state-ok bg-white/10 p-4 text-lead font-semibold text-white">
            Đã nhận {formatCents(finalPayout)} (mẫu).
          </p>
        ) : (
          <Button type="button" size="lg" className="mt-5 bg-action-ink text-muc-dem hover:bg-action-ink/90" onClick={() => (setClaimed(true), show('Đã nhận tiền (mẫu). Dây thật sẽ gửi giao dịch nhận tiền từ ví của bạn.'))}>
            Nhận tiền {formatCents(finalPayout)}
          </Button>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
        <section aria-labelledby="chi-tiet" className="to-giay p-6">
          <h2 id="chi-tiet" className="font-display text-h2 font-bold">
            Phần của bạn
          </h2>
          <LedgerList
            className="mt-2"
            items={[
              { label: 'Đã góp', value: formatCents(me.paid) },
              { label: `Đã nhận khi hốt kỳ ${me.round}`, value: formatCents(me.received) },
              { label: 'Tiền giữ lại đã nhận lại', value: formatCents(me.holdbackBack) },
              { label: 'Lãi thăm đã nhận (do người hốt trước trả)', value: formatCents(me.interestReceived) },
              { label: 'Lãi thăm đã trả (khi hốt)', value: formatCents(me.interestPaid) },
              { label: 'Thưởng đúng hạn từ quỹ dự phòng', value: formatCents(me.reward) },
              { label: 'Ròng', value: formatCents(me.net) },
            ]}
          />
          <p className="so-ke mt-3 text-muted-foreground">
            Quỹ dự phòng cuối dây {formatCents(s.reserveTotal)} chia cho người không vỡ nợ theo số kỳ đóng đúng hạn. Bạn đóng đúng hạn {n - 1} trên {n - 1} kỳ nên nhận phần {formatCents(me.reward)}.
          </p>
        </section>

        <section aria-labelledby="chu-hui" className="o-phang p-6">
          <h2 id="chu-hui" className="font-display text-h3 font-bold">
            Chủ hụi
          </h2>
          <LedgerList
            className="mt-2"
            items={[
              { label: 'Ký quỹ trả lại', value: formatCents(s.bondReturned) },
              { label: 'Tiền công được trả', value: formatCents(s.feesToOrganizer) },
              { label: 'Tiền công bị mất', value: formatCents(0n) },
            ]}
          />
          <p className="mt-3 text-muted-foreground">Không ai vỡ nợ nên ký quỹ không phải dùng, và mọi kỳ đều được trả tiền công.</p>
        </section>
      </div>

      <section aria-labelledby="moi-nguoi" className="mt-10">
        <h2 id="moi-nguoi" className="font-display text-h2 font-bold">
          Từng người
        </h2>
        <div className="o-phang mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Bảng tất toán từng người, kéo ngang để xem hết">
          <table className="w-full min-w-[44rem] text-base">
            <caption className="sr-only">Tất toán của từng thành viên</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-3 font-semibold">Thành viên</th>
                <th scope="col" className="p-3 font-semibold">Hốt kỳ</th>
                <th scope="col" className="p-3 text-right font-semibold">Đã góp</th>
                <th scope="col" className="p-3 text-right font-semibold">Đã nhận</th>
                <th scope="col" className="p-3 text-right font-semibold">Thưởng đúng hạn</th>
                <th scope="col" className="p-3 text-right font-semibold">Ròng</th>
              </tr>
            </thead>
            <tbody>
              {s.members.map((m) => (
                <tr key={m.member} className={cn('dong-ke last:border-b-0', m.member === c.viewer && 'bg-secondary')}>
                  <th scope="row" className="p-3 text-left font-semibold">{c.seats[m.member]!.name}</th>
                  <td className="so-ke p-3">{m.round}</td>
                  <td className="so-ke p-3 text-right">{formatCents(m.paid)}</td>
                  <td className="so-ke p-3 text-right">{formatCents(m.received + m.holdbackBack)}</td>
                  <td className="so-ke p-3 text-right">{formatCents(m.reward)}</td>
                  <td className={cn('so-ke p-3 text-right font-semibold', m.net < 0n && 'text-state-bad')}>{formatCents(m.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-muted-foreground">
          Cộng cột Ròng của mọi người ra đúng âm tiền công chủ hụi: tiền không tự sinh ra hay mất đi.{' '}
          <Link href={`/circles/${id}/so-ho`} className="font-semibold text-primary underline underline-offset-4">
            Xem sổ hụi
          </Link>
          .
        </p>
      </section>
    </main>
  );
}

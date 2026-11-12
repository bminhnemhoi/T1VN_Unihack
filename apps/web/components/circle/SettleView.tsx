'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { huiMath } from 'sdk';
import { ActionButton } from '@/components/chain/ActionButton';
import { ClaimBox } from '@/components/chain/ClaimBox';
import { CirclePageHead, EmptyNote } from '@/components/circle/CirclePageHead';
import { LiveSettle } from '@/components/circle/LiveSettle';
import { SettleTable } from '@/components/circle/SettleTable';
import { LedgerList } from '@/components/LedgerList';
import { useToast } from '@/components/shell/Toast';
import { Button } from '@/components/ui/button';
import { settleCleanCircle } from '@/lib/hui-calc';
import { formatCents } from '@/lib/money';
import { type SampleCircleData } from '@/lib/sample-circles';

/** S12: closing the books ("tất toán"): paid in, received, net, interest on bids, the on-time reward from the reserve, and "Nhận tiền". */
export function SettleView({ c }: { c: SampleCircleData }) {
  const id = c.id;
  const { show } = useToast();
  const [claimed, setClaimed] = useState(false);
  const live = c.live;
  const done = c.state === 'completed' && live?.view.state !== 'cancelled';
  // Sample data: the clean model (nobody defaulted) is what `settleCleanCircle` computes. A circle read from the chain is settled from its own events (`LiveSettle`).
  const s = useMemo(
    () => (done && !live && c.shortfalls.length === 0 && c.viewer >= 0 ? settleCleanCircle({ terms: c.terms, winnerByRound: c.winnerByRound, bids: c.bids, bond: c.bond }) : undefined),
    [c, done, live],
  );
  const nowSec = Math.floor((live?.nowMs ?? 0) / 1000);
  const lastSettled = live?.view.rounds.find((r) => r.k === Number(c.terms.n))?.settledAt;
  const canFinalize = Boolean(live && live.view.state === 'active' && c.settled === Number(c.terms.n) && lastSettled !== undefined && nowSec > lastSettled + c.graceSeconds + live.view.pausedTotal);

  if (live && (live.view.state === 'active' || live.view.state === 'paused') && c.settled === Number(c.terms.n)) {
    return (
      <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
        <CirclePageHead circle={c} title="Tất toán" />
        <EmptyNote title="Kỳ cuối đã chi, chờ kết thúc dây">
          {canFinalize ? 'Đã hết thời gian trả trễ. Ai cũng bấm kết thúc được: tiền giữ lại, ký quỹ và quỹ dự phòng được trả về đúng chủ trong một giao dịch.' : 'Còn trong thời gian trả trễ của kỳ cuối. Hết thời gian đó thì kết thúc dây được.'}
          <div className="mt-4">
            <ActionButton size="lg" disabled={!canFinalize} run={(a) => a.finalize(live.address)} success="Dây đã kết thúc, tiền đã trả về từng người.">
              Kết thúc dây
            </ActionButton>
          </div>
        </EmptyNote>
      </main>
    );
  }

  if (done && live) return <LiveSettle c={c} />;

  if (!done || !s) {
    return (
      <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
        <CirclePageHead circle={c} title="Tất toán" />
        <EmptyNote title="Dây này chưa kết thúc">
          Tất toán chỉ có sau khi kỳ cuối đã chi và hết thời gian trả trễ.
          {!live && (
            <>
              {' '}Muốn xem bản tất toán trông thế nào, mở{' '}
              <Link href="/circles/da-xong/tat-toan" className="font-semibold text-primary underline underline-offset-4">
                dây Hụi chị em văn phòng đã kết thúc
              </Link>
              .
            </>
          )}
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
        <p className="so-ke mt-3 text-lead text-[#e9e4da]">
          Đã góp {formatCents(me.paid)}, đã nhận {formatCents(me.received + me.holdbackBack + me.reward)} (hốt kỳ {me.round}, tiền giữ lại, thưởng đúng hạn).
        </p>
        <p className="mt-1 text-[#c9c2b6]">Phần ròng gồm lãi thăm và tiền công chủ hụi; hụi không sinh lời thêm từ đâu khác.</p>
        {live ? (
          <p className="so-ke mt-5 text-[#e9e4da]">Khi dây kết thúc, tiền được chuyển thẳng vào ví của bạn. Nếu có phần không chuyển được, nút Nhận tiền hiện ở cuối trang.</p>
        ) : claimed ? (
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
              { label: 'Tiền công đã trả ngay lúc chi kỳ', value: formatCents(s.feesPaidNow) },
              { label: 'Tiền công trả khi kết thúc dây', value: formatCents(s.feesAtFinalize) },
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
        <SettleTable
          rows={s.members.map((m) => ({
            id: m.member,
            name: c.seats[m.member]!.name,
            round: m.round,
            paid: m.paid,
            interestReceived: m.interestReceived,
            got: m.received + m.holdbackBack,
            reward: m.reward,
            net: m.net,
            me: m.member === c.viewer,
          }))}
        />
        <p className="mt-3 text-muted-foreground">
          Cộng cột Ròng của mọi người ra đúng âm tiền công chủ hụi: tiền không tự sinh ra hay mất đi.{' '}
          <Link href={`/circles/${id}/so-ho`} className="font-semibold text-primary underline underline-offset-4">
            Xem sổ hụi
          </Link>
          .
        </p>
      </section>
      <ClaimBox c={c} />
    </main>
  );
}

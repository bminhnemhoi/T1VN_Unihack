'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { formatUsdc } from 'sdk';
import { ClaimBox } from '@/components/chain/ClaimBox';
import { CirclePageHead, EmptyNote } from '@/components/circle/CirclePageHead';
import { SettleTable, type SettleRow } from '@/components/circle/SettleTable';
import { LedgerList } from '@/components/LedgerList';
import { formatCents } from '@/lib/money';
import { settleFromEvents } from '@/lib/live/settleEvents';
import { useCircleEvents } from '@/lib/live/useCircleEvents';
import type { SampleCircleData } from '@/lib/sample-circles';

/**
 * S12 for a finished circle read from the chain (ADR-28, vector V6): everything comes from the circle's own events, so the
 * on-time reward is the real `ReserveShared` and the organizer's commission is split into what was paid at once (`FeePaid`)
 * and what waited for `finalize`. Money that moved is counted as it moved; nothing here is a model.
 */
export function LiveSettle({ c }: { c: SampleCircleData }) {
  const live = c.live!;
  const events = useCircleEvents(live.address);
  const sorted = useMemo(() => [...live.view.members].sort((a, b) => a.joinIndex - b.joinIndex), [live.view.members]);
  const s = useMemo(
    () =>
      events.data
        ? settleFromEvents(
            events.data,
            c.terms.c,
            sorted.map((m) => m.address),
          )
        : undefined,
    [events.data, c.terms.c, sorted],
  );

  if (!s) {
    return (
      <main id="noi-dung" className="pg">
        <CirclePageHead circle={c} title="Tất toán" />
        <EmptyNote title={events.isError ? 'Chưa đọc được sổ của dây' : 'Đang đọc sổ của dây…'}>
          {events.isError ? 'Kiểm tra kết nối rồi mở lại trang này.' : 'Tất toán được dựng từ các giao dịch của dây trên mạng.'}
        </EmptyNote>
      </main>
    );
  }

  const me = c.viewer >= 0 ? s.members[c.viewer] : undefined;
  const hadShortfall = c.shortfalls.length > 0;
  const rows: SettleRow[] = s.members.map((m, i) => ({
    id: m.address,
    name: c.seats[i]?.name ?? `Thành viên ${i + 1}`,
    round: m.round,
    paid: m.paid,
    interestReceived: m.interestReceived,
    got: m.received + m.holdbackBack,
    reward: m.reward,
    net: m.net,
    me: i === c.viewer,
  }));
  const o = s.organizer;
  const n = Number(c.terms.n);

  return (
    <main id="noi-dung" className="pg">
      <CirclePageHead circle={c} title="Tất toán">
        {hadShortfall
          ? `Dây đã chi đủ ${n} kỳ và đóng sổ. Trong dây có khoản thiếu, nên các số dưới đây là tiền đã thật sự chuyển, cộng từ sổ hụi.`
          : `Dây đã chi đủ ${n} kỳ và đóng sổ. Mọi người đóng đúng hạn nên không ai bị vỡ nợ.`}
      </CirclePageHead>

      {me ? (
        <section aria-labelledby="rong" className="nen-muc mt-8 rounded-xl p-6 md:p-8">
          <h2 id="rong" className="font-display text-h1 font-bold">
            {me.net >= 0n ? `Bạn lời ròng ${formatCents(me.net)}` : `Bạn trả ròng ${formatCents(-me.net, 'up')}`}
          </h2>
          <p className="so-ke mt-3 text-lead text-[#e9e4da]">
            Đã góp {formatCents(me.paid, 'up')}, đã nhận {formatCents(me.received + me.holdbackBack + me.reward)} (tiền hốt, tiền giữ lại, thưởng đúng hạn).
          </p>
          <p className="mt-1 text-[#c9c2b6]">Phần ròng gồm lãi thăm và tiền công chủ hụi; hụi không sinh lời thêm từ đâu khác. Tiền đã chuyển thẳng vào ví của bạn khi dây kết thúc.</p>
        </section>
      ) : (
        <EmptyNote title={c.viewerIsOrganizer ? 'Bạn là chủ hụi, không giữ phần nào' : 'Bạn không ở trong dây này'}>
          {c.viewerIsOrganizer ? 'Phần của bạn là ký quỹ và hoa hồng, ở khung Chủ hụi bên dưới.' : 'Đăng nhập bằng ví của thành viên để xem phần của mình. Bảng dưới là của cả dây.'}
        </EmptyNote>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
        {me && (
          <section aria-labelledby="chi-tiet" className="to-giay p-6">
            <h2 id="chi-tiet" className="font-display text-h2 font-bold">
              Phần của bạn
            </h2>
            <LedgerList
              className="mt-2"
              items={[
                { label: 'Đã góp', value: formatCents(me.paid, 'up') },
                { label: me.round > 0 ? `Đã nhận khi hốt kỳ ${me.round}` : 'Đã nhận khi hốt', value: formatCents(me.received) },
                { label: 'Tiền giữ lại đã nhận lại', value: formatCents(me.holdbackBack) },
                { label: 'Lãi thăm đã nhận (do người hốt trước trả)', value: formatCents(me.interestReceived) },
                { label: 'Lãi thăm đã trả (khi hốt)', value: formatCents(me.interestPaid, 'up') },
                { label: 'Thưởng đúng hạn từ quỹ dự phòng', value: formatCents(me.reward) },
                { label: 'Ròng', value: formatCents(me.net) },
              ]}
            />
            <p className="so-ke mt-3 text-muted-foreground">
              {me.weight === undefined
                ? 'Quỹ dự phòng chưa được chia: dây chưa kết thúc hẳn.'
                : `Quỹ dự phòng cuối dây ${formatCents(s.reserveTotal)} chia cho người không vỡ nợ theo số kỳ đóng đúng hạn. Trọng số của bạn là ${me.weight} trên ${n - 1}${me.weight < n - 1 ? ': mỗi lần trễ làm phần của bạn nhỏ đi' : ': bạn đóng đúng hạn mọi kỳ'}.`}
            </p>
          </section>
        )}

        <section aria-labelledby="chu-hui" className={`o-phang p-6 ${me ? '' : 'lg:col-span-2'}`}>
          <h2 id="chu-hui" className="font-display text-h3 font-bold">
            Chủ hụi{c.viewerIsOrganizer ? ' (bạn)' : ''}
          </h2>
          <LedgerList
            className="mt-2"
            items={[
              { label: 'Ký quỹ trả lại', value: formatCents(o.bondReturned) },
              { label: 'Hoa hồng đã trả ngay lúc chi kỳ', value: formatCents(o.feePaidNow) },
              { label: 'Hoa hồng trả khi kết thúc dây', value: formatCents(o.feeAtFinalize) },
              { label: 'Hoa hồng bị mất (có người vỡ nợ)', value: formatCents(o.feeForfeited) },
            ]}
          />
          <p className="mt-3 text-muted-foreground">Kỳ không có khoản thiếu thì hoa hồng trả ngay; kỳ có khoản thiếu thì giữ lại tới khi kết thúc dây, hoặc mất nếu người thiếu vỡ nợ. Kỳ chủ hụi tự hốt không thu hoa hồng.</p>
        </section>
      </div>

      <section aria-labelledby="moi-nguoi" className="mt-10">
        <h2 id="moi-nguoi" className="font-display text-h2 font-bold">
          Từng người
        </h2>
        <SettleTable rows={rows} />
        <p className="mt-3 text-muted-foreground">
          Số tiền của cả dây khớp sổ hụi, từng giao dịch có mã để đối chiếu.{' '}
          <Link href={`/circles/${c.id}/so-ho`} className="font-semibold text-primary underline underline-offset-4">
            Xem sổ hụi
          </Link>
          . Quỹ dự phòng đã chia {formatUsdc(s.reserveTotal)}.
        </p>
      </section>
      <ClaimBox c={c} />
    </main>
  );
}

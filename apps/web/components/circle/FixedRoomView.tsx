'use client';

import Link from 'next/link';
import { formatUsdc } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { LateBanner } from '@/components/circle/LateBanner';
import { RepBadge, RepDisclaimer } from '@/components/circle/RepBadge';
import { RoundStrip } from '@/components/circle/RoundStrip';
import { LedgerList } from '@/components/LedgerList';
import { SoonButton } from '@/components/shell/SoonButton';
import { Badge } from '@/components/ui/badge';
import { roundSplit } from '@/lib/hui-calc';
import { getSampleCircle, type CircleId } from '@/lib/sample-circles';

/**
 * Overview of an ACTIVE Fixed circle: no sealed bids, the order of receiving was set when people joined (docs/03 section 6.4).
 * Shows the same things as the bid room that still apply: where the circle is, what happens this round, who is owed what.
 */
export function FixedRoomView({ id }: { id: CircleId }) {
  const c = getSampleCircle(id);
  const t = c.terms;
  const n = Number(t.n);
  const k = c.settled + 1;
  const next = roundSplit(t, k, 0n);
  const mine = c.shortfalls.find((s) => s.member === c.viewer && s.status === 'grace');
  const takesNext = k - 1 === c.viewer;

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold">{c.label}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Đang chạy</Badge>
            <Badge variant="outline">Bạn là thành viên {c.viewer + 1}</Badge>
            <Badge variant="secondary">Cố định, không bỏ thăm</Badge>
            <Badge variant="secondary">Dữ liệu mẫu</Badge>
          </div>
          <p className="so-ke mt-2 text-lead text-muted-foreground">
            {n} người, mỗi kỳ ({t.periodDays} ngày) góp {formatUsdc(t.c)}. Đã chi {c.settled} trên {n} kỳ.
          </p>
        </div>
        <RoundStrip n={n} done={c.settled} running myRound={c.viewer + 1} winners={c.winnerByRound.map((w) => c.seats[w]!.name)} />
      </div>

      {mine && (
        <div className="mt-8">
          <LateBanner circle={c} shortfall={mine} payHref={`/circles/${id}/thieu`} />
          {takesNext && (
            <p className="mt-2 font-semibold">
              Kỳ {k} là kỳ hốt của bạn. Chưa trả trước giờ chốt thì khoản thiếu và lãi bị trừ thẳng vào tiền hốt của bạn.
            </p>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
        <section aria-labelledby="ky-nay" className="nen-muc rounded-xl p-6 md:p-8">
          <h2 id="ky-nay" className="font-display text-h1 font-bold">
            Kỳ {k}: {takesNext ? 'bạn hốt' : `${c.seats[k - 1]!.name} hốt`}
          </h2>
          <p className="mt-3 text-lead text-[#dfe5f0]">
            Còn <Countdown seconds={c.roundSecondsLeft ?? 0} className="font-semibold text-white" /> đến giờ chốt. Dây cố định hốt lần lượt theo thứ tự vào dây, không bỏ thăm, không may rủi.
          </p>
          <p className="so-ke mt-1 text-[#c9d2e0]">
            Nếu mọi người góp đủ, người hốt nhận khoảng {formatUsdc(next.payout)}, bị giữ lại {formatUsdc(next.holdback)} (nhả dần mỗi kỳ).
          </p>
          <SoonButton size="lg" className="mt-5 bg-action-ink text-muc-dem hover:bg-action-ink/90" message={`Chốt kỳ ${k} cần nối mạng và chỉ bấm được sau giờ chốt. Hiện là màn hình mẫu, chưa chốt gì.`}>
            Chốt kỳ {k}
          </SoonButton>
        </section>

        <section aria-labelledby="thu-tu" className="o-phang p-6">
          <h2 id="thu-tu" className="font-display text-h3 font-bold">
            Thứ tự hốt
          </h2>
          <p className="text-muted-foreground">Đã định từ lúc vào dây và ghi công khai.</p>
          <ol className="mt-2">
            {c.seats.map((s, i) => {
              const state = i + 1 <= c.settled ? 'Đã hốt' : i + 1 === k ? 'Kỳ này' : 'Chưa tới';
              return (
                <li key={i} className="dong-ke flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 last:border-b-0">
                  <span className="min-w-0">
                    <span className="font-semibold">
                      {i + 1}. {s.name}
                    </span>
                    <span className="block text-muted-foreground">{state}</span>
                  </span>
                  <RepBadge rep={s.rep} />
                </li>
              );
            })}
          </ol>
          <RepDisclaimer className="mt-3" />
        </section>
      </div>

      <section aria-labelledby="so-lieu" className="to-giay mt-8 p-6">
        <h2 id="so-lieu" className="font-display text-h3 font-bold">
          Bảo chứng của dây
        </h2>
        <LedgerList
          className="mt-2"
          items={[
            { label: 'Ký quỹ còn lại', value: `${formatUsdc(c.bondRemaining)} trên ${formatUsdc(c.bond)}` },
            { label: 'Quỹ dự phòng', value: formatUsdc(c.reserve) },
          ]}
        />
        <p className="mt-3 text-muted-foreground">
          Xem chi tiết ở các mục phía trên:{' '}
          <Link href={`/circles/${id}/bao-chung`} className="font-semibold text-primary underline underline-offset-4">
            Bảo chứng
          </Link>
          ,{' '}
          <Link href={`/circles/${id}/so-ho`} className="font-semibold text-primary underline underline-offset-4">
            Sổ hụi
          </Link>
          .
        </p>
      </section>
    </main>
  );
}

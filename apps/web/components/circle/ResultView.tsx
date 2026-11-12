'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatUsdc } from 'sdk';
import { CirclePageHead, EmptyNote } from '@/components/circle/CirclePageHead';
import { LedgerList } from '@/components/LedgerList';
import { ClaimBox } from '@/components/chain/ClaimBox';
import { SettleButton } from '@/components/chain/SettleButton';
import { EXPLORER_TX } from '@/components/chain/useTx';
import { SoonButton } from '@/components/shell/SoonButton';
import { useChain } from '@/lib/chain/provider';
import { useCircleEvents } from '@/lib/live/useCircleEvents';
import { useToast } from '@/components/shell/Toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatVnTime, settledAtMs, settledRound, type SampleCircleData } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

/** S07: what happened in one settled round. Sum line = INV-05. */
export function ResultView({ c }: { c: SampleCircleData }) {
  const id = c.id;
  const { show } = useToast();
  const [k, setK] = useState(c.settled);
  const [blocked, setBlocked] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const chain = useChain();
  const events = useCircleEvents(c.live?.address);
  const fixed = c.terms.mode === 'fixed';
  const running = c.state === 'active' ? c.settled + 1 : undefined;

  if (c.settled === 0) {
    return (
      <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
        <CirclePageHead circle={c} title="Kết quả kỳ" />
        <EmptyNote title="Chưa có kỳ nào được chi">
          Dây này còn đang gom người. Kỳ 1 chỉ bắt đầu sau khi đủ {String(c.terms.n)} người và chủ hụi bấm bắt đầu dây.{' '}
          <Link href={`/circles/${id}`} className="font-semibold text-primary underline underline-offset-4">
            Về tổng quan của dây
          </Link>
          .
        </EmptyNote>
      </main>
    );
  }

  const r = settledRound(c, k);
  const winner = c.seats[r.winner]!;
  const mine = r.winner === c.viewer;
  const shortOf = (m: number) => c.shortfalls.find((s) => s.round === k && s.member === m);
  // v1.2: a clean round pays the commission at once (`FeePaid`); a round with a shortfall holds it back; the organizer's own seat pays none (docs/03 section 6.5 step 6).
  const winnerAddr = winner.address ?? (winner.organizer ? c.organizerAddr : undefined);
  const organizerWon = Boolean(winner.organizer || (c.live && winnerAddr && winnerAddr.toLowerCase() === c.live.view.organizer.toLowerCase()));
  const hasShortfall = c.shortfalls.some((s) => s.round === k);
  const commissionOn = c.live ? c.live.view.params.commissionMode : c.terms.feeBps > 0n;
  const feeItem =
    r.fee === 0n && organizerWon && commissionOn
      ? { label: 'Hoa hồng chủ hụi', value: 'Không thu (chân của chủ hụi)' }
      : { label: hasShortfall ? 'Tiền công chủ hụi (giữ chờ đến khi kết thúc dây)' : 'Tiền công chủ hụi (đã trả ngay)', value: formatUsdc(r.fee) };

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <CirclePageHead circle={c} title={`Kết quả kỳ ${k}`}>
        Đã chi lúc {formatVnTime(settledAtMs(c, k))}. Mọi con số tính từ luật của dây, ai cũng kiểm lại được.
      </CirclePageHead>

      <div className="mt-6">
        <p id="chon-ky" className="text-muted-foreground">
          Chọn kỳ muốn xem
        </p>
        <ToggleGroup type="single" variant="outline" value={String(k)} onValueChange={(v) => v && (setK(Number(v)), setBlocked(false), setClaimed(false))} aria-labelledby="chon-ky" className="mt-1 flex-wrap">
          {Array.from({ length: c.settled }, (_, i) => (
            <ToggleGroupItem key={i} value={String(i + 1)} className={TOGGLE_ON}>
              Kỳ {i + 1}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {running && (
        <div role="status" className="mt-6 rounded-xl border border-border bg-card p-4 text-lead">
          Kỳ {running} đang diễn ra nên chưa có kết quả. Quá giờ chốt mà chưa chi thì hiện &quot;Kỳ đang chờ chốt&quot; và ai cũng bấm chốt được.{' '}
          <SettleButton c={c} round={running} variant="outline" size="sm" className="ml-1 align-middle" />
        </div>
      )}

      <section aria-labelledby="ai-hot" className="nen-muc mt-8 rounded-xl p-6 md:p-8">
        <h2 id="ai-hot" className="font-display text-h1 font-bold">
          {mine ? 'Bạn hốt kỳ này' : `${winner.name} hốt kỳ này`}
        </h2>
        <p className="so-ke mt-3 text-lead text-[#e9e4da]">
          Thực nhận <strong className="text-white">{formatUsdc(r.payout)}</strong>
          {fixed ? ', theo thứ tự đã định từ lúc vào dây (không bỏ thăm).' : `, thăm thắng ${formatUsdc(r.bid)} mỗi phần.`}
        </p>
        <p className="mt-1 text-[#c9c2b6]">
          {fixed ? 'Dây cố định hốt lần lượt theo thứ tự vào dây.' : 'Thăm cao nhất hốt. Bằng nhau thì ít lần trễ hơn thắng, vẫn bằng thì ai nộp trước. Không có may rủi.'}
        </p>
        {c.live ? (
          (() => {
            const hash = events.data?.find((e) => e.eventName === 'RoundSettled' && Number(e.args.round) === k)?.txHash;
            if (!hash) return <p className="mt-5 text-[#c9c2b6]">Đang tìm giao dịch chốt kỳ…</p>;
            return chain?.chainId === 43113 ? (
              <Button asChild variant="outline" size="lg" className="mt-5 border-[#c9c2b6] bg-transparent text-white hover:bg-white/10 hover:text-white">
                <a href={`${EXPLORER_TX}${hash}`} target="_blank" rel="noreferrer">
                  Xem giao dịch trên Snowtrace
                </a>
              </Button>
            ) : (
              <p className="so-ke mt-5 break-all text-[#c9c2b6]">
                Giao dịch chốt kỳ: <span data-testid="tx-hash">{hash}</span>
              </p>
            );
          })()
        ) : (
          <SoonButton variant="outline" size="lg" className="mt-5 border-[#c9c2b6] bg-transparent text-white hover:bg-white/10 hover:text-white" message="Dây mẫu chưa có giao dịch thật nên chưa mở được Snowtrace. Dây thật sẽ có đường dẫn ở đây.">
            Xem giao dịch trên Snowtrace
          </SoonButton>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
        <section aria-labelledby="bang-so" className="to-giay p-6">
          <h2 id="bang-so" className="font-display text-h3 font-bold">
            Bảng số của kỳ {k}
          </h2>
          <LedgerList
            className="mt-2"
            items={[
              { label: 'Tổng tiền góp (tiền hốt)', value: formatUsdc(r.pot) },
              feeItem,
              { label: 'Quỹ dự phòng', value: formatUsdc(r.premium) },
              { label: 'Tiền giữ lại của người hốt', value: formatUsdc(r.holdback) },
              { label: 'Thực nhận', value: formatUsdc(r.payout) },
              { label: 'Phần không bù được', value: formatUsdc(r.uncovered) },
            ]}
          />
          <p className="so-ke mt-3 rounded-lg bg-secondary p-3">
            Kiểm: {formatUsdc(r.payout)} + {formatUsdc(r.fee)} + {formatUsdc(r.premium)} + {formatUsdc(r.holdback)} = {formatUsdc(r.payout + r.fee + r.premium + r.holdback)}
            {r.payout + r.fee + r.premium + r.holdback === r.pot ? ' = tổng tiền hốt. Khớp.' : ' (lệch, báo lỗi)'}
          </p>
        </section>

        <section aria-labelledby="tung-nguoi" className="o-phang p-6">
          <h2 id="tung-nguoi" className="font-display text-h3 font-bold">
            Từng người trong kỳ này
          </h2>
          <ul className="mt-2">
            {c.seats.map((s, i) => {
              if (!s.joined) return null;
              const sf = shortOf(i);
              const isWinner = i === r.winner;
              return (
                <li key={i} className="dong-ke flex flex-wrap items-baseline justify-between gap-x-3 py-2.5 last:border-b-0">
                  <span className="font-semibold">{s.name}</span>
                  <span className="so-ke text-right">
                    {isWinner ? (
                      'Hốt kỳ này'
                    ) : sf ? (
                      <span className="text-state-bad">
                        Thiếu {formatUsdc(sf.amount)}
                        <span className="block text-base text-muted-foreground">
                          Bù: {[sf.fromHoldback > 0n && `${formatUsdc(sf.fromHoldback)} tiền giữ lại`, sf.fromBond > 0n && `${formatUsdc(sf.fromBond)} ký quỹ`, sf.fromReserve > 0n && `${formatUsdc(sf.fromReserve)} quỹ dự phòng`, sf.uncovered > 0n && `${formatUsdc(sf.uncovered)} chưa bù được`].filter(Boolean).join(', ')}
                        </span>
                      </span>
                    ) : (
                      'Đã góp'
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {c.shortfalls.some((s) => s.round === k) && (
            <p className="mt-3 text-muted-foreground">
              Người hốt vẫn nhận đủ nhờ khoản bù.{' '}
              <Link href={`/circles/${id}/thieu`} className="font-semibold whitespace-nowrap text-primary underline underline-offset-4">
                Xem khoản thiếu
              </Link>
              .
            </p>
          )}
        </section>
      </div>

      {mine && (
        <section aria-labelledby="nhan-tien" className="o-phang mt-8 p-6">
          <h2 id="nhan-tien" className="font-display text-h3 font-bold">
            Tiền của bạn
          </h2>
          {!c.live && (
            <label htmlFor="chan" className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 text-muted-foreground">
              <Switch id="chan" checked={blocked} onCheckedChange={(v) => (setBlocked(v), setClaimed(false))} />
              Xem thử: chuyển tiền cho tôi bị chặn (chỉ có ở bản mẫu)
            </label>
          )}
          {!c.live && blocked ? (
            claimed ? (
              <p role="status" className="so-ke mt-3 rounded-xl border-2 border-state-ok bg-state-ok/10 p-4 text-lead font-semibold text-state-ok">
                Đã nhận {formatUsdc(r.payout)} (mẫu).
              </p>
            ) : (
              <div className="mt-3">
                <p className="so-ke text-lead">
                  Có <strong>{formatUsdc(r.payout)}</strong> chờ bạn nhận. Lần chuyển tự động không tới được ví của bạn, nên tiền được giữ an toàn trong dây.
                </p>
                <Button type="button" size="lg" className="mt-3" onClick={() => (setClaimed(true), show('Đã nhận tiền (mẫu). Dây thật sẽ gửi giao dịch nhận tiền từ ví của bạn.'))}>
                  Nhận tiền
                </Button>
              </div>
            )
          ) : (
            <p className="so-ke mt-3 text-lead">
              {formatUsdc(r.payout)} đã chuyển thẳng vào ví của bạn trong cùng giao dịch chốt kỳ.
            </p>
          )}
        </section>
      )}
      <ClaimBox c={c} />
    </main>
  );
}

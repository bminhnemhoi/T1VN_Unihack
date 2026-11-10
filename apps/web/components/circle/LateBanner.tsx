'use client';

import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatUsdc, huiMath, quoteRepay } from 'sdk';
import { ActionButton } from '@/components/chain/ActionButton';
import { Countdown } from '@/components/brand/Countdown';
import { Button } from '@/components/ui/button';
import { lateImpact } from '@/lib/live/lateImpact';
import { formatVnTime, nowMsOf, type SampleCircleData, type SampleShortfall } from '@/lib/sample-circles';

const LATE_RATE_BPS = 10_00n; // 10%/year, ND 19 Article 22 clause 1

/** Late interest on a shortfall after `elapsedSeconds` real seconds (docs/03 section 2.5). */
export function lateFeeOf(c: SampleCircleData, s: SampleShortfall, elapsedSeconds: number): bigint {
  return huiMath.lateFee(s.amount, LATE_RATE_BPS, BigInt(elapsedSeconds), c.terms.periodDays * 86_400n, BigInt(c.roundSeconds));
}

/**
 * Late-penalty banner (decided 09/11): red, says what is owed, when the grace period ends, and that interest is running.
 * The interest figure ticks every second from the sample clock. `onPay` is the "Trả ngay" action of the page that shows it.
 */
export function LateBanner({ circle, shortfall, onPay, payHref }: { circle: SampleCircleData; shortfall: SampleShortfall; onPay?: () => void; payHref?: string }) {
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setExtra((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const live = circle.live;
  const me = live?.viewerAddress;
  // Chain data: the exact amount the contract will pull (`quoteRepay` mirrors it), refreshed every second.
  const quote = live && me ? quoteRepay(live.view, me, Math.floor(live.nowMs / 1000) + extra, { round: shortfall.round }) : undefined;
  const fee = quote ? quote.lateFee : lateFeeOf(circle, shortfall, shortfall.sinceSeconds + extra);
  const owed = quote ? quote.principal : shortfall.amount;
  const impact = lateImpact(circle);
  const left = shortfall.graceSecondsLeft ?? 0;
  const deadline = nowMsOf(circle) + (shortfall.graceSecondsLeft ?? 0) * 1000;
  return (
    <section role="alert" aria-labelledby="no-tieu-de" className="rounded-xl border-2 border-state-bad bg-state-bad/10 p-5 md:p-6">
      <h2 id="no-tieu-de" className="flex items-start gap-3 font-display text-h2 font-bold text-state-bad">
        <TriangleAlert aria-hidden className="mt-1.5 size-7 shrink-0" />
        Bạn còn thiếu {formatUsdc(owed)} kỳ {shortfall.round}
      </h2>
      <p className="so-ke mt-2 text-lead text-foreground">
        Hạn trả: <strong>{formatVnTime(deadline)}</strong>, còn <Countdown seconds={left} className="font-semibold" />. Quá hạn mà chưa trả thì bị đánh dấu vỡ nợ và mất cọc giữ lại.
      </p>
      <p className="so-ke text-lead text-foreground">
        Lãi chậm góp đang cộng (10%/năm): <strong>{formatUsdc(fee)}</strong>. Trả sớm thì lãi ít.
      </p>
      <p className="so-ke mt-2 text-foreground">
        Trễ một kỳ, dù trả trong ân hạn, vẫn bị ghi một lần trễ: cuối dây phần chia quỹ dự phòng của bạn (thưởng đúng hạn) bớt khoảng <strong>{formatUsdc(impact.thisLoss)}</strong>, tính trên quỹ dự kiến {formatUsdc(impact.reserveEnd)}. Không mở thăm đã nộp cũng bị tính như trễ. Đóng đúng hạn mọi kỳ thì nhận đủ phần.
      </p>
      {live && !payHref && (
        <ActionButton
          size="lg"
          className="mt-4"
          noticeClassName="text-foreground"
          needed={quote?.total}
          run={(a) => a.payLate(live.address, shortfall.round)}
          success={`Đã trả khoản thiếu kỳ ${shortfall.round}, không bị vỡ nợ.`}
        >
          Trả ngay {formatUsdc(owed + fee)}
        </ActionButton>
      )}
      {!live && onPay && (
        <Button type="button" size="lg" className="mt-4" onClick={onPay}>
          Trả ngay {formatUsdc(shortfall.amount + fee)}
        </Button>
      )}
      {payHref && (
        <Button asChild size="lg" className="mt-4">
          <Link href={payHref}>Trả ngay {formatUsdc(owed + fee)}</Link>
        </Button>
      )}
    </section>
  );
}

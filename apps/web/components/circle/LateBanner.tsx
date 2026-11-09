'use client';

import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatUsdc, huiMath } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { Button } from '@/components/ui/button';
import { formatVnTime, SAMPLE_NOW_MS, type SampleCircleData, type SampleShortfall } from '@/lib/sample-circles';

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
  const fee = lateFeeOf(circle, shortfall, shortfall.sinceSeconds + extra);
  const left = shortfall.graceSecondsLeft ?? 0;
  const deadline = SAMPLE_NOW_MS + left * 1000;
  return (
    <section role="alert" aria-labelledby="no-tieu-de" className="rounded-xl border-2 border-state-bad bg-state-bad/10 p-5 md:p-6">
      <h2 id="no-tieu-de" className="flex items-start gap-3 font-display text-h2 font-bold text-state-bad">
        <TriangleAlert aria-hidden className="mt-1.5 size-7 shrink-0" />
        Bạn còn thiếu {formatUsdc(shortfall.amount)} kỳ {shortfall.round}
      </h2>
      <p className="so-ke mt-2 text-lead text-foreground">
        Hạn trả: <strong>{formatVnTime(deadline)}</strong>, còn <Countdown seconds={left} className="font-semibold" />. Quá hạn mà chưa trả thì bị đánh dấu vỡ nợ và mất cọc giữ lại.
      </p>
      <p className="so-ke text-lead text-foreground">
        Lãi chậm góp đang cộng (10%/năm): <strong>{formatUsdc(fee)}</strong>. Trả sớm thì lãi ít.
      </p>
      {onPay && (
        <Button type="button" size="lg" className="mt-4" onClick={onPay}>
          Trả ngay {formatUsdc(shortfall.amount + fee)}
        </Button>
      )}
      {payHref && (
        <Button asChild size="lg" className="mt-4">
          <Link href={payHref}>Trả ngay {formatUsdc(shortfall.amount + fee)}</Link>
        </Button>
      )}
    </section>
  );
}

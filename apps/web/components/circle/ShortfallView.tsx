'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatUsdc } from 'sdk';
import { CirclePageHead, EmptyNote } from '@/components/circle/CirclePageHead';
import { LateBanner, lateFeeOf } from '@/components/circle/LateBanner';
import { LedgerList } from '@/components/LedgerList';
import { useToast } from '@/components/shell/Toast';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getSampleCircle, settledRound, type CircleId, type SampleShortfall } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

const STATUS = {
  grace: { label: 'Trong ân hạn', variant: 'secondary' },
  defaulted: { label: 'Đã vỡ nợ', variant: 'destructive' },
  paid: { label: 'Đã trả trễ', variant: 'outline' },
} as const;

/** S08: missing contributions, who covered them, the grace deadline and "Trả ngay". Paying changes the page, locally. */
export function ShortfallView({ id }: { id: CircleId }) {
  const c = getSampleCircle(id);
  const { show } = useToast();
  const [asDebtor, setAsDebtor] = useState(false);
  const [paid, setPaid] = useState(false);
  const demoDebtor = id === 'demo';
  const viewer = demoDebtor && asDebtor ? 3 : c.viewer;

  const rows: SampleShortfall[] = c.shortfalls.map((s) =>
    demoDebtor && asDebtor ? { ...s, status: 'grace', graceSecondsLeft: 114, sinceSeconds: 6 } : s,
  );
  const mineOpen = rows.find((s) => s.member === viewer && s.status === 'grace');
  const result = mineOpen && paid ? { ...mineOpen, status: 'paid' as const } : undefined;

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <CirclePageHead circle={c} title="Khoản thiếu">
        Khi tiền góp của ai đó không trích được, dây bù ngay từ tiền giữ lại, ký quỹ rồi quỹ dự phòng. Người hốt kỳ đó vẫn nhận đủ.
      </CirclePageHead>

      {demoDebtor && (
        <div className="mt-6">
          <p id="vai" className="text-muted-foreground">
            Xem với vai (chỉ có ở bản mẫu)
          </p>
          <ToggleGroup type="single" variant="outline" value={asDebtor ? 'no' : 'khac'} onValueChange={(v) => v && (setAsDebtor(v === 'no'), setPaid(false))} aria-labelledby="vai" className="mt-1 flex-wrap">
            <ToggleGroupItem value="khac" className={TOGGLE_ON}>Thành viên 2 (bạn)</ToggleGroupItem>
            <ToggleGroupItem value="no" className={TOGGLE_ON}>Thành viên 4 (người thiếu, trong ân hạn)</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {mineOpen && !paid && (
        <div className="mt-6">
          <LateBanner circle={c} shortfall={mineOpen} onPay={() => (setPaid(true), show('Đã trả trễ (mẫu). Dây thật sẽ trích phần thiếu cộng lãi từ ví của bạn trong một giao dịch.'))} />
        </div>
      )}

      {result && (
        <section role="status" aria-labelledby="da-tra" className="mt-6 rounded-xl border-2 border-state-ok bg-state-ok/10 p-5 md:p-6">
          <h2 id="da-tra" className="font-display text-h2 font-bold text-state-ok">
            Đã trả trễ, không bị vỡ nợ
          </h2>
          <p className="so-ke mt-2 text-lead">
            Bạn trả {formatUsdc(result.amount)} cộng lãi {formatUsdc(lateFeeOf(c, result, result.sinceSeconds))}. Ghi thêm một lần trễ vào lịch sử, không phải vỡ nợ.
          </p>
          <p className="mt-2">Phần đã bù được hoàn theo thứ tự: người hốt kỳ đó, quỹ dự phòng, ký quỹ, rồi tiền giữ lại của chính bạn.</p>
          <LedgerList
            className="mt-2"
            items={[
              result.uncovered > 0n && { label: `Trả cho người hốt kỳ ${result.round}`, value: formatUsdc(result.uncovered) },
              result.fromReserve > 0n && { label: 'Hoàn quỹ dự phòng', value: formatUsdc(result.fromReserve) },
              result.fromBond > 0n && { label: 'Hoàn ký quỹ của chủ hụi', value: formatUsdc(result.fromBond) },
              result.fromHoldback > 0n && { label: 'Trả lại tiền giữ lại của bạn', value: formatUsdc(result.fromHoldback) },
              { label: 'Lãi chậm góp vào quỹ dự phòng', value: formatUsdc(lateFeeOf(c, result, result.sinceSeconds)) },
            ].filter((x): x is { label: string; value: string } => x !== false)}
          />
        </section>
      )}

      {rows.length === 0 ? (
        <EmptyNote title="Chưa có khoản thiếu nào">
          Mọi người đều góp đủ và đúng hạn ở các kỳ đã chi.{' '}
          <Link href={`/circles/${id}/ket-qua`} className="font-semibold text-primary underline underline-offset-4">
            Xem kết quả các kỳ
          </Link>
          .
        </EmptyNote>
      ) : (
        <section aria-labelledby="ds" className="mt-8">
          <h2 id="ds" className="font-display text-h2 font-bold">
            Các khoản thiếu của dây
          </h2>
          <ul className="to-giay mt-4">
            {rows.map((s) => {
              const st = result && s.member === result.member && s.round === result.round ? STATUS.paid : STATUS[s.status];
              const winner = settledRound(c, s.round);
              return (
                <li key={`${s.round}-${s.member}`} className="dong-ke p-5 last:border-b-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-h3 font-bold">
                      Kỳ {s.round}: {c.seats[s.member]!.name} thiếu {formatUsdc(s.amount)}
                    </h3>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <p className="so-ke mt-1 text-lead">
                    Đã bù{' '}
                    {[s.fromHoldback > 0n && `${formatUsdc(s.fromHoldback)} từ tiền giữ lại của ${c.seats[s.member]!.name}`, s.fromBond > 0n && `${formatUsdc(s.fromBond)} từ ký quỹ`, s.fromReserve > 0n && `${formatUsdc(s.fromReserve)} từ quỹ dự phòng`].filter(Boolean).join(', ')}
                    {s.uncovered > 0n ? `, còn ${formatUsdc(s.uncovered)} chưa bù được` : ''}. Người hốt kỳ {s.round} ({c.seats[winner.winner]!.name}) vẫn nhận đủ {formatUsdc(winner.payout)}.
                  </p>
                  {s.status === 'defaulted' && !(demoDebtor && asDebtor) && (
                    <p className="mt-1 text-muted-foreground">
                      Quá ân hạn nên bị đánh dấu vỡ nợ sau khi hốt: các kỳ sau phần góp của người này tiếp tục được bù từ ký quỹ.{' '}
                      <Link href={`/circles/${id}/bao-chung`} className="font-semibold text-primary underline underline-offset-4">
                        Xem thác bù
                      </Link>
                      .
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

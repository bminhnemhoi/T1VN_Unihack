'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatUsdc, quoteRepay, repayPermitQuote } from 'sdk';
import { ActionButton } from '@/components/chain/ActionButton';
import { CirclePageHead, EmptyNote } from '@/components/circle/CirclePageHead';
import { PermitHint } from '@/components/circle/PermitHint';
import { LateBanner, lateFeeOf } from '@/components/circle/LateBanner';
import { LedgerList } from '@/components/LedgerList';
import { useToast } from '@/components/shell/Toast';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { settledRound, type SampleShortfall, type SampleCircleData } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

const STATUS = {
  grace: { label: 'Trong ân hạn', variant: 'secondary' },
  defaulted: { label: 'Đã vỡ nợ', variant: 'destructive' },
  paid: { label: 'Đã trả trễ', variant: 'outline' },
} as const;

/** S08: missing contributions, who covered them, the grace deadline and "Trả ngay". Paying changes the page, locally. */
/** What was covered when the round settled, per source: the chain view's `covered` (never shrinks), else the open amounts (sample data). */
function coveredOf(c: SampleCircleData, s: SampleShortfall): { holdback: bigint; bond: bigint; reserve: bigint } {
  const sf = c.live?.view.rounds.find((r) => r.k === s.round)?.shortfalls.find((x) => c.seats[s.member]?.address?.toLowerCase() === x.member.toLowerCase());
  return sf?.covered ?? { holdback: s.fromHoldback, bond: s.fromBond, reserve: s.fromReserve };
}

export function ShortfallView({ c }: { c: SampleCircleData }) {
  const id = c.id;
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

  // Chain data: a member already marked as defaulted repays the principal still owed (docs/03 section 6.8, `repayDebt`).
  const live = c.live;
  const me = live?.viewerAddress;
  const debtOpen = live && me ? c.shortfalls.filter((s) => s.member === c.viewer && s.status === 'defaulted') : [];
  const debtPrincipal = debtOpen.reduce((a, s) => a + s.fromHoldback + s.fromBond + s.fromReserve + s.uncovered, 0n);
  const debtPermit = live && me && debtPrincipal > 0n ? repayPermitQuote(live.view, me, Math.floor(live.nowMs / 1000) + 120, { principal: debtPrincipal }) : undefined;
  const debtQuote = live && me && debtPrincipal > 0n ? quoteRepay(live.view, me, Math.floor(live.nowMs / 1000), { principal: debtPrincipal }) : undefined;

  return (
    <main id="noi-dung" className="pg">
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

      {live && debtQuote && (
        <section aria-labelledby="no-vo" className="mt-6 rounded-xl border-2 border-state-bad bg-state-bad/10 p-5 md:p-6">
          <h2 id="no-vo" className="font-display text-h2 font-bold text-state-bad">
            Bạn còn nợ {formatUsdc(debtQuote.principal)} sau khi vỡ nợ
          </h2>
          <p className="so-ke mt-2 text-lead">
            Trả dần bất cứ lúc nào khi dây còn chạy. Trả hết {formatUsdc(debtQuote.principal)} cộng lãi chậm góp {formatUsdc(debtQuote.lateFee)} là {formatUsdc(debtQuote.total)}.
          </p>
          <ActionButton
            size="lg"
            className="mt-4"
            noticeClassName="text-foreground"
            needed={debtQuote.total}
            run={(a) => a.repayDebt(live.address, debtQuote.principal)}
            success="Đã trả nợ."
          >
            Trả nợ {formatUsdc(debtQuote.total)}
          </ActionButton>
          {debtPermit && <PermitHint quote={debtPermit} />}
        </section>
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
              const cv = coveredOf(c, s);
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
                    {[cv.holdback > 0n && `${formatUsdc(cv.holdback)} từ tiền giữ lại của ${c.seats[s.member]!.name}`, cv.bond > 0n && `${formatUsdc(cv.bond)} từ ký quỹ`, cv.reserve > 0n && `${formatUsdc(cv.reserve)} từ quỹ dự phòng`].filter(Boolean).join(', ') || 'không có khoản nào từ tiền giữ lại, ký quỹ hay quỹ dự phòng'}
                    {s.uncovered > 0n ? `, còn ${formatUsdc(s.uncovered)} chưa bù được` : ''}. Người hốt kỳ {s.round} ({c.seats[winner.winner]!.name}) vẫn nhận đủ {formatUsdc(winner.payout)}.
                  </p>
                  {live && s.status === 'defaulted' && c.seats[s.member]?.address && live.view.members.find((m) => m.address === c.seats[s.member]!.address)?.status !== 'frozen' && live.view.members.find((m) => m.address === c.seats[s.member]!.address)?.status !== 'defaultedDead' && (
                    <div className="mt-2">
                      <p className="text-muted-foreground">Đã quá ân hạn mà chưa trả. Ai cũng đánh dấu vỡ nợ được, không cần chờ chủ hụi.</p>
                      <ActionButton variant="outline" className="mt-2" run={(a) => a.markDefault(live.address, c.seats[s.member]!.address!)} success="Đã đánh dấu vỡ nợ.">
                        Đánh dấu vỡ nợ
                      </ActionButton>
                    </div>
                  )}
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

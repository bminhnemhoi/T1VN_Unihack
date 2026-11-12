import { formatUsdc } from 'sdk';
import { Waterfall } from '@/components/circle/Waterfall';
import { capOf } from '@/lib/hui-calc';
import { formatVnTime, settledRound, type SampleCircleData } from '@/lib/sample-circles';

const SOURCE = [
  ['fromHoldback', 'tiền giữ lại'],
  ['fromBond', 'ký quỹ'],
  ['fromReserve', 'quỹ dự phòng'],
] as const;

/**
 * A settled kỳ as a receipt (DESIGN.md "biên lai"): who took the pot and how the pot was split, line by line, then who
 * did not pay and what covered it. The pot equals payout + fee + reserve + holdback (INV-05), so the lines add up.
 */
export function RoundReceipt({ c, round }: { c: SampleCircleData; round: number }) {
  const r = settledRound(c, round);
  const winner = c.seats[r.winner]?.name ?? 'Thành viên';
  const short = c.shortfalls.filter((s) => s.round === round);
  const lines: [string, bigint, boolean?][] = [
    ['Tiền hốt của kỳ', r.pot],
    ['Hoa hồng chủ hụi', -r.fee],
    ['Quỹ dự phòng', -r.premium],
    ['Giữ lại, trả dần khi đóng đủ', -r.holdback],
  ];
  return (
    <section aria-labelledby={`bien-lai-${round}`} className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:items-start [&>*]:min-w-0">
      <article className="rounded-2xl border border-border bg-card p-6 shadow-[0_24px_48px_-32px_rgb(32_29_29/0.45)]">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-mono text-[0.72rem] tracking-[0.08em] text-muted-foreground uppercase">
            Biên lai kỳ {round} · chốt {formatVnTime(c.startMs + c.roundMs * round)}
          </p>
          <span className="dau-xuong shrink-0 rounded-md border-[3px] border-ngoc px-3 py-1 font-mono text-[0.75rem] font-semibold tracking-[0.08em] text-ngoc uppercase">
            Đã hốt
          </span>
        </div>
        <h2 id={`bien-lai-${round}`} className="mt-2 text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">
          {winner} hốt kỳ {round}
        </h2>
        <p className="mt-1 text-muted-foreground">Thăm {formatUsdc(r.bid)} mỗi phần. Thăm cao nhất hốt, không có may rủi.</p>
        <dl className="mt-5 border-y border-dashed border-input">
          {lines.map(([label, v]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 py-2">
              <dt>{label}</dt>
              <dd className="font-mono tabular-nums">{v < 0n ? `−${formatUsdc(-v)}` : formatUsdc(v)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <span className="font-bold">{winner} nhận ngay</span>
          <span className="font-mono text-[1.6rem] font-semibold tabular-nums">{formatUsdc(r.payout)}</span>
        </div>
      </article>

      <div className="grid gap-4">
        {short.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">Kỳ này mọi người đóng đủ và đúng hạn. Không ai cần bù.</p>
        ) : (
          <section aria-labelledby={`thieu-${round}`} className="rounded-2xl border border-le-do/40 bg-card p-6">
            <h3 id={`thieu-${round}`} className="text-xl font-bold">
              Ai thiếu kỳ {round}, ai bù
            </h3>
            <ul className="mt-3 grid gap-2">
              {short.map((s) => {
                const from = SOURCE.filter(([key]) => s[key] > 0n).map(([key, word]) => `${formatUsdc(s[key])} ${word}`);
                return (
                  <li key={s.member} className="rounded-lg bg-secondary px-4 py-3">
                    <span className="font-semibold">{c.seats[s.member]?.name}</span> thiếu <span className="font-mono">{formatUsdc(s.amount)}</span>
                    {from.length > 0 && <span className="block text-muted-foreground">bù {from.join(', ')}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
      {short.length > 0 && (
        <div className="lg:col-span-2">
          <Waterfall c={c} />
        </div>
      )}
    </section>
  );
}

/** A kỳ that has not come yet: its bid ceiling and what will happen, nothing to press. */
export function RoundPlan({ c, round }: { c: SampleCircleData; round: number }) {
  const live = c.live?.view.rounds.find((r) => r.k === round);
  const cap = live?.maxBid ?? capOf(c.terms, round);
  const last = round === Number(c.terms.n);
  return (
    <section aria-labelledby={`ke-hoach-${round}`} className="max-w-2xl rounded-2xl border border-dashed border-input bg-card/60 p-6">
      <p className="font-mono text-[0.72rem] tracking-[0.08em] text-muted-foreground uppercase">Kỳ {round} · chưa tới</p>
      <h2 id={`ke-hoach-${round}`} className="mt-2 text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em]">
        {last ? 'Kỳ cuối: người còn lại hốt' : `Trần thăm kỳ ${round}: ${formatUsdc(cap)}`}
      </h2>
      <p className="mt-2 text-muted-foreground">
        {last
          ? 'Kỳ cuối không bỏ thăm: người duy nhất chưa hốt nhận phần của mình với thăm 0.'
          : 'Trần thăm nhỏ dần qua từng kỳ vì thời gian còn nợ ngắn lại (trần lãi NĐ 19 Điều 21, cách hiểu của nhóm, chờ luật sư xác nhận).'}
      </p>
    </section>
  );
}

import { formatUsdc } from 'sdk';
import { LedgerList } from '@/components/LedgerList';
import { usdc } from '@/lib/sample';
import { settledRound, type SampleCircleData } from '@/lib/sample-circles';

interface Seg {
  label: string;
  value: bigint;
  color: string;
}

/** Stacked bar. Each segment is also listed in words and numbers below, so colour is never the only signal. */
function Stack({ segs, title }: { segs: Seg[]; title: string }) {
  const total = segs.reduce((a, s) => a + s.value, 0n);
  return (
    <figure>
      <figcaption className="mb-2 font-semibold">{title}</figcaption>
      <div aria-hidden className="flex h-7 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_var(--input)]">
        {segs
          .filter((s) => s.value > 0n)
          .map((s) => (
            <div key={s.label} className={s.color} style={{ width: `${(Number(s.value) / Number(total)) * 100}%` }} />
          ))}
      </div>
      <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
        {segs.map((s) => (
          <li key={s.label} className="so-ke flex items-center justify-between gap-3 py-1">
            <span className="flex items-center gap-2">
              <span aria-hidden className={`size-3.5 rounded-sm ${s.color}`} />
              {s.label}
            </span>
            <span className="font-semibold">{formatUsdc(s.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * Chain data: the latest settled round in which someone did not pay, with the real split of the pot and the real cover
 * (what is still to be restored, by source). Renders nothing while every round was paid in full.
 */
function LiveWaterfall({ c }: { c: SampleCircleData }) {
  const open = c.shortfalls.filter((s) => s.status !== 'paid');
  const last = open.length ? Math.max(...open.map((s) => s.round)) : 0;
  if (last === 0) return null;
  const rows = open.filter((s) => s.round === last);
  const sum = (f: (s: (typeof rows)[number]) => bigint) => rows.reduce((a, s) => a + f(s), 0n);
  const r = settledRound(c, last);
  const who = rows.map((s) => c.seats[s.member]?.name ?? 'Một thành viên').join(', ');
  const stages = [
    { t: 'Tiền giữ lại', v: sum((s) => s.fromHoldback), s: 'của chính người thiếu' },
    { t: 'Ký quỹ chủ hụi', v: sum((s) => s.fromBond), s: 'bù phần còn thiếu' },
    { t: 'Quỹ dự phòng', v: sum((s) => s.fromReserve), s: 'bù phần còn thiếu' },
    { t: 'Khoản đòi công khai', v: sum((s) => s.uncovered), s: 'người hốt nhận thiếu đúng phần này' },
  ];
  return (
    <section aria-labelledby="wf-title" className="to-giay p-6 md:p-8">
      <h2 id="wf-title" className="font-display text-h2 font-bold">
        Kỳ {last}: có người không đóng
      </h2>
      <p className="mt-1 text-lead text-muted-foreground">
        {who} không đóng {formatUsdc(sum((s) => s.amount))}. Dây bù lần lượt, người hốt vẫn nhận phần của mình.
      </p>
      <ol className="mt-5 flex flex-col gap-1 md:flex-row md:items-stretch md:gap-0">
        {stages.map((x, i) => (
          <li key={x.t} className={`relative flex-1 rounded-xl border-2 p-3 md:rounded-none md:first:rounded-l-xl md:last:rounded-r-xl ${x.v > 0n ? 'border-foreground bg-nghe/30' : 'border-border bg-card text-muted-foreground'}`}>
            <p className="font-semibold">
              {i + 1}. {x.t}
            </p>
            <p className="so-ke font-display text-2xl font-bold">{formatUsdc(x.v)}</p>
            <p>{x.v > 0n ? x.s : 'chưa cần dùng'}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8">
        <Stack
          title={`Tiền hốt của kỳ ${last} là ${formatUsdc(r.pot)}, chia ra`}
          segs={[
            { label: `${c.seats[r.winner]?.name ?? 'Người hốt'} nhận`, value: r.payout, color: 'bg-ngoc' },
            { label: 'Giữ lại cho người hốt', value: r.holdback, color: 'bg-primary' },
            { label: 'Tiền công chủ hụi', value: r.fee, color: 'bg-nghe-fg' },
            { label: 'Quỹ dự phòng', value: r.premium, color: 'bg-le-do' },
          ]}
        />
      </div>
      <LedgerList className="mt-4" items={[{ label: 'Ký quỹ còn lại', value: formatUsdc(c.bondRemaining) }]} />
    </section>
  );
}

/** Result of kỳ 2 in the worked example (docs/03 section 8, branch B): who covered the missing 100 USDC and how the pot was split. */
export function Waterfall({ c }: { c?: SampleCircleData } = {}) {
  if (c?.live) return <LiveWaterfall c={c} />;
  return (
    <section aria-labelledby="wf-title" className="to-giay p-6 md:p-8">
      <h2 id="wf-title" className="font-display text-h2 font-bold">
        Kỳ 2: có người không đóng
      </h2>
      <p className="mt-1 text-lead text-muted-foreground">Thành viên 4 không đóng phần 100 USDC. Dây bù lần lượt, người hốt vẫn nhận đủ.</p>

      <ol className="mt-5 flex flex-col gap-1 md:flex-row md:items-stretch md:gap-0">
        {[
          { t: 'Tiền giữ lại', v: '80 USDC', s: 'của chính Thành viên 4', on: true },
          { t: 'Ký quỹ chủ hụi', v: '20 USDC', s: 'bù phần còn thiếu', on: true },
          { t: 'Quỹ dự phòng', v: '0 USDC', s: 'chưa cần dùng', on: false },
          { t: 'Khoản đòi công khai', v: '0 USDC', s: 'không còn thiếu', on: false },
        ].map((x, i) => (
          <li key={x.t} className={`relative flex-1 rounded-xl border-2 p-3 md:rounded-none md:first:rounded-l-xl md:last:rounded-r-xl ${x.on ? 'border-foreground bg-nghe/30' : 'border-border bg-card text-muted-foreground'}`}>
            <p className="font-semibold">
              {i + 1}. {x.t}
            </p>
            <p className="so-ke font-display text-2xl font-bold">{x.v}</p>
            <p>{x.s}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <Stack
          title="Tiền hốt của kỳ 2 là 391 USDC, chia ra"
          segs={[
            { label: 'Thành viên 1 nhận', value: usdc(323, 18), color: 'bg-ngoc' },
            { label: 'Giữ lại cho Thành viên 1', value: usdc(60), color: 'bg-primary' },
            { label: 'Tiền công chủ hụi', value: usdc(3, 91), color: 'bg-nghe-fg' },
            { label: 'Quỹ dự phòng', value: usdc(3, 91), color: 'bg-le-do' },
          ]}
        />
      </div>
      <LedgerList
        className="mt-4"
        items={[
          { label: 'Ký quỹ còn lại sau kỳ 2', value: formatUsdc(usdc(460)) },
        ]}
      />
      <p className="mt-3">Tiền công kỳ 2 (3,91 USDC) chuyển vào quỹ dự phòng nếu Thành viên 4 bị đánh dấu vỡ nợ.</p>
      <p className="mt-1 text-muted-foreground">Số liệu mẫu theo ví dụ trong đặc tả (nhánh Thành viên 4 không trả).</p>
    </section>
  );
}

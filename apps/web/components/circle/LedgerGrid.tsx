import { Check, CircleCheck, Hourglass, Plus, Snowflake, TriangleAlert, type LucideIcon } from 'lucide-react';
import { formatUsdc } from 'sdk';
import type { Phase } from '@/components/circle/RoundTimeline';
import type { LedgerCell, LedgerRound, MemberStatus, SampleMember } from '@/lib/sample';
import { cn } from '@/lib/utils';

const STATUS: Record<MemberStatus, { label: string; icon: LucideIcon; cls: string }> = {
  live: { label: 'Chưa hốt', icon: Hourglass, cls: 'text-muted-foreground' },
  dead: { label: 'Đã hốt', icon: CircleCheck, cls: 'text-state-ok' },
  frozen: { label: 'Đóng băng', icon: Snowflake, cls: 'text-primary' },
  defaultedDead: { label: 'Vỡ nợ sau khi hốt', icon: TriangleAlert, cls: 'text-state-bad' },
};

const RUNNING: Record<Phase, string> = {
  commit: 'Đang nộp thăm kín. Chưa ai thấy thăm của ai.',
  reveal: 'Đang mở thăm. Thăm cao nhất sẽ hốt.',
  settle: 'Đã mở xong, chờ chốt kỳ.',
};

interface Props {
  members: SampleMember[];
  rounds: LedgerRound[];
  viewer: number;
  phase: Phase;
}

function CellText({ c }: { c: LedgerCell }) {
  if (c.kind === 'paid')
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Check aria-hidden className="size-4 shrink-0 text-state-ok" strokeWidth={3} />
        góp {formatUsdc(c.amount)}
      </span>
    );
  if (c.kind === 'won')
    return <span className="inline-flex items-center rounded-full border-2 border-le-do px-3 py-0.5 font-semibold text-le-do">Hốt kỳ này</span>;
  return (
    <span className="block">
      <span className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap text-state-bad">
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        thiếu {formatUsdc(c.amount)}
      </span>
      <span className="block text-base text-muted-foreground">
        bù {formatUsdc(c.fromHoldback)} tiền giữ lại
        {c.fromBond > 0n && <>, {formatUsdc(c.fromBond)} ký quỹ</>}
        {c.fromReserve > 0n && <>, {formatUsdc(c.fromReserve)} quỹ dự phòng</>}
      </span>
    </span>
  );
}

function summary(r: LedgerRound): string {
  const short = r.cells?.filter((c) => c.kind === 'short').length ?? 0;
  const paid = r.cells?.filter((c) => c.kind === 'paid').length ?? 0;
  return short === 0 ? `${paid} người góp đủ.` : `${paid} người góp đủ, ${short} người thiếu và đã được bù.`;
}

/**
 * "Bảng sổ hụi": the paper ledger's grid as real UI. Rows are rounds, columns are members, every cell says what happened
 * in words. Desktop (1024px+) gets the full table; phones and tablets get one expandable line per round (7 columns do not fit).
 */
export function LedgerGrid({ members, rounds, viewer, phase }: Props) {
  const name = (i: number) => (i === viewer ? `${members[i]!.name} (bạn)` : members[i]!.name);
  const cols = members.length + 1;
  return (
    <section aria-labelledby="so-hui-title">
      <h2 id="so-hui-title" className="font-display text-h2 font-bold">
        Bảng sổ hụi
      </h2>
      <p className="mt-1 text-lead text-muted-foreground">Mỗi hàng là một kỳ, mỗi cột là một người. Sổ này ai trong dây cũng xem được.</p>

      {/* Desktop and tablet: the grid. */}
      <div className="o-phang mt-4 hidden overflow-x-auto lg:block">
        <table className="so-ke w-full border-collapse text-left">
          <caption className="sr-only">Bảng sổ hụi: mỗi hàng là một kỳ, mỗi cột là một thành viên, số tiền tính bằng USDC</caption>
          <thead>
            <tr className="border-b-2 border-foreground align-bottom">
              <th scope="col" className="px-4 py-3 font-semibold">
                Kỳ
              </th>
              {members.map((m, i) => {
                const st = STATUS[m.status];
                const Icon = st.icon;
                return (
                  <th key={m.name} scope="col" className={cn('px-3 py-3 font-semibold', i === viewer && 'bg-secondary')}>
                    <span className="block">{m.name}</span>
                    {i === viewer && <span className="block text-base font-semibold text-primary">bạn</span>}
                    <span className={cn('mt-1 inline-flex items-center gap-1 text-base font-normal', st.cls)}>
                      <Icon aria-hidden className="size-4 shrink-0" />
                      {st.label}
                    </span>
                  </th>
                );
              })}
              <th scope="col" className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                Người hốt nhận
              </th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r.k} className={cn('border-b border-border align-top last:border-b-0', r.state === 'running' && 'bg-state-warn-bg/60')}>
                <th scope="row" className="px-4 py-3 font-semibold whitespace-nowrap">
                  Kỳ {r.k}
                  {r.bid !== undefined && <span className="block text-base font-normal text-muted-foreground">thăm {formatUsdc(r.bid)}</span>}
                </th>
                {r.state === 'settled' ? (
                  <>
                    {r.cells!.map((c, i) => (
                      <td key={i} className={cn('px-3 py-3', i === viewer && 'bg-secondary/60')}>
                        <CellText c={c} />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="block font-semibold">{formatUsdc(r.payout!)}</span>
                      <span className="block text-base text-muted-foreground">{name(r.winner!)}</span>
                    </td>
                  </>
                ) : (
                  <td colSpan={cols} className={cn('px-3 py-3', r.state === 'later' && 'text-muted-foreground')}>
                    {r.state === 'running' ? <span className="font-semibold text-state-warn">{RUNNING[phase]}</span> : 'Chưa tới.'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground">
              <th scope="row" className="px-4 py-3 font-semibold">
                Đang giữ lại
              </th>
              {members.map((m, i) => (
                <td key={m.name} className={cn('px-3 py-3', i === viewer && 'bg-secondary/60', m.holdback === 0n && 'text-muted-foreground')}>
                  {formatUsdc(m.holdback)}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phones and tablets: one line per round, open it to see every member. */}
      <ol className="mt-4 space-y-3 lg:hidden">
        {rounds.map((r) =>
          r.state === 'settled' ? (
            <li key={r.k} className="o-phang">
              <details className="hoi">
                <summary className="flex min-h-14 items-start justify-between gap-3 p-4">
                  <span>
                    <span className="font-semibold">
                      Kỳ {r.k}: {name(r.winner!)} hốt, nhận {formatUsdc(r.payout!)}.
                    </span>
                    <span className="block text-muted-foreground">{summary(r)}</span>
                  </span>
                  <Plus aria-hidden className="dau-cong mt-1 size-6 shrink-0 text-primary transition-transform duration-200" />
                </summary>
                <ul className="border-t border-border px-4 py-2">
                  {r.cells!.map((c, i) => (
                    <li key={i} className="so-ke flex items-start justify-between gap-3 border-b border-border py-2 last:border-b-0">
                      <span className={cn(i === viewer && 'font-semibold')}>{name(i)}</span>
                      <span className="text-right">
                        <CellText c={c} />
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ) : (
            <li key={r.k} className={cn('o-phang p-4', r.state === 'running' ? 'bg-state-warn-bg' : 'text-muted-foreground')}>
              <span className="font-semibold">Kỳ {r.k}:</span> {r.state === 'running' ? RUNNING[phase] : 'chưa tới.'}
            </li>
          ),
        )}
        <li className="so-ke px-1 text-muted-foreground">
          Đang giữ lại:{' '}
          {members
            .map((m, i) => ({ m, i }))
            .filter(({ m }) => m.holdback > 0n)
            .map(({ m, i }) => `${name(i)} ${formatUsdc(m.holdback)}`)
            .join('; ') || 'chưa ai.'}
        </li>
      </ol>
    </section>
  );
}

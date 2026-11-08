import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatUsdc } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { RoundStrip } from '@/components/circle/RoundStrip';
import { Badge } from '@/components/ui/badge';
import type { SampleCircle } from '@/lib/sample';

const STATE: Record<SampleCircle['state'], { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Đang chạy', variant: 'secondary' }, // blue is reserved for actions (DESIGN.md)
  forming: { label: 'Đang gom người', variant: 'secondary' },
  completed: { label: 'Đã kết thúc', variant: 'outline' },
};

/**
 * One circle as a ledger row: name and state, the round strip (signature element), the next step with its deadline,
 * and one link. Rows sit inside one sheet, separated by hairlines, instead of a stack of look-alike cards.
 */
export function CircleCard({ c }: { c: SampleCircle }) {
  const s = STATE[c.state];
  const forming = c.state === 'forming';
  return (
    <li className="grid gap-4 border-t border-border px-5 py-5 first:border-t-0 md:grid-cols-[1fr_auto] md:items-center md:gap-x-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-h3 font-bold">{c.label}</h3>
          <Badge variant={s.variant}>{s.label}</Badge>
          <Badge variant="outline">{c.role === 'organizer' ? 'Bạn là chủ hụi' : 'Bạn là thành viên'}</Badge>
        </div>
        <RoundStrip className="mt-3" n={c.n} done={c.round} running={c.state === 'active'} myRound={c.myRound} winners={c.winners} />
        <p className="so-ke mt-3">
          {forming ? `Đã có ${c.joined} trên ${c.n} người.` : c.state === 'completed' ? `Đã chi đủ ${c.n} kỳ.` : `Đã chi ${c.round} trên ${c.n} kỳ.`} Mỗi kỳ góp{' '}
          {formatUsdc(c.contribution)}.
        </p>
        <p className="mt-1 font-semibold">
          Việc tiếp theo: {c.todo}
          {c.secondsLeft > 0 && (
            <>
              {' '}
              <span className="font-normal text-muted-foreground">
                (còn <Countdown seconds={c.secondsLeft} className="font-semibold text-foreground" />)
              </span>
            </>
          )}
        </p>
      </div>
      <Link
        href={c.href}
        aria-label={`Mở ${c.label}`}
        className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full border border-border bg-background px-5 font-semibold transition-colors duration-150 hover:bg-muted md:self-center"
      >
        Mở dây <ArrowRight aria-hidden className="size-5" />
      </Link>
    </li>
  );
}

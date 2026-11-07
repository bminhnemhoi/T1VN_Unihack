import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatUsdc } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { ProgressRing } from '@/components/brand/ProgressRing';
import { Badge } from '@/components/ui/badge';
import type { SampleCircle } from '@/lib/sample';

const STATE: Record<SampleCircle['state'], { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Đang chạy', variant: 'default' },
  forming: { label: 'Đang gom người', variant: 'secondary' },
  completed: { label: 'Đã kết thúc', variant: 'outline' },
};

/** One circle in the dashboard: ring (round k of N), role, state, the next thing to do and how long is left. */
export function CircleCard({ c }: { c: SampleCircle }) {
  const s = STATE[c.state];
  const ringLabel = c.state === 'forming' ? 'Chưa bắt đầu' : `Đã chi ${c.round} trên ${c.n} kỳ`;
  return (
    <li className="to-giay the-nang flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <ProgressRing value={c.round} total={c.n} label={ringLabel} size={96}>
        <span className="so-ke font-display text-3xl leading-none font-bold">{c.round}</span>
        <span className="text-base text-muted-foreground">/{c.n}</span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-bold">{c.label}</h2>
          <Badge variant={s.variant}>{s.label}</Badge>
          <Badge variant="outline">{c.role === 'organizer' ? 'Bạn là chủ hụi' : 'Bạn là thành viên'}</Badge>
        </div>
        <p className="so-ke mt-1 text-muted-foreground">
          {ringLabel}. Mỗi kỳ góp {formatUsdc(c.contribution)}.
        </p>
        <p className="mt-2 font-semibold">Việc cần làm: {c.todo}</p>
        {c.secondsLeft > 0 && (
          <p className="text-muted-foreground">
            Còn <Countdown seconds={c.secondsLeft} className="font-semibold text-foreground" />
          </p>
        )}
      </div>
      <Link
        href={c.href}
        aria-label={`Mở ${c.label}`}
        className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full border border-border bg-background px-5 font-semibold transition-colors duration-150 hover:bg-muted sm:self-center"
      >
        Mở dây <ArrowRight aria-hidden className="size-5" />
      </Link>
    </li>
  );
}

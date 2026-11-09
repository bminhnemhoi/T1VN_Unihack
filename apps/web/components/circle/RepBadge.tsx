import { Leaf, Sprout, TreeDeciduous, TriangleAlert, type LucideIcon } from 'lucide-react';
import { REP_DISCLAIMER, tierOf, type Reputation, type Tier } from '@/lib/hui-calc';
import { cn } from '@/lib/utils';

const ICON: Record<Tier, LucideIcon> = { new: Sprout, trusted: Leaf, veteran: TreeDeciduous };
const TONE: Record<Tier, string> = {
  new: 'border-border bg-secondary text-secondary-foreground',
  trusted: 'border-state-ok/40 bg-state-ok/10 text-state-ok',
  veteran: 'border-foreground bg-foreground text-background',
};
const WHO = { member: 'thành viên', organizer: 'chủ hụi' } as const;

/**
 * Reputation badge (decided 09/11): a tier computed from the registry history, an icon AND a word (never colour alone),
 * and a red flag for a default that was never repaid. It is history, not a guarantee, and no tier unlocks any right over money.
 */
export function RepBadge({ rep, who = 'member', showNext = false, className }: { rep: Reputation; who?: 'member' | 'organizer'; showNext?: boolean; className?: string }) {
  const info = tierOf(rep, who);
  const Icon = ICON[info.tier];
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <span
        title={`Bậc ${info.label} (${WHO[who]})`}
        className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-0.5 text-base font-semibold whitespace-nowrap', TONE[info.tier])}
      >
        <Icon aria-hidden className="size-4" />
        <span className="sr-only">Bậc </span>
        {info.label}
      </span>
      {info.redFlag && (
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-state-bad bg-state-bad/10 px-3 py-0.5 text-base font-semibold whitespace-nowrap text-state-bad">
          <TriangleAlert aria-hidden className="size-4" />
          Có nợ chưa trả
        </span>
      )}
      {showNext && info.toNext !== undefined && (
        <span className="text-base text-muted-foreground">
          Còn {info.toNext} dây sạch nữa để lên bậc {info.nextLabel}.
        </span>
      )}
    </span>
  );
}

export function RepDisclaimer({ className }: { className?: string }) {
  return <p className={cn('text-base text-muted-foreground', className)}>{REP_DISCLAIMER}</p>;
}

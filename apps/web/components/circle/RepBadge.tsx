'use client';

import { Leaf, Sprout, TreeDeciduous, TriangleAlert, type LucideIcon } from 'lucide-react';
import { TIER_LABEL_VI, type Tier, type TierResult } from 'sdk';
import { REP_DISCLAIMER, type Reputation } from '@/lib/hui-calc';
import { useChain } from '@/lib/chain/provider';
import { useReputation } from '@/lib/chain/hooks';
import { sampleTier } from '@/lib/live/tier';
import { SAMPLE_NOW_MS } from '@/lib/sample-circles';
import { cn } from '@/lib/utils';

const ICON: Record<Tier, LucideIcon> = { new: Sprout, trusted: Leaf, veteran: TreeDeciduous };
const TONE: Record<Tier, string> = {
  new: 'border-border bg-secondary text-secondary-foreground',
  trusted: 'border-state-ok/40 bg-state-ok/10 text-state-ok',
  veteran: 'border-foreground bg-foreground text-background',
};
const WHO = { member: 'thành viên', organizer: 'chủ hụi' } as const;

/**
 * Reputation badge (decided 09/11): a tier from the registry history, an icon AND a word (never colour alone), and a red
 * flag for a default that was never repaid. It is history, not a guarantee, and no tier unlocks any right over money.
 * With chain data (`rep.address` and a deployment) the tier is read live through `useReputation`; sample data goes through
 * the same SDK rules (`sampleTier`).
 */
export function RepBadge({ rep, who = 'member', showNext = false, className }: { rep: Reputation; who?: 'member' | 'organizer'; showNext?: boolean; className?: string }) {
  const chain = useChain();
  const live = useReputation(chain ? rep.address : undefined);
  const info: TierResult | undefined = chain && rep.address ? (live.data ? live.data[who] : undefined) : sampleTier(rep, who, Math.floor(SAMPLE_NOW_MS / 1000));
  if (!info) {
    return (
      <span className={cn('inline-flex min-h-8 items-center rounded-full border border-border px-3 py-0.5 text-base text-muted-foreground', className)}>
        {live.isError ? 'Chưa đọc được huy hiệu' : 'Đang đọc huy hiệu'}
      </span>
    );
  }
  const Icon = ICON[info.tier];
  const label = TIER_LABEL_VI[info.tier];
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <span
        title={`Bậc ${label} (${WHO[who]})`}
        className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-0.5 text-base font-semibold whitespace-nowrap', TONE[info.tier])}
      >
        <Icon aria-hidden className="size-4" />
        <span className="sr-only">Bậc </span>
        {label}
      </span>
      {info.redFlag && (
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-state-bad bg-state-bad/10 px-3 py-0.5 text-base font-semibold whitespace-nowrap text-state-bad">
          <TriangleAlert aria-hidden className="size-4" />
          Có nợ chưa trả
        </span>
      )}
      {showNext && info.next && (
        <span className="text-base text-muted-foreground">
          Để lên bậc {TIER_LABEL_VI[info.next.tier]}: {info.next.missing.join('; ')}.
        </span>
      )}
    </span>
  );
}

export function RepDisclaimer({ className }: { className?: string }) {
  return <p className={cn('text-base text-muted-foreground', className)}>{REP_DISCLAIMER}</p>;
}

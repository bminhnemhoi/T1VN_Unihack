'use client';

import type { ComponentProps } from 'react';
import { Countdown } from '@/components/brand/Countdown';
import { ActionButton } from '@/components/chain/ActionButton';
import { SoonButton } from '@/components/shell/SoonButton';
import { Button } from '@/components/ui/button';
import type { SampleCircleData } from '@/lib/sample-circles';

type ButtonProps = Pick<ComponentProps<typeof Button>, 'size' | 'variant' | 'className'>;

/**
 * "Chốt kỳ k": anyone may press it once the round's deadline has passed (docs/03 section 6.5). Sample data answers
 * "sắp có"; chain data sends `settleRound` and, before the deadline, says when it opens instead of failing.
 */
export function SettleButton({ c, round, ...style }: { c: SampleCircleData; round: number } & ButtonProps) {
  const live = c.live;
  if (!live) {
    return (
      <SoonButton {...style} message={`Chốt kỳ ${round} cần nối mạng và chỉ bấm được sau giờ chốt. Hiện là màn hình mẫu, chưa chốt gì.`}>
        Chốt kỳ {round}
      </SoonButton>
    );
  }
  const rv = live.view.rounds.find((r) => r.k === round);
  const left = rv ? Math.max(0, rv.deadline - Math.floor(live.nowMs / 1000)) : 0;
  if (live.view.state !== 'active') return <p className="mt-3 text-muted-foreground">Dây đang tạm dừng nên chưa chốt được.</p>;
  if (left > 0) {
    return (
      <>
        <Button type="button" {...style} aria-disabled="true" disabled>
          Chốt kỳ {round}
        </Button>
        <p className="mt-2">
          Chốt được sau <Countdown seconds={left} className="font-semibold" />.
        </p>
      </>
    );
  }
  return (
    <ActionButton {...style} run={(a) => a.settleRound(live.address)} success={`Đã chốt kỳ ${round}.`}>
      Chốt kỳ {round}
    </ActionButton>
  );
}

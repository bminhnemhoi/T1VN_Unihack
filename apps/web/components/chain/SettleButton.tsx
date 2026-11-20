'use client';

import type { ComponentProps } from 'react';
import { ActionButton } from '@/components/chain/ActionButton';
import { SoonButton } from '@/components/shell/SoonButton';
import type { Button } from '@/components/ui/button';
import { useChainNowSec } from '@/lib/live/useChainClock';
import type { SampleCircleData } from '@/lib/sample-circles';

type ButtonProps = Pick<ComponentProps<typeof Button>, 'size' | 'variant' | 'className'>;

/**
 * Role-aware settlement control: on sample data keeps the demo preview button; on live Fuji circles Keeper settles
 * automatically in 1-3s, the Organizer may trigger immediately after deadline, and regular members only see a fallback
 * rescue button if Keeper is delayed > 30s.
 */
export function SettleButton({ c, round, ...style }: { c: SampleCircleData; round: number } & ButtonProps) {
  const live = c.live;
  const chainNowSec = useChainNowSec(live?.nowMs);
  if (!live) {
    return (
      <SoonButton {...style} message={`Chốt kỳ ${round} cần nối mạng và chỉ bấm được sau giờ chốt. Hiện là màn hình mẫu, chưa chốt gì.`}>
        Chốt kỳ {round}
      </SoonButton>
    );
  }
  const rv = live.view.rounds.find((r) => r.k === round);
  if (live.view.state !== 'active') return <p className="mt-3 text-muted-foreground">Dây đang tạm dừng nên chưa khui được.</p>;
  if (!rv || chainNowSec < rv.deadline) return null;
  if (c.viewerIsOrganizer) {
    return (
      <ActionButton {...style} run={(a) => a.settleRound(live.address)} success={`Đã khui kỳ ${round}.`}>
        Khui kỳ {round} ngay
      </ActionButton>
    );
  }
  if (chainNowSec <= rv.deadline + 30) return null;
  return (
    <ActionButton {...style} run={(a) => a.settleRound(live.address)} success={`Đã khui kỳ ${round}.`}>
      Khui dự phòng kỳ {round}
    </ActionButton>
  );
}

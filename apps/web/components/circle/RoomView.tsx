'use client';

import { useState } from 'react';
import { formatUsdc, previewCircle } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { ProgressRing } from '@/components/brand/ProgressRing';
import { MemberTable } from '@/components/circle/MemberTable';
import { RoundTimeline, type Phase } from '@/components/circle/RoundTimeline';
import { SealedBidCard } from '@/components/circle/SealedBidCard';
import { Waterfall } from '@/components/circle/Waterfall';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DEMO_MEMBERS, usdc } from '@/lib/sample';
import { TOGGLE_ON } from '@/lib/utils';

const preview = previewCircle({ n: 5n, c: usdc(100), periodDays: 30n, alphaBps: 2000n, bond: usdc(480), capBps: 2000n });
const MAX_BID_K3 = preview.bidRows[2]!.maxBid; // 3,287671 USDC (docs/03 section 8)

/** S04 + S06 mock: circle detail and bid room in one page. The phase switch only exists to let reviewers see each state. */
export function RoomView() {
  const [phase, setPhase] = useState<Phase>('commit');
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-5">
        <ProgressRing value={2} total={5} size={104} label="Đã chi 2 trên 5 kỳ">
          <span className="so-ke font-display text-4xl leading-none font-bold">2</span>
          <span className="text-base text-muted-foreground">/5 kỳ</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl leading-tight font-bold md:text-5xl">Hụi tổ dân phố 7</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>Đang chạy</Badge>
            <Badge variant="outline">Bạn là thành viên 1</Badge>
            <Badge variant="secondary">Dữ liệu mẫu</Badge>
          </div>
          <p className="so-ke mt-2 text-xl text-muted-foreground">
            5 người, mỗi kỳ góp {formatUsdc(usdc(100))}. Kỳ 3 chốt sau <Countdown seconds={4 * 3600 + 12 * 60 + 9} className="font-semibold text-foreground" />.
          </p>
        </div>
      </div>

      <section aria-labelledby="ky3" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ky3" className="font-display text-3xl font-bold">Kỳ 3 đang diễn ra</h2>
          <div>
            <p id="pha-label" className="text-muted-foreground">Xem thử từng giai đoạn (chỉ có ở bản mẫu)</p>
            <ToggleGroup type="single" variant="outline" value={phase} onValueChange={(v) => v && setPhase(v as Phase)} aria-labelledby="pha-label" className="mt-1 flex-wrap">
              <ToggleGroupItem value="commit" className={TOGGLE_ON}>Nộp thăm</ToggleGroupItem>
              <ToggleGroupItem value="reveal" className={TOGGLE_ON}>Mở thăm</ToggleGroupItem>
              <ToggleGroupItem value="settle" className={TOGGLE_ON}>Chốt kỳ</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <div className="mt-4">
          <RoundTimeline phase={phase} />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
          <SealedBidCard phase={phase} round={3} maxBid={MAX_BID_K3} revealBond={usdc(1)} />
          <div>
            <h2 className="font-display text-2xl font-bold">Thành viên</h2>
            <div className="mt-2">
              <MemberTable members={DEMO_MEMBERS} />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-10">
        <Waterfall />
      </div>
    </main>
  );
}

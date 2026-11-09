'use client';

import { useState } from 'react';
import { formatUsdc, previewCircle } from 'sdk';
import { BidCalculator } from '@/components/circle/BidCalculator';
import { LedgerGrid } from '@/components/circle/LedgerGrid';
import { RepBadge, RepDisclaimer } from '@/components/circle/RepBadge';
import { RoundStrip } from '@/components/circle/RoundStrip';
import { RoundTimeline, type Phase } from '@/components/circle/RoundTimeline';
import { SealedBidCard } from '@/components/circle/SealedBidCard';
import { Waterfall } from '@/components/circle/Waterfall';
import { LedgerList } from '@/components/LedgerList';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DEMO_LEDGER, DEMO_MEMBERS, SAMPLE_CIRCLES, VIEWER, usdc } from '@/lib/sample';
import { getSampleCircle } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

const preview = previewCircle({ n: 5n, c: usdc(100), periodDays: 30n, alphaBps: 2000n, bond: usdc(480), capBps: 2000n });
const MAX_BID_K3 = preview.bidRows[2]!.maxBid; // 3,287671 USDC (docs/03 section 8)
const CIRCLE = SAMPLE_CIRCLES[0]!;
const DEMO = getSampleCircle('demo');
const PAST = DEMO.winnerByRound.map((w, i) => ({ k: i + 1, winner: DEMO.seats[w]!.name, bid: DEMO.bids[i]! }));
// Only members who have not received may bid (docs/03 section 6.1).
const BIDDERS = DEMO_MEMBERS.flatMap((m, i) => (m.status === 'live' ? [i === VIEWER ? `${m.name} (bạn)` : m.name] : []));

/**
 * S04 + S06 mock: one circle's room. Order follows the job: where the circle is (round strip), what to do in this round
 * (timeline + sealed bid + the round's rules), then the shared ledger and what happened when someone did not pay.
 */
export function RoomView() {
  const [phase, setPhase] = useState<Phase>('commit');
  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold">{CIRCLE.label}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Đang chạy</Badge>
            <Badge variant="outline">Bạn là thành viên {VIEWER + 1}</Badge>
            <Badge variant="secondary">Dữ liệu mẫu</Badge>
          </div>
          <p className="so-ke mt-2 text-lead text-muted-foreground">
            5 người, mỗi kỳ góp {formatUsdc(CIRCLE.contribution)}. Đã chi 2 trên 5 kỳ.
          </p>
        </div>
        <RoundStrip n={5} done={2} running winners={CIRCLE.winners} />
      </div>

      <section aria-labelledby="ky3" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="ky3" className="font-display text-h2 font-bold">
            Kỳ 3 đang diễn ra
          </h2>
          <div>
            <p id="pha-label" className="text-muted-foreground">
              Xem thử từng giai đoạn (chỉ có ở bản mẫu)
            </p>
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
        <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
          <SealedBidCard phase={phase} round={3} maxBid={MAX_BID_K3} revealBond={usdc(1)} commitSeconds={CIRCLE.secondsLeft} />
          <section aria-labelledby="luat-ky" className="o-phang p-6">
            <h3 id="luat-ky" className="font-display text-h3 font-bold">
              Luật của kỳ này
            </h3>
            <LedgerList
              className="mt-2"
              items={[
                { label: 'Trần thăm kỳ 3', value: formatUsdc(MAX_BID_K3) },
                { label: 'Cọc mở thăm', value: formatUsdc(usdc(1)) },
                { label: 'Được bỏ thăm', value: BIDDERS.join(', ') },
              ]}
            />
            <p className="mt-3 text-muted-foreground">
              Thăm cao nhất hốt. Bằng nhau thì người ít lần trễ hơn thắng, vẫn bằng thì ai nộp trước thắng. Không có may rủi.
            </p>
          </section>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
        <BidCalculator terms={DEMO.terms} round={3} past={PAST} />
        <section aria-labelledby="nguoi-trong-day" className="o-phang p-6">
          <h3 id="nguoi-trong-day" className="font-display text-h3 font-bold">
            Người trong dây
          </h3>
          <ul className="mt-2">
            <li className="dong-ke flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="font-semibold">Chủ hụi {DEMO.organizerAddr}</span>
              <RepBadge rep={DEMO.organizerRep} who="organizer" />
            </li>
            {DEMO.seats.map((s, i) => (
              <li key={i} className="dong-ke flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 last:border-b-0">
                <span className="font-semibold">{i === VIEWER ? `${s.name} (bạn)` : s.name}</span>
                <RepBadge rep={s.rep} showNext={i === VIEWER} />
              </li>
            ))}
          </ul>
          <RepDisclaimer className="mt-3" />
        </section>
      </div>

      <div className="mt-12">
        <LedgerGrid members={DEMO_MEMBERS} rounds={DEMO_LEDGER} viewer={VIEWER} phase={phase} />
      </div>

      <div className="mt-12">
        <Waterfall />
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { DEFAULT_MIN_COVERAGE_BPS, formatUsdc, previewCircle } from 'sdk';
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
import { toLedger, toSampleMembers } from '@/lib/chain/adapter';
import { DEMO_LEDGER, DEMO_MEMBERS, VIEWER, usdc } from '@/lib/sample';
import { lateImpact } from '@/lib/live/lateImpact';
import type { SampleCircleData } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

const sampleCap = previewCircle({ n: 5n, c: usdc(100), periodDays: 30n, alphaBps: 2000n, bond: usdc(480), capBps: 2000n, minCoverageBps: DEFAULT_MIN_COVERAGE_BPS }).bidRows[2]!.maxBid; // 3,287671 USDC (docs/03 section 8)

const PHASE_OF = { commit: 'commit', reveal: 'reveal', 'awaiting-settle': 'settle', 'not-started': 'commit', done: 'settle' } as const;

/**
 * S04 + S06: one circle's room. Order follows the job: where the circle is (round strip), what to do in this round
 * (timeline + sealed bid + the round's rules), then the shared ledger and what happened when someone did not pay.
 * Sample data keeps the phase switcher; chain data follows the real phase of the round.
 */
export function RoomView({ c }: { c: SampleCircleData }) {
  const live = c.live;
  const k = Math.min(c.settled + 1, Number(c.terms.n));
  const rv = live?.view.rounds.find((r) => r.k === k);
  const [samplePhase, setSamplePhase] = useState<Phase>('commit');
  const phase: Phase = live ? PHASE_OF[rv?.phase ?? 'commit'] : samplePhase;
  const maxBid = live ? (rv?.maxBid ?? 0n) : sampleCap;
  const revealBond = live ? (c.terms.c * BigInt(live.view.params.revealBondBps)) / 10_000n : usdc(1);
  const { members, viewer } = live ? toSampleMembers(live.view, live.viewerAddress) : { members: DEMO_MEMBERS, viewer: VIEWER };
  const ledger = live ? toLedger(live.view) : DEMO_LEDGER;
  const past = c.winnerByRound.map((w, i) => ({ k: i + 1, winner: c.seats[w]!.name, bid: c.bids[i]! }));
  const winners = c.winnerByRound.map((w) => c.seats[w]!.name);
  // Eligible to bid: live and with no open shortfall (docs/03 section 6.1), same rule as the button in the bid card.
  const owing = new Set(c.shortfalls.filter((s) => s.status !== 'paid').map((s) => s.member));
  const bidders = members.flatMap((m, i) => (m.status === 'live' && !owing.has(i) ? [i === viewer ? `${m.name} (bạn)` : m.name] : []));
  const n = Number(c.terms.n);
  const impact = lateImpact(c);

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold">{c.label}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{live?.view.state === 'paused' ? 'Đang tạm dừng' : 'Đang chạy'}</Badge>
            {viewer >= 0 ? <Badge variant="outline">Bạn là thành viên {viewer + 1}</Badge> : live && <Badge variant="outline">Bạn đang xem, chưa ở trong dây</Badge>}
            {!live && <Badge variant="secondary">Dữ liệu mẫu</Badge>}
          </div>
          <p className="so-ke mt-2 text-lead text-muted-foreground">
            {n} người, mỗi kỳ góp {formatUsdc(c.terms.c)}. Đã chi {c.settled} trên {n} kỳ.
          </p>
        </div>
        <RoundStrip n={n} done={c.settled} running myRound={viewer >= 0 ? c.winnerByRound.indexOf(viewer) + 1 || undefined : undefined} winners={winners} />
      </div>

      <section aria-labelledby={`ky${k}`} className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id={`ky${k}`} className="font-display text-h2 font-bold">
            Kỳ {k} đang diễn ra
          </h2>
          {!live && (
            <div>
              <p id="pha-label" className="text-muted-foreground">
                Xem thử từng giai đoạn (chỉ có ở bản mẫu)
              </p>
              <ToggleGroup type="single" variant="outline" value={samplePhase} onValueChange={(v) => v && setSamplePhase(v as Phase)} aria-labelledby="pha-label" className="mt-1 flex-wrap">
                <ToggleGroupItem value="commit" className={TOGGLE_ON}>Nộp thăm</ToggleGroupItem>
                <ToggleGroupItem value="reveal" className={TOGGLE_ON}>Mở thăm</ToggleGroupItem>
                <ToggleGroupItem value="settle" className={TOGGLE_ON}>Chốt kỳ</ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </div>
        <div className="mt-4">
          <RoundTimeline phase={phase} />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
          <SealedBidCard key={k} c={c} phase={phase} round={k} maxBid={maxBid} revealBond={revealBond} commitSeconds={c.roundSecondsLeft} />
          <section aria-labelledby="luat-ky" className="o-phang p-6">
            <h3 id="luat-ky" className="font-display text-h3 font-bold">
              Luật của kỳ này
            </h3>
            <LedgerList
              className="mt-2"
              items={[
                { label: `Trần thăm kỳ ${k}`, value: formatUsdc(maxBid) },
                { label: 'Cọc mở thăm', value: formatUsdc(revealBond) },
                { label: 'Quên mở thăm đã nộp', value: `mất cọc, bớt khoảng ${formatUsdc(impact.nextLoss)} thưởng đúng hạn` },
                { label: 'Được bỏ thăm', value: bidders.join(', ') || 'Không còn ai' },
              ]}
            />
            <p className="mt-3 text-muted-foreground">
              Thăm cao nhất hốt. Bằng nhau thì người ít lần trễ hơn thắng, vẫn bằng thì ai nộp trước thắng. Không có may rủi.
            </p>
          </section>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
        <BidCalculator terms={c.terms} round={k} past={past} bidderIsOrganizer={c.viewerIsOrganizer && viewer >= 0} />
        <section aria-labelledby="nguoi-trong-day" className="o-phang p-6">
          <h3 id="nguoi-trong-day" className="font-display text-h3 font-bold">
            Người trong dây
          </h3>
          <ul className="mt-2">
            <li className="dong-ke flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="font-semibold">Chủ hụi {c.organizerAddr}</span>
              <RepBadge rep={c.organizerRep} who="organizer" />
            </li>
            {c.seats.map((s, i) => (
              <li key={i} className="dong-ke flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 last:border-b-0">
                <span className="font-semibold">{i === viewer && !s.name.startsWith('Bạn') ? `${s.name} (bạn)` : s.name}</span>
                <RepBadge rep={s.rep} showNext={i === viewer} />
              </li>
            ))}
          </ul>
          <RepDisclaimer className="mt-3" />
        </section>
      </div>

      <div className="mt-12">
        <LedgerGrid members={members} rounds={ledger} viewer={viewer} phase={phase} />
      </div>

      <div className="mt-12">
        <Waterfall c={c} />
      </div>
    </main>
  );
}

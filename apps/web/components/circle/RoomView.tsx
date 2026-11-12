'use client';

import { useRef, useState } from 'react';
import { DEFAULT_MIN_COVERAGE_BPS, formatUsdc, previewCircle } from 'sdk';
import { BidCalculator } from '@/components/circle/BidCalculator';
import { RepBadge, RepDisclaimer } from '@/components/circle/RepBadge';
import { RoundRail, type RailRound } from '@/components/circle/RoundRail';
import { RoundPlan, RoundReceipt } from '@/components/circle/RoundStage';
import { RoundTimeline, type Phase } from '@/components/circle/RoundTimeline';
import { SealedBidCard } from '@/components/circle/SealedBidCard';
import { LedgerList } from '@/components/LedgerList';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toSampleMembers } from '@/lib/chain/adapter';
import { capOf } from '@/lib/hui-calc';
import { DEMO_MEMBERS, VIEWER, usdc } from '@/lib/sample';
import { lateImpact } from '@/lib/live/lateImpact';
import { settledRound, type SampleCircleData } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

const sampleCap = previewCircle({ n: 5n, c: usdc(100), periodDays: 30n, alphaBps: 2000n, bond: usdc(480), capBps: 2000n, minCoverageBps: DEFAULT_MIN_COVERAGE_BPS }).bidRows[2]!.maxBid; // 3,287671 USDC (docs/03 section 8)

const PHASE_OF = { commit: 'commit', reveal: 'reveal', 'awaiting-settle': 'settle', 'not-started': 'commit', done: 'settle' } as const;

const PHASE_LINE: Record<Phase, string> = { commit: 'Đang nộp thăm kín', reveal: 'Đang mở thăm', settle: 'Chờ chốt kỳ' };

/**
 * S04 + S06: one circle's room, laid out as a timeline (DESIGN.md v4, approved prototype 13/11). The round rail is the
 * navigation; the stage below shows the one job of the selected kỳ: a receipt for a settled kỳ, the bid room for the
 * running one, the bid ceiling for a later one. The full kỳ x member ledger lives on the Sổ hụi page.
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
  const past = c.winnerByRound.map((w, i) => ({ k: i + 1, winner: c.seats[w]!.name, bid: c.bids[i]! }));
  // Eligible to bid: live and with no open shortfall (docs/03 section 6.1), same rule as the button in the bid card.
  const owing = new Set(c.shortfalls.filter((s) => s.status !== 'paid').map((s) => s.member));
  const bidders = members.flatMap((m, i) => (m.status === 'live' && !owing.has(i) ? [i === viewer ? `${m.name} (bạn)` : m.name] : []));
  const n = Number(c.terms.n);
  const impact = lateImpact(c);
  const [selected, setSelected] = useState(k);
  const touch = useRef<number | null>(null);
  const select = (r: number) => setSelected(Math.min(Math.max(r, 1), n));
  const rail: RailRound[] = Array.from({ length: n }, (_, i) => {
    const r = i + 1;
    const short = c.shortfalls.some((s) => s.round === r);
    if (r <= c.settled) {
      const s = settledRound(c, r);
      return { k: r, state: 'done', line: `${c.seats[s.winner]?.name ?? 'Thành viên'} hốt`, sub: formatUsdc(s.payout), short };
    }
    if (r === k) return { k: r, state: 'now', line: PHASE_LINE[phase], sub: `trần ${formatUsdc(maxBid)}`, short };
    const cap = live?.view.rounds.find((x) => x.k === r)?.maxBid ?? capOf(c.terms, r);
    return { k: r, state: 'later', line: 'Chưa tới', sub: r === n ? 'không bỏ thăm' : `trần ${formatUsdc(cap)}`, short };
  });

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-6 lg:py-8">
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
      </div>

      <div className="mt-6">
        <RoundRail rounds={rail} selected={selected} onSelect={select} />
      </div>

      <div
        key={selected}
        className="stage-in mt-6"
        onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const x = e.changedTouches[0]?.clientX;
          if (touch.current !== null && x !== undefined && Math.abs(x - touch.current) > 60) select(selected + (x < touch.current ? 1 : -1));
          touch.current = null;
        }}
      >
      {selected < k && <RoundReceipt c={c} round={selected} />}
      {selected > k && <RoundPlan c={c} round={selected} />}
      {selected === k && (
      <>
      <section aria-labelledby={`ky${k}`}>
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

      </>
      )}
      </div>
    </main>
  );
}

'use client';
/**
 * "Dây": one circle as a timeline (approved prototype). The round rail (phone: story bars + swipe) is the navigation;
 * the stage below is the one job of the selected round: a receipt for a settled round, the bid room for the running
 * one, the plan for a later one. Works on sample data (simulated, "Tua nhanh" moves the phase) and on chain data
 * (every button sends its transaction; nothing changes on screen before the receipt).
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUsdcNumber, parseUsdc } from 'sdk';
import { CircleChips, Loading, ErrorState, EmptyState, Sheet, Who, av } from '@/components/app/parts';
import { TxButton, TxNote, TxSteps, useStepTx } from '@/components/app/tx';
import { PauseLockProvider, PausedBanner } from '@/components/chain/PauseLock';
import { CircleScreen } from '@/components/circle/CircleScreen';
import { TierText } from '@/components/circle/RepBadge';
import { bidQuote, capOf, roundSplit, startingBid } from '@/lib/hui-calc';
import { setDemoNet, useDemo, useSampleLoad } from '@/lib/demo-store';
import { commitBlocker, eligibilityBlocker } from '@/lib/live/bidEligibility';
import { useCircleData } from '@/lib/live/useCircleData';
import { useMyCommit } from '@/lib/live/useMyCommit';
import { formatVnTime, settledAtMs, settledRound, type SampleCircleData } from '@/lib/sample-circles';
import { usdc } from '@/lib/sample';

/** USDC with at least two decimals, like the prototype ("396,00", "3,287671"). */
const f = (u: bigint): string => {
  const s = formatUsdcNumber(u);
  return s.includes(',') ? s : `${s},00`;
};
const whole = (u: bigint): string => formatUsdcNumber(u);
const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  if (h >= 48) return `${Math.floor(h / 24)} ngày ${String(h % 24).padStart(2, '0')}:${mm}`;
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

type Phase = 'commit' | 'reveal' | 'settle' | 'done';
const PHASE_IDX: Record<Phase, number> = { commit: 0, reveal: 1, settle: 2, done: 3 };

export function CircleRoom({ id }: { id: string }) {
  const d = useCircleData(id);
  const sample = useSampleLoad(d.status === 'ready' && d.source === 'sample');
  if (d.status === 'loading' || (d.status === 'ready' && sample.status === 'loading')) return <RoomSkeleton />;
  if (d.status === 'error' || (d.status === 'ready' && sample.status === 'error')) return <ErrorState onRetry={d.status === 'error' ? () => window.location.reload() : () => setDemoNet('ok')} />;
  if (d.status === 'missing' || sample.status === 'empty')
    return <EmptyState title="Chưa có dây nào để xem." text="Khi bạn vào một dây, các kỳ của dây hiện ở đây." />;
  const c = d.data;
  const isRoom = (c.state === 'active' || c.live?.view.state === 'paused') && c.settled < Number(c.terms.n) && !(c.live && (c.live.view.state === 'cancelled' || c.live.view.state === 'unwound'));
  // Forming, finished and cancelled circles keep their own screens inside the frame.
  if (!isRoom) return <CircleScreen id={id} screen="overview" />;
  const paused = c.paused === true || c.live?.view.state === 'paused';
  return (
    <PauseLockProvider value={paused}>
      <Room c={c} refreshing={sample.refreshing} stale={sample.stale} />
    </PauseLockProvider>
  );
}

function RoomSkeleton() {
  return (
    <main id="noi-dung" className="room">
      <Loading>
        <div className="ctx">
          <div className="sk skTitle" />
          <div className="skRail">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="sk" />
            ))}
          </div>
          <div className="sk skStory" />
        </div>
        <section className="stage">
          <div className="sk skDark" />
          <div className="sk skSideP skSide" />
        </section>
      </Loading>
    </main>
  );
}

interface SampleRun {
  phase: Phase;
  sealed: boolean;
  revealed: boolean;
  settled?: { winner: number; bid: bigint; payout: bigint };
}

function Room({ c, refreshing, stale }: { c: SampleCircleData; refreshing: boolean; stale: boolean }) {
  const live = c.live;
  const n = Number(c.terms.n);
  const k = Math.min(c.settled + 1, n);
  const [sel, setSel] = useState(k);
  const [dir, setDir] = useState(0);
  const [stamp, setStamp] = useState(false);
  const rv = live?.view.rounds.find((r) => r.k === k);
  const { ffwd } = useDemo();
  const [run, setRun] = useState<SampleRun>({ phase: 'commit', sealed: false, revealed: false });
  const [bidText, setBidText] = useState(() => startingBid(live ? (rv?.maxBid ?? 0n) : capOf(c.terms, k)));
  const firstFfwd = useRef(ffwd);
  const maxBid = live ? (rv?.maxBid ?? 0n) : capOf(c.terms, k);
  // The sample rival: the first other live member, sealed at 2,50 USDC (or 3/4 of a smaller ceiling). Ties go to the rival (earlier commit).
  const rival = useMemo(() => {
    const i = c.seats.findIndex((s, i) => i !== c.viewer && s.joined && !c.winnerByRound.includes(i) && !c.shortfalls.some((x) => x.member === i && x.status === 'defaulted'));
    return i >= 0 ? i : Math.max(c.viewer, 0);
  }, [c]);
  const rivalBid = usdc(2, 50) <= (maxBid * 3n) / 4n ? usdc(2, 50) : ((maxBid * 3n) / 4n / 10_000n) * 10_000n;

  // "Tua nhanh" (sample only): commit -> reveal -> settled.
  useEffect(() => {
    if (live || ffwd === firstFfwd.current) return;
    firstFfwd.current = ffwd;
    setRun((r) => {
      if (r.phase === 'commit') return { ...r, phase: 'reveal' };
      if (r.phase === 'reveal') {
        const mine = r.sealed && r.revealed ? parseUsdc(bidText.replace(/\./g, '')) : undefined;
        const youWin = mine !== undefined && mine > rivalBid && c.viewer >= 0;
        const winner = youWin ? c.viewer : rival;
        const bid = youWin ? mine! : rivalBid;
        const organizerWins = c.viewerIsOrganizer && winner === c.viewer;
        return { ...r, phase: 'done', settled: { winner, bid, payout: roundSplit(c.terms, k, bid, 0n, organizerWins).payout } };
      }
      return r;
    });
    setSel(k);
    setStamp(true);
  }, [ffwd, live, bidText, rival, rivalBid, c, k]);

  const go = useCallback(
    (r: number) => {
      const next = Math.min(Math.max(r, 1), n);
      if (next === sel) return;
      setDir(Math.sign(next - sel));
      setSel(next);
      setStamp(false);
    },
    [n, sel],
  );

  const touch = useRef<{ x: number; y: number } | null>(null);
  const roundDone = (r: number) => r < k || (r === k && !!run.settled && !live);
  const flag = (r: number) => c.shortfalls.some((s) => s.round === r);
  const rvUntil = rv ? (rv.phase === 'commit' ? rv.commitEndsAt : rv.phase === 'reveal' ? rv.revealEndsAt : rv.deadline) : undefined;
  const railLeft = useSecondsLeft(live ? rvUntil : undefined, live?.nowMs, c.roundSecondsLeft ?? 78);
  const phase: Phase = live ? ({ commit: 'commit', reveal: 'reveal', 'awaiting-settle': 'settle', 'not-started': 'commit', done: 'done' } as const)[rv?.phase ?? 'commit'] : run.phase;
  const viewerName = c.viewer >= 0 ? `bạn là ${av(c.viewer)}` : c.live ? 'bạn đang xem, chưa ở trong dây' : '';
  const mode = c.terms.mode === 'fixed' ? 'hốt theo thứ tự' : 'bỏ thăm kín';
  const period = c.terms.periodDays >= 28n ? 'hụi tháng' : c.terms.periodDays >= 14n ? 'hụi nửa tháng' : c.terms.periodDays === 7n ? 'hụi tuần' : `kỳ ${c.terms.periodDays} ngày`;

  const railItem = (r: number) => {
    if (roundDone(r)) {
      const s = r === k && run.settled ? { winner: run.settled.winner, payout: run.settled.payout } : settledRound(c, r);
      return { cls: 'done', main: `${av(s.winner)} hốt`, sub: `${f(s.payout)} USDC` };
    }
    if (r === k) {
      const main = c.terms.mode === 'fixed' ? `${av(fixedTaker(c, k))} hốt` : ['Đang thăm', 'Mở thăm', 'Chốt kỳ', 'Chốt kỳ'][PHASE_IDX[phase]]!;
      return { cls: 'now', main, sub: phase === 'commit' || live ? `còn ${clock(railLeft)}` : 'đang chạy' };
    }
    return { cls: 'later', main: r === n ? 'Kỳ cuối' : 'Kỳ sau', sub: c.terms.mode === 'fixed' ? `${av(fixedTaker(c, r))} hốt` : r === n ? 'không thăm' : `trần ${f(capOf(c.terms, r))}` };
  };
  const sub = (r: number) => {
    const it = railItem(r);
    return `${it.main} · ${it.sub}`;
  };

  return (
    <main id="noi-dung" className="room">
      <CircleChips c={c} bondSpent={run.settled ? sampleBondUse(c, k) : 0n} refreshing={refreshing} stale={stale} />
      <div className="ctx">
        {c.paused && <PausedBanner />}
        <div className="ctxHead">
          <h1>{c.label}</h1>
          <small>
            {n} người × {whole(c.terms.c)} USDC · {period} · {mode}
            {viewerName ? ` · ${viewerName}` : ''}
            {!live ? ' · dữ liệu mẫu' : ''}
          </small>
        </div>
        <ol className={`rail${n > 8 ? ' many' : ''}`} aria-label="Các kỳ của dây" style={{ ['--n' as string]: Math.min(n, 8) }}>
          {Array.from({ length: n }, (_, i) => {
            const r = i + 1;
            const it = railItem(r);
            return (
              <li key={r}>
                <button type="button" className={it.cls} aria-current={sel === r} onClick={() => go(r)}>
                  <span className="k">
                    <span className="label">K{r}</span>
                    {flag(r) && <em className="flag" title="Có khoản thiếu" />}
                  </span>
                  <strong>{it.main}</strong>
                  <small>{it.sub}</small>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="storyNav">
          <button type="button" aria-label="Kỳ trước" disabled={sel === 1} onClick={() => go(sel - 1)}>
            ‹
          </button>
          <div className="snMid">
            <div className="bars" aria-label="Các kỳ của dây" style={{ ['--n' as string]: n }}>
              {Array.from({ length: n }, (_, i) => {
                const r = i + 1;
                const cls = `${railItem(r).cls}${flag(r) ? ' flagged' : ''}`;
                return <button key={r} type="button" className={cls} aria-current={sel === r} aria-label={`Kỳ ${r}`} onClick={() => go(r)}><i /></button>;
              })}
            </div>
            <strong>
              Kỳ {sel}/{n}
            </strong>
            <small>{sub(sel)}</small>
          </div>
          <button type="button" aria-label="Kỳ sau" disabled={sel === n} onClick={() => go(sel + 1)}>
            ›
          </button>
        </div>
      </div>
      <div
        className="roomView"
        onPointerDown={(e) => {
          touch.current = (e.target as HTMLElement).closest('input, button, a, .tableWrap') ? null : { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.clientX - t.x;
          const dy = e.clientY - t.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(sel + (dx < 0 ? 1 : -1));
        }}
      >
        <div key={sel} className={dir > 0 ? 'inL' : dir < 0 ? 'inR' : 'in'}>
          {roundDone(sel) && !(sel === k && run.settled) && <Receipt c={c} r={sel} stamp={stamp} />}
          {sel === k && (!roundDone(k) || run.settled) &&
            (c.terms.mode === 'fixed' ? (
              <FixedNow c={c} k={k} />
            ) : (
              <BidNow c={c} k={k} phase={phase} maxBid={maxBid} bidText={bidText} setBidText={setBidText} run={run} setRun={setRun} stamp={stamp} setStamp={setStamp} rival={rival} rivalBid={rivalBid} />
            ))}
          {sel > k && <Later c={c} r={sel} k={k} settledNow={!!run.settled} />}
        </div>
      </div>
    </main>
  );
}

/** Bond spent by the sample's running round when it settles: every defaulted member's share is covered by the bond. */
function sampleBondUse(c: SampleCircleData, k: number): bigint {
  const dead = c.shortfalls.filter((s) => s.status === 'defaulted' && s.round < k).length;
  return BigInt(dead) * c.terms.c;
}

/** Fixed circles: round r goes to the member who joined r-th (frozen members move to the end, docs/03 section 6.4). */
function fixedTaker(c: SampleCircleData, r: number): number {
  return c.winnerByRound[r - 1] ?? r - 1;
}

const SOURCES = [
  ['fromHoldback', 'tiền giữ lại của chính', 'var(--ink-2)'],
  ['fromBond', 'ký quỹ chủ hụi', 'var(--ink)'],
  ['fromReserve', 'quỹ dự phòng', 'var(--forest)'],
  ['uncovered', 'chưa ai bù (khoản đòi công khai)', 'var(--red)'],
] as const;

function Receipt({ c, r, stamp }: { c: SampleCircleData; r: number; stamp: boolean }) {
  const s = settledRound(c, r);
  const short = c.shortfalls.filter((x) => x.round === r);
  const C = c.terms.c;
  const received = new Set(c.winnerByRound.slice(0, r - 1));
  const payers = c.seats.flatMap((seat, i) => (seat.joined && i !== s.winner ? [i] : []));
  const live = payers.filter((i) => !received.has(i)).length;
  const dead = payers.length - live;
  const w = av(s.winner);
  const defaulted = short.filter((x) => x.status === 'defaulted');
  const total = short.reduce((a, x) => a + x.amount, 0n);
  const bondBefore = c.bond - c.shortfalls.filter((x) => x.round < r).reduce((a, x) => a + x.fromBond, 0n);
  return (
    <section className="stage">
      <article className="panel receipt" aria-labelledby={`bl-${r}`}>
        <header className="rh">
          <span className="label">Biên lai · Kỳ {r}</span>
          <span className="label" style={short.length ? { color: 'var(--red-ink)' } : undefined}>
            {short.length ? 'Có khoản thiếu' : c.label}
          </span>
        </header>
        <h2 id={`bl-${r}`}>
          {short.length
            ? `${short.map((x) => av(x.member)).join(', ')} không đóng ${f(total)} USDC. ${w} vẫn nhận đủ.`
            : `${w} thắng với thăm ${f(s.bid)} USDC`}
        </h2>
        {short.length > 0 && (
          <div className="cascade">
            <div className="bar" role="img" aria-label={`Khoản thiếu ${f(total)} USDC: ${short.map((x) => SOURCES.filter(([key]) => x[key] > 0n).map(([key, word]) => `${f(x[key])} từ ${word}${key === 'fromHoldback' ? ' ' + av(x.member) : ''}`).join(', ')).join('; ')}`}>
              {short.flatMap((x) =>
                SOURCES.filter(([key]) => x[key] > 0n).map(([key, , color], j) => (
                  <i key={`${x.member}-${key}`} style={{ width: `${Number((x[key] * 10_000n) / (total || 1n)) / 100}%`, background: color, animationDelay: `${j * 120}ms` }} />
                )),
              )}
            </div>
            <div className="legend">
              {short.flatMap((x) =>
                SOURCES.filter(([key]) => x[key] > 0n).map(([key, word, color]) => (
                  <span key={`${x.member}-${key}`}>
                    <i style={{ background: color }} />
                    {f(x[key])} từ {word}
                    {key === 'fromHoldback' ? ` ${av(x.member)}` : ''}
                    {key === 'fromBond' ? ` (${f(bondBefore)} → ${f(bondBefore - x.fromBond)})` : ''}
                  </span>
                )),
              )}
            </div>
          </div>
        )}
        <dl className="rc">
          <div>
            <dt>
              Tiền góp ({live} × {f(C - s.bid)}
              {dead > 0 ? ` + ${dead} × ${f(C)}` : ''})
            </dt>
            <dd>{f(s.pot)}</dd>
          </div>
          <div className="neg">
            <dt>Hoa hồng chủ hụi {short.length ? '(giữ lại)' : '(trả ngay)'}</dt>
            <dd>−{f(s.fee)}</dd>
          </div>
          <div className="neg">
            <dt>Quỹ dự phòng</dt>
            <dd>−{f(s.premium)}</dd>
          </div>
          <div className="neg">
            <dt>Giữ lại phòng {w} bỏ đóng</dt>
            <dd>−{f(s.holdback)}</dd>
          </div>
          <div className="big">
            <dt>
              {w} nhận{short.length ? ` (thăm ${f(s.bid)})` : ''}
            </dt>
            <dd>{f(s.payout)}</dd>
          </div>
        </dl>
        <footer className="rf">
          <span>{short.length ? (defaulted.length ? 'Hoa hồng kỳ này mất vào quỹ dự phòng vì có người vỡ nợ' : 'Hoa hồng kỳ này giữ lại tới khi khoản thiếu được trả') : 'Kỳ sạch: hoa hồng trả ngay'}</span>
          <span>
            Chốt {formatVnTime(settledAtMs(c, r))} ·{' '}
            {c.live ? <Link href={`/circles/${c.id}/so-ho`}>mã giao dịch ở sổ hụi</Link> : 'mã giao dịch có ở bản thật'}
          </span>
          <span>
            <Link href={`/circles/${c.id}/ket-qua`}>Chi tiết kỳ {r}</Link>
            {short.length > 0 && (
              <>
                {' · '}
                <Link href={`/circles/${c.id}/thieu`}>Khoản thiếu</Link>
              </>
            )}
          </span>
        </footer>
        <div className={`stamp on win${stamp ? ' land' : ''}`}>
          {short.length ? `${w} HỐT` : 'ĐÃ HỐT'}
          <small>{short.length ? `nhận đủ ${f(s.payout)}` : `${w} · ${f(s.payout)}`}</small>
        </div>
      </article>
      <div className="panel lite side">
        <h2>Ai góp kỳ {r}</h2>
        <p className="hint">
          {payers.length - short.length} người góp đúng hạn
          {live > 0 ? `, người chưa hốt góp ${f(C - s.bid)} USDC` : ''}
          {dead > 0 ? `, người đã hốt góp ${f(C)}` : ''}.{short.length ? ` ${short.map((x) => av(x.member)).join(', ')} không đóng.` : ''}
        </p>
        <Who
          rows={c.seats.flatMap((seat, i) => {
            if (!seat.joined) return [];
            const sf = short.find((x) => x.member === i);
            const right =
              i === s.winner ? <span className="tag ok">Hốt</span> : sf ? <span className="tag bad">{sf.status === 'defaulted' ? 'Vỡ nợ' : sf.status === 'paid' ? 'Đã trả trễ' : 'Thiếu'}</span> : <span className="mono">−{f(received.has(i) ? C : C - s.bid)}</span>;
            return [{ key: i, av: av(i), me: i === c.viewer, name: i === c.viewer ? 'Bạn' : seat.name, sub: i === s.winner ? 'Người hốt' : sf ? (sf.status === 'defaulted' ? 'Quá ân hạn' : 'Trong ân hạn') : undefined, right }];
          })}
        />
        {defaulted.length > 0 && <p className="hint">Khoản của {defaulted.map((x) => av(x.member)).join(', ')} thành khoản đòi công khai. Các kỳ sau ký quỹ bù phần của người vỡ nợ.</p>}
        {short.some((x) => x.member === c.viewer && x.status === 'grace') && (
          <Link className="btn lime" href={`/circles/${c.id}/thieu`}>
            Trả khoản thiếu của bạn
          </Link>
        )}
      </div>
    </section>
  );
}

function Later({ c, r, k, settledNow }: { c: SampleCircleData; r: number; k: number; settledNow: boolean }) {
  const n = Number(c.terms.n);
  const cap = c.live?.view.rounds.find((x) => x.k === r)?.maxBid ?? capOf(c.terms, r);
  const dead = c.shortfalls.filter((s) => s.status === 'defaulted');
  const bondAfter = c.bondRemaining - BigInt(dead.length) * c.terms.c * BigInt(r - k);
  const fixed = c.terms.mode === 'fixed';
  return (
    <section className="stage">
      <div className="panel lite">
        <span className="label">Kỳ {r} · chưa tới</span>
        <h2>{fixed ? `${av(fixedTaker(c, r))} hốt theo thứ tự vào dây` : r === n ? 'Người còn lại hốt, không bỏ thăm' : `Bắt đầu sau khi chốt kỳ ${r - 1}`}</h2>
        <dl className="rc">
          {!fixed && (
            <div>
              <dt>Trần thăm theo NĐ 19 Điều 21</dt>
              <dd>{f(r === n ? 0n : cap)} USDC</dd>
            </div>
          )}
          <div>
            <dt>Mỗi người chưa hốt góp</dt>
            <dd>{fixed ? `${f(c.terms.c)} USDC` : `${f(c.terms.c)} − thăm thắng`}</dd>
          </div>
          {dead.map((s) => (
            <div key={s.member}>
              <dt>Phần của {av(s.member)} (vỡ nợ)</dt>
              <dd>ký quỹ bù {f(c.terms.c)}</dd>
            </div>
          ))}
          <div>
            <dt>Ký quỹ còn trước kỳ {r} (nếu không ai thiếu thêm)</dt>
            <dd>{f(bondAfter > 0n ? bondAfter : 0n)} USDC</dd>
          </div>
        </dl>
        {!fixed && <p className="hint">Trần thăm là cách hiểu của nhóm về NĐ 19/2019, chờ luật sư xác nhận.</p>}
      </div>
      <div className="panel lite side">
        <h2>Lịch</h2>
        <Who
          rows={Array.from({ length: n - k + 1 }, (_, i) => {
            const kk = k + i;
            const start = c.live?.view.rounds.find((x) => x.k === kk)?.roundStart;
            return {
              key: kk,
              av: `K${kk}`,
              name: kk === k ? 'Đang chạy' : kk === n ? 'Kỳ cuối' : 'Kỳ sau',
              sub: start ? `dự kiến ${formatVnTime(start * 1000)}` : kk === k ? undefined : `khoảng ${formatVnTime(c.startMs + c.roundMs * (kk - 1))}`,
              right: <span className={`tag${kk === k ? ' lime' : ''}`}>{kk === k ? (settledNow ? 'Xong' : 'Bây giờ') : 'Sắp tới'}</span>,
            };
          })}
        />
      </div>
    </section>
  );
}

/** Seconds left of a live round's current window, ticking locally between polls. */
function useSecondsLeft(until: number | undefined, nowMs: number | undefined, fallback: number | undefined): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.floor((now - start) / 1000);
  if (until !== undefined && nowMs !== undefined) return Math.max(0, until - Math.floor(nowMs / 1000) - elapsed);
  return Math.max(0, (fallback ?? 0) - elapsed);
}

interface BidNowProps {
  c: SampleCircleData;
  k: number;
  phase: Phase;
  maxBid: bigint;
  bidText: string;
  setBidText: (v: string) => void;
  run: SampleRun;
  setRun: (f: (r: SampleRun) => SampleRun) => void;
  stamp: boolean;
  setStamp: (v: boolean) => void;
  rival: number;
  rivalBid: bigint;
}

function BidNow({ c, k, phase, maxBid, bidText, setBidText, run, setRun, stamp, setStamp, rival, rivalBid }: BidNowProps) {
  const live = c.live;
  const rv = live?.view.rounds.find((r) => r.k === k);
  const me = live?.viewerAddress;
  const commit = useMyCommit(live?.address, k, me);
  const mine = commit.data;
  const t = useStepTx();
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);
  const C = c.terms.c;
  const bid = parseUsdc(bidText.trim().replace(/\./g, ''));
  const err = bid === undefined ? 'Nhập số tiền, ví dụ 2,5' : bid >= C ? `Thăm phải nhỏ hơn ${f(C)} USDC.` : bid > maxBid ? `Vượt trần kỳ này (${f(maxBid)} USDC). Thăm này sẽ không mở được.` : '';
  const organizerSeat = c.viewerIsOrganizer && c.viewer >= 0;
  const q = bidQuote(c.terms, k, err ? 0n : bid!, organizerSeat);
  const sealed = live ? !!mine?.committed && !editing : run.sealed && !editing;
  const revealed = live ? !!mine?.revealed : run.revealed;
  const blocker = live ? (phase === 'commit' ? commitBlocker(live.view, me) : eligibilityBlocker(live.view, me)) : c.viewer < 0 ? 'Bạn chưa ở trong dây này nên không bỏ thăm được.' : undefined;
  const until = phase === 'commit' ? rv?.commitEndsAt : phase === 'reveal' ? rv?.revealEndsAt : rv?.deadline;
  const left = useSecondsLeft(live ? until : undefined, live?.nowMs, phase === 'commit' ? (c.roundSecondsLeft ?? 78) : 0);
  const settleOpen = live ? rv !== undefined && left === 0 && phase === 'settle' : false;
  const locked = sealed || phase !== 'commit' || !!run.settled || t.busy;
  const ph = PHASE_IDX[phase];

  const seal = async (retry: boolean) => {
    if (err || bid === undefined) return;
    // A retry reads the chain first: a commit already there is not sent again (audit I-01, keeps the commitIndex).
    const ok = await t.run((a) => a.commitBid(live!.address, k, bid, { resume: retry }), { forceOk: retry });
    if (ok) {
      setEditing(false);
      if (!live) setRun((r) => ({ ...r, sealed: true }));
      setStamp(true);
    }
  };
  const reveal = async (retry: boolean) => {
    const ok = await t.run((a) => a.revealBid(live!.address, k), { forceOk: retry });
    if (ok) {
      if (!live) setRun((r) => ({ ...r, revealed: true }));
      setStamp(true);
    }
  };
  const settle = async (retry: boolean) => {
    await t.run((a) => a.settleRound(live!.address), { forceOk: retry });
  };

  let stampEl = null;
  let primary = null;
  let note = '';
  if (run.settled) {
    const youWon = run.settled.winner === c.viewer;
    stampEl = (
      <div className={`stamp on${youWon ? ' win' : ''}${stamp ? ' land' : ''}`}>
        {youWon ? 'ĐÃ HỐT' : `${av(run.settled.winner)} HỐT`}
        <small>{youWon ? `${f(run.settled.payout)} USDC` : `thăm ${f(run.settled.bid)}`}</small>
      </div>
    );
    note = youWon
      ? `Bạn thắng với thăm ${f(run.settled.bid)}. Tiền đã về ví: ${f(run.settled.payout)} USDC.`
      : `${av(run.settled.winner)} thắng với thăm ${f(run.settled.bid)}. Bạn góp ${f(C - run.settled.bid)} USDC, phần của bạn vẫn còn cho kỳ sau.`;
    primary = (
      <Link className="btn ink" href={`/circles/${c.id}/so-ho`}>
        Xem sổ hụi ↗
      </Link>
    );
  } else if (phase === 'commit') {
    stampEl = (
      <div className={`stamp${sealed ? ' on' : ''}${sealed && stamp ? ' land' : ''}`}>
        ĐÃ NIÊM PHONG<small>không ai đọc được</small>
      </div>
    );
    primary = sealed ? (
      <button type="button" className="btn ghost" onClick={() => setEditing(true)}>
        Đổi thăm
      </button>
    ) : (
      <TxButton t={t} label="Niêm phong thăm" retryLabel="Gửi lại thăm" onRun={(r) => void seal(r)} disabled={!!err || !!blocker} />
    );
    note = blocker ?? (sealed ? (live ? 'Hết giờ nộp thì mở thăm. Muốn đổi số, nộp lại trước khi hết giờ (cọc giữ nguyên).' : 'Hết giờ nộp thì mở thăm. Bấm "Tua nhanh" để đi tiếp.') : `Thăm được gửi on-chain dưới dạng hash niêm phong. Kèm cọc mở thăm ${f((C * 100n) / 10_000n)} USDC, trả lại khi bạn mở.`);
  } else if (phase === 'reveal') {
    stampEl = (
      <div className={`stamp${revealed ? ' on' : ''}${revealed && stamp ? ' land' : ''}`}>
        ĐÃ MỞ<small>{live && mine?.revealed ? f(mine.bid) : f(bid ?? 0n)} USDC</small>
      </div>
    );
    const hasSealed = live ? !!mine?.committed : run.sealed;
    primary =
      hasSealed && !revealed ? (
        <TxButton t={t} label="Mở thăm" retryLabel="Gửi lại lệnh mở thăm" onRun={(r) => void reveal(r)} disabled={!!blocker && live !== undefined} />
      ) : (
        <button type="button" className="btn ghost" disabled>
          {hasSealed ? 'Đã mở, chờ chốt kỳ' : 'Bạn không nộp thăm kỳ này'}
        </button>
      );
    note = hasSealed && !revealed ? 'Mở đúng số đã niêm phong. Không mở thì mất cọc và tính một lần trễ.' : live ? 'Hết giờ mở thăm thì ai cũng chốt kỳ được.' : 'Bấm "Tua nhanh" để chốt kỳ.';
  } else {
    primary = live ? (
      <TxButton t={t} label={`Chốt kỳ ${k}`} retryLabel={`Gửi lại lệnh chốt kỳ ${k}`} onRun={(r) => void settle(r)} disabled={!settleOpen} />
    ) : null;
    note = settleOpen ? 'Ai cũng bấm được, không cần chờ chủ hụi.' : `Chốt kỳ bấm được sau giờ chốt, còn ${clock(left)}.`;
  }

  const others = c.seats.flatMap((seat, i) => {
    if (!seat.joined) return [];
    const got = c.winnerByRound.indexOf(i);
    const dead = c.shortfalls.find((s) => s.member === i && s.status === 'defaulted');
    let sub: string;
    let right;
    if (dead) {
      sub = `Vỡ nợ, ký quỹ bù ${f(C)}`;
      right = <span className="tag bad">Vỡ nợ</span>;
    } else if (got >= 0) {
      sub = `Đã hốt kỳ ${got + 1}, góp ${f(C)}`;
      right = <span className="tag">Không thăm</span>;
    } else if (i === c.viewer) {
      sub = 'Bạn';
      right = <span className={`tag ${sealed ? 'ok' : 'lime'}`}>{revealed ? f(live && mine ? mine.bid : (bid ?? 0n)) : sealed ? 'Kín' : 'Chưa nộp'}</span>;
    } else if (!live && i === rival) {
      sub = phase === 'commit' ? 'Đã niêm phong' : 'Đã mở';
      right = <span className={`tag ${phase === 'commit' ? 'ok' : 'lime'}`}>{phase === 'commit' ? 'Kín' : f(rivalBid)}</span>;
    } else {
      sub = live ? 'Được bỏ thăm' : 'Chưa nộp thăm';
      right = <span className="tag">{live ? 'Được thăm' : 'Chưa nộp'}</span>;
    }
    return [
      {
        key: i,
        av: av(i),
        me: i === c.viewer,
        name: i === c.viewer ? 'Bạn' : seat.name,
        sub: (
          <>
            {i === c.viewer ? '' : `${sub} · `}
            <TierText rep={seat.rep} />
          </>
        ),
        right,
      },
    ];
  });

  const label = (
    <span className="label">
      Nếu bạn thắng kỳ {k} với thăm {err ? '—' : f(bid!)}
    </span>
  );
  const estimate = (
    <>
      <dl className="rc">
        <div>
          <dt>
            Tiền góp ({q.livePayers} × {err ? '…' : f(C - bid!)}
            {q.deadPayers > 0 ? ` + ${q.deadPayers} × ${f(C)}` : ''})
          </dt>
          <dd>{f(q.pot)}</dd>
        </div>
        <div className="neg">
          <dt>Hoa hồng chủ hụi</dt>
          <dd>−{f(q.fee)}</dd>
        </div>
        <div className="neg">
          <dt>Quỹ dự phòng</dt>
          <dd>−{f(q.premium)}</dd>
        </div>
        <div className="neg">
          <dt>
            Giữ lại ({Number(c.terms.alphaBps) / 100}% × {Number(c.terms.n) - k} kỳ còn lại)
          </dt>
          <dd>−{f(q.holdback)}</dd>
        </div>
        <div className="big">
          <dt>Bạn nhận ngay</dt>
          <dd>{f(q.payout)}</dd>
        </div>
      </dl>
    </>
  );

  return (
    <section className="stage">
      <div className="panel inkp">
        <ol className="phases" aria-label={`Các bước của kỳ ${k}`}>
          {['Nộp thăm kín', 'Mở thăm', 'Chốt kỳ'].map((label, i) => (
            <li key={label} className={i === ph || (ph === 3 && i === 2) ? 'on' : i < ph ? 'past' : ''} aria-current={i === ph ? 'step' : undefined}>
              <b>{i + 1} ·</b> {label}
            </li>
          ))}
        </ol>
        <div className="clockRow">
          <span className="label" style={{ color: 'var(--mute)' }}>
            {run.settled ? `Kỳ ${k} đã chốt` : phase === 'commit' ? 'Còn thời gian nộp thăm' : phase === 'reveal' ? 'Còn thời gian mở thăm' : 'Chờ chốt kỳ'}
          </span>
          <span className={`clock${left < 60 && phase === 'commit' && !run.settled ? ' low' : ''}`} role="timer" aria-live="off">
            {run.settled ? '00:00' : !live && phase !== 'commit' ? '—' : clock(left)}
          </span>
        </div>
        <div className="slip">
          <label className="label" htmlFor="bid">
            Thăm của bạn (số tiền bớt cho mọi người)
          </label>
          <div className="bidIn">
            <input id="bid" inputMode="decimal" autoComplete="off" value={bidText} disabled={locked} onChange={(e) => setBidText(e.target.value)} aria-describedby="bidHint" aria-invalid={!!err && !locked} />
            <span>USDC</span>
          </div>
          <p className={`hint${err && !locked ? ' err' : ''}`} id="bidHint">
            {err && !locked ? err : `Trần kỳ này ${f(maxBid)} USDC · thăm cao nhất thắng, bằng nhau thì ít trễ hơn`}
          </p>
          {live && mine?.committed && !mine.saltOnDevice && (
            <p className="hint err" role="alert">
              Máy này không còn mã bí mật của thăm. Nạp file sao lưu ở Cài đặt, nếu không sẽ không mở thăm được và mất cọc.
            </p>
          )}
          {stampEl}
        </div>
        <div className="act">
          <button type="button" className="peek" aria-haspopup="dialog" onClick={() => setSheet(true)}>
            <span>
              Nếu bạn thắng, nhận ngay<small>Xem cách tính ▴</small>
            </span>
            <b>{f(q.payout)}</b>
          </button>
          <div className="actions">{primary}</div>
          <TxSteps t={t} />
          <TxNote t={t} ok="Đã xác nhận trên Fuji." />
        </div>
        <p className="hint">{note}</p>
      </div>
      <div className="panel lite side">
        {label}
        {estimate}
        <Who rows={others} />
      </div>
      <Sheet open={sheet} title={`Nếu bạn thắng kỳ ${k} với thăm ${err ? '—' : f(bid!)}`} onClose={closeSheet}>
        <div className="panel" style={{ padding: 0 }}>
          {estimate}
          <Who rows={others} />
        </div>
      </Sheet>
    </section>
  );
}

function FixedNow({ c, k }: { c: SampleCircleData; k: number }) {
  const live = c.live;
  const rv = live?.view.rounds.find((r) => r.k === k);
  const t = useStepTx();
  const taker = fixedTaker(c, k);
  const split = roundSplit(c.terms, k, 0n);
  const left = useSecondsLeft(live ? rv?.deadline : undefined, live?.nowMs, c.roundSecondsLeft ?? 0);
  const mine = c.shortfalls.find((s) => s.member === c.viewer && s.status === 'grace');
  const youTake = taker === c.viewer;
  return (
    <section className="stage">
      <div className="panel inkp">
        <ol className="phases" aria-label={`Các bước của kỳ ${k}`}>
          <li className={left > 0 ? 'on' : 'past'}>
            <b>1 ·</b> Góp
          </li>
          <li className={left === 0 ? 'on' : ''}>
            <b>2 ·</b> Chốt kỳ
          </li>
          <li>
            <b>3 ·</b> Nhận tiền
          </li>
        </ol>
        <div className="clockRow">
          <span className="label" style={{ color: 'var(--mute)' }}>
            Còn tới giờ chốt
          </span>
          <span className="clock">{clock(left)}</span>
        </div>
        <h2>{youTake ? 'Kỳ này bạn hốt.' : `${av(taker)} hốt kỳ này theo thứ tự vào dây.`}</h2>
        <dl className="rc">
          <div>
            <dt>Mỗi người góp</dt>
            <dd>{f(c.terms.c)} USDC</dd>
          </div>
          <div className="neg">
            <dt>Hoa hồng và quỹ dự phòng</dt>
            <dd>−{f(split.fee + split.premium)}</dd>
          </div>
          <div className="neg">
            <dt>Giữ lại</dt>
            <dd>−{f(split.holdback)}</dd>
          </div>
          <div className="big">
            <dt>{youTake ? 'Bạn nhận' : `${av(taker)} nhận`}</dt>
            <dd>{f(split.payout)}</dd>
          </div>
        </dl>
        <div className="act">
          <div className="actions">
            {mine ? (
              <Link className="btn lime" href={`/circles/${c.id}/thieu`}>
                Trả khoản thiếu {f(mine.amount)} USDC
              </Link>
            ) : live ? (
              <TxButton t={t} label={`Chốt kỳ ${k}`} retryLabel={`Gửi lại lệnh chốt kỳ ${k}`} onRun={(r) => void t.run((a) => a.settleRound(live.address), { forceOk: r })} disabled={left > 0} />
            ) : null}
          </div>
          <TxSteps t={t} />
          <TxNote t={t} ok="Đã chốt kỳ trên Fuji." />
        </div>
        <p className="hint">
          {mine
            ? `Bạn còn thiếu khoản góp kỳ ${mine.round}. Trả trong ân hạn thì không bị ghi vỡ nợ.`
            : left > 0
              ? 'Tiền góp được trích từ ví mọi người lúc chốt kỳ, trong cùng một giao dịch.'
              : 'Đã tới giờ chốt: ai cũng bấm được, không cần chờ chủ hụi.'}
        </p>
      </div>
      <div className="panel lite side">
        <h2>Thứ tự hốt</h2>
        <Who
          rows={c.seats.map((seat, i) => ({
            key: i,
            av: av(i),
            me: i === c.viewer,
            name: i === c.viewer ? 'Bạn' : seat.name,
            sub: `Hốt kỳ ${i + 1}`,
            right: <span className={`tag${i + 1 < k ? ' ok' : i + 1 === k ? ' lime' : ''}`}>{i + 1 < k ? 'Đã hốt' : i + 1 === k ? 'Kỳ này' : 'Sắp tới'}</span>,
          }))}
        />
      </div>
    </section>
  );
}

'use client';
/**
 * "Sổ hụi" (prototype `viewLedger`): round x member table on a computer; on a phone a dot grid (the whole circle at a
 * glance, tap a dot for the amount) or one round at a time, with the organizer's bond pinned at the bottom. The full
 * NĐ 19 book (header, members, every transaction, print, JSON) stays one tap away (`?ban=day-du`).
 */
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { formatUsdcNumber } from 'sdk';
import { CircleChips, ErrorState, EmptyState, Loading, Sheet, av } from '@/components/app/parts';
import { CircleScreen } from '@/components/circle/CircleScreen';
import { setDemoNet, useSampleLoad } from '@/lib/demo-store';
import { useCircleData } from '@/lib/live/useCircleData';
import { useCircleEvents } from '@/lib/live/useCircleEvents';
import { settleFromEvents } from '@/lib/live/settleEvents';
import { formatCents } from '@/lib/money';
import { GLYPH, KIND, ledgerOf, type Cell } from '@/lib/app-data';
import type { SampleCircleData } from '@/lib/sample-circles';

const f = (u: bigint): string => {
  const s = formatUsdcNumber(u);
  return s.includes(',') ? s : `${s},00`;
};
const whole = (u: bigint) => formatUsdcNumber(u);

export function Ledger({ id }: { id: string }) {
  const d = useCircleData(id);
  const sample = useSampleLoad(d.status === 'ready' && d.source === 'sample');
  if (d.status === 'loading' || sample.status === 'loading') return <LedgerSkeleton />;
  if (d.status === 'error' || sample.status === 'error') return <ErrorState onRetry={d.status === 'error' ? () => window.location.reload() : () => setDemoNet('ok')} />;
  if (d.status === 'missing' || sample.status === 'empty') return <EmptyState title="Sổ hụi còn trống." text="Sổ hụi hiện ra khi bạn vào một dây và dây bắt đầu." />;
  const c = d.data;
  if (c.state === 'forming') return <EmptyState label={c.label} title="Sổ hụi còn trống." text="Dây chưa bắt đầu. Đủ người và chủ hụi bấm bắt đầu thì mỗi kỳ có một dòng ở đây." />;
  return <LedgerBody c={c} refreshing={sample.refreshing} stale={sample.stale} />;
}

/** The full printable book (NĐ 19 Điều 12, 13): header, members, every transaction, print and JSON. */
export function FullBook({ id }: { id: string }) {
  return <CircleScreen id={id} screen="so-ho" />;
}

function LedgerSkeleton() {
  return (
    <main id="noi-dung" className="lg">
      <div className="lgHead">
        <div>
          <span className="label">Sổ hụi</span>
          <h1>Kỳ × thành viên</h1>
        </div>
      </div>
      <Loading>
        <div className="sk skTable" style={{ height: '60vh' }} />
        <div className="sk skLgP" />
      </Loading>
    </main>
  );
}

function LedgerBody({ c, refreshing, stale }: { c: SampleCircleData; refreshing: boolean; stale: boolean }) {
  const n = Number(c.terms.n);
  const { cells, bond, k } = ledgerOf(c);
  const [mode, setMode] = useState<'grid' | 'round'>('grid');
  const [round, setRound] = useState(Math.min(k, n));
  const [dir, setDir] = useState(0);
  const [cell, setCell] = useState<{ m: number; r: number } | null>(null);
  const closeCell = useCallback(() => setCell(null), []);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const state = (r: number) => (r < k ? 'done' : r === k ? 'now' : 'later');
  const name = (i: number) => (i === c.viewer ? `${av(i)} · Bạn` : av(i));
  const latest = [...bond].reverse().find((b) => b !== null) ?? c.bond;
  // Net per member once the circle is closed (same numbers as Tất toán): stops "HỐT 19,60" reading as a loss when the
  // holdback refund and the on-time reward come back at finalize.
  const closed = Boolean(c.live && c.state === 'completed' && !c.ended);
  const events = useCircleEvents(closed ? c.live!.address : undefined);
  const nets = useMemo(() => {
    if (!closed || !events.data) return undefined;
    const sorted = [...c.live!.view.members].sort((a, b) => a.joinIndex - b.joinIndex);
    return settleFromEvents(events.data, c.terms.c, sorted.map((m) => m.address)).members.map((m) => m.net);
  }, [closed, events.data, c.live, c.terms.c]);
  // Public claims are only what honest receivers were short-paid (`uncovered` still open). What a defaulter took from the
  // organizer's bond or the reserve is a debt to those, not a loss of any member: shown apart, per member.
  const claims = c.shortfalls.filter((x) => x.uncovered > 0n);
  const owedBack = new Map<number, bigint>();
  c.shortfalls
    .filter((x) => x.status === 'defaulted' && x.fromBond + x.fromReserve > 0n)
    .forEach((x) => owedBack.set(x.member, (owedBack.get(x.member) ?? 0n) + x.fromBond + x.fromReserve));
  const go = (r: number) => {
    const next = Math.min(Math.max(r, 1), n);
    if (next === round) return;
    setDir(Math.sign(next - round));
    setRound(next);
  };
  const tdCls = (x: Cell, r: number) => [x.kind === 'win' ? 'win' : x.kind === 'miss' && x.v !== '—' ? 'miss' : '', r === k ? 'cur' : ''].join(' ').trim() || undefined;
  const tdText = (x: Cell) => (x.kind === 'win' ? `HỐT ${x.v.slice(1)}` : x.kind === 'miss' && x.v !== '—' ? `thiếu ${x.v.slice(1)}` : x.kind === 'now' || x.kind === 'miss' ? 'đang chạy' : x.v);
  const flagged = (r: number) => c.shortfalls.some((x) => x.round === r);
  const prevBond = round > 1 ? bond[round - 2] : c.bond;
  const bondTxt = bond[round - 1] === null || bond[round - 1] === undefined ? 'chưa tới' : prevBond === bond[round - 1] ? `${whole(bond[round - 1]!)} USDC` : `${whole(prevBond ?? c.bond)} → ${whole(bond[round - 1]!)} USDC`;
  const sel = cell ? cells[cell.m]![cell.r - 1]! : null;

  return (
    <main id="noi-dung" className="lg in">
      <CircleChips c={c} refreshing={refreshing} stale={stale} />
      <div className="lgHead">
        <div>
          <span className="label">Sổ hụi · {c.label}</span>
          <h1>Kỳ × thành viên</h1>
        </div>
        <div className="lgTools">
          <span className="chip">{c.live ? 'Mỗi dòng có mã giao dịch trên Fuji' : 'Bản demo: dữ liệu mẫu'}</span>
          <Link className="btn ghost" href={`/circles/${c.id}/so-ho?ban=day-du`}>
            Sổ đầy đủ, in, tải JSON
          </Link>
        </div>
      </div>
      <div className="tableWrap" tabIndex={0} role="region" aria-label="Bảng sổ hụi, cuộn ngang được">
        <table>
          <caption className="label">Âm là tiền góp, HỐT là tiền nhận (USDC)</caption>
          <thead>
            <tr>
              <th scope="col">Thành viên</th>
              {Array.from({ length: n }, (_, j) => (
                <th key={j} scope="col">
                  Kỳ {j + 1}
                </th>
              ))}
              {nets && <th scope="col">Ròng</th>}
            </tr>
          </thead>
          <tbody>
            {c.seats.map((_, i) => (
              <tr key={i}>
                <th scope="row">{name(i)}</th>
                {cells[i]!.map((x, j) => (
                  <td key={j} className={tdCls(x, j + 1)}>
                    <span className="v">{tdText(x)}</span>
                    {x.kind !== 'later' && x.note !== 'góp đúng hạn' && <small>{x.note}</small>}
                  </td>
                ))}
                {nets && (
                  <td className="mono" data-testid="ledger-net">
                    <span className="v">{nets[i]! >= 0n ? `+${formatCents(nets[i]!)}` : `−${formatCents(-nets[i]!, 'up')}`}</span>
                    <small>gồm hoàn giữ lại, thưởng đúng hạn</small>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Ký quỹ còn</th>
              {bond.map((b, j) => (
                <td key={j} className="mono">
                  {b === null ? '—' : whole(b)}
                </td>
              ))}
              {nets && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="lgP">
        <div className="seg" role="group" aria-label="Cách xem sổ hụi">
          <button type="button" aria-pressed={mode === 'grid'} onClick={() => setMode('grid')}>
            Lưới
          </button>
          <button type="button" aria-pressed={mode === 'round'} onClick={() => setMode('round')}>
            Theo kỳ
          </button>
        </div>
        {mode === 'grid' ? (
          <>
            <div className="lgBody in">
              <div className="legend2">
                <span className="k-pay">
                  <i />
                  Góp
                </span>
                <span className="k-win">
                  <i>H</i>Hốt
                </span>
                <span className="k-miss">
                  <i>✕</i>Thiếu, đã bù
                </span>
                <span className="k-now">
                  <i>•</i>Đang chạy
                </span>
                <span className="k-later">
                  <i />
                  Chưa tới
                </span>
              </div>
              <div className="dots" role="group" aria-label="Lưới sổ hụi: chạm một ô để xem số tiền" style={{ ['--n' as string]: n }}>
                <span />
                {Array.from({ length: n }, (_, j) => (
                  <span key={j} className={`h${j + 1 === k ? ' cur' : ''}`}>
                    K{j + 1}
                  </span>
                ))}
                {c.seats.map((_, i) => [
                  <span key={`m${i}`} className="m">
                    {av(i)}
                    {i === c.viewer && <small>Bạn</small>}
                  </span>,
                  ...cells[i]!.map((x, j) => (
                    <button
                      key={`${i}-${j}`}
                      type="button"
                      className={`k-${x.kind}${j + 1 === k ? ' col' : ''}`}
                      aria-label={`${av(i)}${i === c.viewer ? ' (bạn)' : ''}, kỳ ${j + 1}: ${KIND[x.kind]}${x.v === '—' ? '' : ` ${x.v} USDC`}. ${x.note}`}
                      onClick={() => setCell({ m: i, r: j + 1 })}
                    >
                      <i aria-hidden>{GLYPH[x.kind]}</i>
                    </button>
                  )),
                ])}
              </div>
              <p className="hint">Chạm một ô để xem số tiền và nguồn bù.</p>
            </div>
            <div className="bondBar">
              <span>Ký quỹ chủ hụi còn</span>
              <b>
                {whole(latest)}/{whole(c.bond)} USDC
              </b>
            </div>
          </>
        ) : (
          <>
            <div className="storyNav">
              <button type="button" aria-label="Kỳ trước" disabled={round === 1} onClick={() => go(round - 1)}>
                ‹
              </button>
              <div className="snMid">
                <div className="bars" aria-label="Các kỳ" style={{ ['--n' as string]: n }}>
                  {Array.from({ length: n }, (_, j) => (
                    <button key={j} type="button" className={`${state(j + 1)}${flagged(j + 1) ? ' flagged' : ''}`} aria-current={round === j + 1} aria-label={`Kỳ ${j + 1}`} onClick={() => go(j + 1)}>
                      <i />
                    </button>
                  ))}
                </div>
                <strong>
                  Kỳ {round}/{n}
                </strong>
                <small>{{ done: 'đã chốt', now: 'đang chạy', later: 'chưa tới' }[state(round)]}</small>
              </div>
              <button type="button" aria-label="Kỳ sau" disabled={round === n} onClick={() => go(round + 1)}>
                ›
              </button>
            </div>
            <div
              key={round}
              className={`lgBody ${dir > 0 ? 'inL' : dir < 0 ? 'inR' : 'in'}`}
              onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
              onPointerUp={(e) => {
                const t = touch.current;
                touch.current = null;
                if (!t) return;
                const dx = e.clientX - t.x;
                if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(e.clientY - t.y)) go(round + (dx < 0 ? 1 : -1));
              }}
            >
              <ul className="lgList" aria-label={`Kỳ ${round}: mỗi thành viên một dòng`}>
                {c.seats.map((_, i) => {
                  const x = cells[i]![round - 1]!;
                  return (
                    <li key={i} className={x.kind === 'win' ? 'win' : x.kind === 'miss' && x.v !== '—' ? 'miss' : undefined}>
                      <span className={`av${i === c.viewer ? ' me' : ''}`} aria-hidden>
                        {av(i)}
                      </span>
                      <span>
                        <strong>{i === c.viewer ? 'Bạn' : x.kind === 'pay' ? 'Góp đúng hạn' : KIND[x.kind]}</strong>
                        <small>
                          {i === c.viewer ? `${KIND[x.kind]} · ` : ''}
                          {av(i)} · {x.note}
                        </small>
                      </span>
                      <b>{x.v}</b>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="bondBar">
              <span>Ký quỹ sau kỳ {round}</span>
              <b>{bondTxt}</b>
            </div>
          </>
        )}
      </div>

      <div className="lgFoot">
        {c.ended === 'cancelled' ? (
          <span data-testid="ledger-never-ran">Dây đã hủy vì không đủ người trước hạn, nên chưa có kỳ nào chạy và chưa ai góp tiền.</span>
        ) : c.state === 'forming' ? (
          <span data-testid="ledger-never-ran">Dây đang gom người, chưa bắt đầu kỳ nào.</span>
        ) : (
          <span>Bảo chứng lúc mở 100%: ký quỹ chịu được khi mọi người đã hốt cùng bỏ đóng một lúc.</span>
        )}
        {claims.length > 0 && (
          <span>
            Khoản đòi công khai (người hốt bị nhận thiếu): {claims.map((x) => `${av(x.member)} ${f(x.uncovered)} USDC`).join(', ')}.
          </span>
        )}
        {owedBack.size > 0 && (
          <span data-testid="ledger-owed-back">
            {[...owedBack].map(([m, v]) => `${av(m)} còn nợ ${f(v)} USDC đã được ký quỹ chủ hụi và quỹ dự phòng bù`).join('; ')}.{claims.length === 0 ? ' Không thành viên nào bị nhận thiếu.' : ''}
          </span>
        )}
      </div>

      <Sheet open={!!cell} title={cell ? `${cell.m === c.viewer ? `Bạn (${av(cell.m)})` : av(cell.m)} · Kỳ ${cell.r}` : 'Ô sổ hụi'} onClose={closeCell}>
        {sel && cell && (
          <div className="cellDetail">
            <span className={`tag ${{ pay: '', win: 'lime', miss: 'bad', now: 'ok', later: '' }[sel.kind]}`} style={{ justifySelf: 'start' }}>
              {KIND[sel.kind]}
            </span>
            <div className="val">
              {sel.v}
              {sel.v !== '—' && <span>USDC</span>}
            </div>
            <p className="hint">{sel.note}</p>
            <dl className="rc">
              <div>
                <dt>Ký quỹ chủ hụi sau kỳ {cell.r}</dt>
                <dd>{bond[cell.r - 1] === null ? '—' : whole(bond[cell.r - 1]!)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="btn ink"
              onClick={() => {
                setCell(null);
                setMode('round');
                setDir(0);
                setRound(cell.r);
              }}
            >
              Xem cả kỳ {cell.r} ›
            </button>
          </div>
        )}
      </Sheet>
    </main>
  );
}

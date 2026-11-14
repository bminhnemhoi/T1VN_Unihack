'use client';
/**
 * "Tổng quan" (prototype `viewOverview`): the one thing to do now (verdict), four numbers, every circle as a row with
 * its round strip, and what just happened in the most urgent circle. Sample data or the connected wallet's circles.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatUsdcNumber } from 'sdk';
import { ErrorState, EmptyState, HealthChips, Loading, PasteInvite, Sheet } from '@/components/app/parts';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { setDemoNet, useSampleLoad } from '@/lib/demo-store';
import { useCircleData, useMyCircles } from '@/lib/live/useCircleData';
import { feedOf } from '@/lib/app-data';
import { getSampleCircle } from '@/lib/sample-circles';
import type { SampleCircle } from '@/lib/sample';

const f = (u: bigint): string => {
  const s = formatUsdcNumber(u);
  return s.includes(',') ? s : `${s},00`;
};
const URGENCY: Record<string, number> = { active: 0, forming: 1, completed: 2 };

function useTicking(seconds: number): number {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  return left;
}

const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  if (h >= 48) return `${Math.floor(h / 24)} ngày`;
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

function tagOf(c: SampleCircle): { cls: string; text: string } {
  if (c.state === 'completed') return { cls: 'ok', text: 'Đã xong' };
  if (c.state === 'forming') return { cls: '', text: 'Đang gom' };
  if (c.todo.startsWith('Trả')) return { cls: 'bad', text: 'Còn thiếu' };
  if (c.todo.startsWith('Nộp thăm')) return { cls: 'lime', text: 'Cần bỏ thăm' };
  if (c.todo.startsWith('Mở thăm')) return { cls: 'lime', text: 'Cần mở thăm' };
  return { cls: '', text: 'Đang chạy' };
}

export function Overview() {
  const my = useMyCircles();
  const sample = useSampleLoad(my.status === 'ready' && my.source === 'sample');
  const { login } = useHuiWallet();
  const [paste, setPaste] = useState(false);
  if (my.status === 'loading' || sample.status === 'loading') return <OverviewSkeleton />;
  if (my.status === 'error' || sample.status === 'error') return <ErrorState onRetry={my.status === 'error' ? () => window.location.reload() : () => setDemoNet('ok')} />;
  if (my.status === 'login')
    return (
      <main id="noi-dung" className="state in">
        <div className="stateBox">
          <span className="label">Chưa đăng nhập</span>
          <h1>Đăng nhập để xem các dây của bạn.</h1>
          <p>Dây bạn làm chủ hụi hoặc đang tham gia hiện ở đây. Đăng nhập bằng email, không cần ví hay AVAX.</p>
          <div className="actions">
            <button type="button" className="btn lime" onClick={login}>
              Đăng nhập
            </button>
          </div>
        </div>
      </main>
    );
  const list = sample.status === 'empty' ? [] : [...my.circles].sort((a, b) => URGENCY[a.state]! - URGENCY[b.state]! || a.secondsLeft - b.secondsLeft);
  if (list.length === 0)
    return (
      <>
        <EmptyState title="Bạn chưa ở dây hụi nào." text="Tạo một dây cho nhóm của bạn, hoặc mở đường dẫn mời bạn bè gửi." onPaste={() => setPaste(true)} />
        <Sheet open={paste} title="Mở lời mời" onClose={() => setPaste(false)}>
          <PasteInvite />
        </Sheet>
      </>
    );
  return <Board list={list} my={my} refreshing={sample.refreshing} stale={sample.stale} />;
}

function OverviewSkeleton() {
  return (
    <main id="noi-dung" className="ov" style={{ display: 'block' }}>
      <Loading>
        <div className="ov" style={{ padding: 0 }}>
          <div className="sk skVerdict" />
          <div className="sk skStats" />
          <div className="sk skCircles" />
          <div className="sk skFeed skSide" />
        </div>
      </Loading>
    </main>
  );
}

function Board({ list, my, refreshing, stale }: { list: SampleCircle[]; my: Extract<ReturnType<typeof useMyCircles>, { status: 'ready' }>; refreshing: boolean; stale: boolean }) {
  const open = list.filter((c) => c.state !== 'completed');
  const first = open[0];
  const left = useTicking(first?.secondsLeft ?? 0);
  const running = list.filter((c) => c.state === 'active').length;
  const forming = list.filter((c) => c.state === 'forming').length;
  const sampleLate = my.source === 'sample' ? lateOfSample() : undefined;
  const late = my.late ?? sampleLate;
  const firstId = first?.href.replace('/circles/', '');
  return (
    <main id="noi-dung" className={`ov in${late ? ' withAlert' : ''}`}>
      <HealthChips refreshing={refreshing} stale={stale} />
      <h1 className="sr">Tổng quan</h1>
      <div className="verdict">
        {first ? (
          <div className="vtxt">
            <span className="label">{open.length} việc cần làm · gấp nhất</span>
            <p>
              {first.todo} <span>· {first.label}</span>
            </p>
            {first.secondsLeft > 0 && (
              <span className="clock">
                Còn <b>{clock(left)}</b>
              </span>
            )}
          </div>
        ) : (
          <div className="vtxt">
            <span className="label">Không có việc gì cần làm</span>
            <p>Mọi dây của bạn đã xong.</p>
          </div>
        )}
        <Link className="btn lime" href={first?.href ?? '/circles/new'}>
          {first ? first.action : 'Tạo dây mới'} ↗
        </Link>
      </div>
      {late && (
        <div className="alert" role="alert">
          <span>
            Bạn còn thiếu {f(late.shortfall.amount)} USDC kỳ {late.shortfall.round} ở {late.circle.label}. Trả trong ân hạn thì không bị ghi vỡ nợ.
          </span>
          <Link href={`/circles/${late.circle.id}/thieu`}>Trả ngay ›</Link>
        </div>
      )}
      <div className="stats">
        <div>
          <span className="label">Bạn đã góp</span>
          <b>
            {f(my.wallet.paidSoFar)}
            <i>USDC</i>
          </b>
          <small>đến nay</small>
        </div>
        <div>
          <span className="label">Mỗi kỳ đang góp</span>
          <b>
            {f(my.wallet.perRound)}
            <i>USDC</i>
          </b>
          <small>ở các dây đang chạy</small>
        </div>
        <div>
          <span className="label">Dây đang chơi</span>
          <b>{running + forming}</b>
          <small>
            {running} đang chạy, {forming} đang gom
          </small>
        </div>
        <div>
          <span className="label">Đã hốt</span>
          <b>{my.wallet.received}</b>
          <small>{my.wallet.waiting > 0 ? `còn được thăm ở ${my.wallet.waiting} dây` : 'dây'}</small>
        </div>
      </div>
      <ul className="circles" aria-label="Các dây của bạn">
        {list.map((c) => {
          const tag = tagOf(c);
          const done = c.state === 'completed' ? c.n : c.round;
          return (
            <li key={c.id}>
              <Link href={c.href}>
                <div>
                  <h3>{c.label}</h3>
                  <small>
                    {c.state === 'forming'
                      ? `Đang gom ${c.joined ?? 0}/${c.n} người · ${f(c.contribution)} USDC/kỳ`
                      : c.state === 'completed'
                        ? `Đã xong ${c.n} kỳ · ${c.role === 'organizer' ? 'bạn là chủ hụi' : 'sổ khớp'}`
                        : `Kỳ ${Math.min(c.round + 1, c.n)}/${c.n} · ${f(c.contribution)} USDC/kỳ${c.role === 'organizer' ? ' · bạn là chủ hụi' : ''}`}
                  </small>
                </div>
                <div className="strip" style={{ ['--n' as string]: c.n }} aria-hidden>
                  {Array.from({ length: c.n }, (_, i) => (
                    <i key={i} className={i < done ? 'd' : i === done && c.state === 'active' ? 'n' : ''} />
                  ))}
                </div>
                <span className={`tag ${tag.cls}`}>{tag.text}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/circles/new" className="add">
            <strong>+ Tạo dây mới</strong>
            <span className="mono">6 câu hỏi ›</span>
          </Link>
        </li>
      </ul>
      {firstId && <Feed id={firstId} label={first!.label} />}
    </main>
  );
}

/** Sample: the viewer's open shortfall sits in "Hụi cố định gia đình". */
function lateOfSample() {
  const c = getSampleCircle('co-dinh');
  const s = c.shortfalls.find((x) => x.member === c.viewer && x.status === 'grace');
  return s ? { circle: c, shortfall: s } : undefined;
}

function Feed({ id, label }: { id: string; label: string }) {
  const d = useCircleData(id);
  const items = d.status === 'ready' ? feedOf(d.data).slice(0, 12) : [];
  return (
    <section className="feed" aria-label={`Vừa xảy ra ở ${label}`}>
      <span className="label">Vừa xảy ra · {label}</span>
      {items.length === 0 ? (
        <p className="hint">{d.status === 'loading' ? 'Đang đọc…' : 'Chưa có kỳ nào được chốt.'}</p>
      ) : (
        <ol>
          {items.map((b, i) => (
            <li key={i}>
              <span className={`av${b.me ? ' me' : ''}`} aria-hidden>
                {b.av}
              </span>
              <span className="bub">
                <span>
                  <small>K{b.k}</small>
                  {b.text}
                </span>
                <b>{b.v}</b>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

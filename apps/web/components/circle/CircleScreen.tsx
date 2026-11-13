'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { ErrorState, Loading } from '@/components/app/parts';
import { PauseLockProvider, PausedBanner } from '@/components/chain/PauseLock';
import { BookView } from '@/components/circle/BookView';
import { CoverageView } from '@/components/circle/CoverageView';
import { DoneView, EndedView } from '@/components/circle/DoneView';
import { FormingView } from '@/components/circle/FormingView';
import { HoldbackView } from '@/components/circle/HoldbackView';
import { ResultView } from '@/components/circle/ResultView';
import { SettleView } from '@/components/circle/SettleView';
import { ShortfallView } from '@/components/circle/ShortfallView';
import { setDemoNet, useSampleLoad } from '@/lib/demo-store';
import { useCircleData } from '@/lib/live/useCircleData';
import type { SampleCircleData } from '@/lib/sample-circles';

export type Screen = 'overview' | 'ket-qua' | 'thieu' | 'bao-chung' | 'giu-lai' | 'so-ho' | 'tat-toan';

function Overview({ c }: { c: SampleCircleData }) {
  if (c.state === 'forming') return <FormingView c={c} />;
  if (c.live && (c.live.view.state === 'active' || c.live.view.state === 'paused') && c.settled === Number(c.terms.n)) return <SettleView c={c} />;
  if (c.live && (c.live.view.state === 'cancelled' || c.live.view.state === 'unwound')) return <EndedView c={c} />;
  // Running circles are the timeline room (components/app/CircleRoom); this covers what is left.
  return <DoneView c={c} />;
}

const SCREENS: Record<Screen, ComponentType<{ c: SampleCircleData }>> = {
  overview: Overview,
  'ket-qua': ResultView,
  thieu: ShortfallView,
  'bao-chung': CoverageView,
  'giu-lai': HoldbackView,
  'so-ho': BookView,
  'tat-toan': SettleView,
};

/** A circle id that matches nothing: say so and offer the way back (the "empty" state of a section page). */
export function Missing() {
  return (
    <main id="noi-dung" className="state in">
      <div className="stateBox" role="status">
        <span className="label">Không có dây</span>
        <h1>Không tìm thấy dây này</h1>
        <p>Đường dẫn có thể đã cũ hoặc gõ sai. Danh sách dây của bạn nằm ở Tổng quan.</p>
        <div className="actions">
          <Link className="btn ink" href="/circles">
            Về Tổng quan
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Skeleton the shape of a section page: head, a two-panel row, one wide panel. Shown after 180 ms, kept 300 ms. */
export function PageSkeleton() {
  return (
    <main id="noi-dung" className="pg" aria-busy="true">
      <Loading label="Đang đọc dây từ mạng…">
        <div className="pgSkel">
          <div className="sk h" />
          <div className="row">
            <div className="sk" />
            <div className="sk" />
          </div>
          <div className="sk wide" />
        </div>
      </Loading>
    </main>
  );
}

/**
 * One section page of one circle (B22f): loads the circle (sample or chain) and hands it to the screen, with the four
 * states of the room: skeleton while reading, error with retry, "not found", data. The sample follows the demo network
 * switch ("Thử: …") like the main screens; data already on screen stays when a refresh fails.
 */
export function CircleScreen({ id, screen }: { id: string; screen: Screen }) {
  const d = useCircleData(id);
  const sample = useSampleLoad(d.status === 'ready' && d.source === 'sample');
  if (d.status === 'missing') return <Missing />;
  if (d.status === 'loading' || (d.status === 'ready' && d.source === 'sample' && sample.status === 'loading')) return <PageSkeleton />;
  if (d.status === 'error') return <ErrorState text={d.message} onRetry={() => window.location.reload()} />;
  if (d.source === 'sample' && sample.status === 'error') return <ErrorState onRetry={() => setDemoNet('ok')} />;
  if (d.source === 'sample' && sample.status === 'empty') return <Missing />;
  const View = SCREENS[screen];
  const paused = d.data.paused === true;
  return (
    <PauseLockProvider value={paused}>
      {paused && <PausedBanner />}
      <View c={d.data} />
    </PauseLockProvider>
  );
}

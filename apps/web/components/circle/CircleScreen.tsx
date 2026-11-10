'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { PauseLockProvider, PausedBanner } from '@/components/chain/PauseLock';
import { BookView } from '@/components/circle/BookView';
import { CoverageView } from '@/components/circle/CoverageView';
import { DoneView, EndedView } from '@/components/circle/DoneView';
import { FixedRoomView } from '@/components/circle/FixedRoomView';
import { FormingView } from '@/components/circle/FormingView';
import { HoldbackView } from '@/components/circle/HoldbackView';
import { ResultView } from '@/components/circle/ResultView';
import { RoomView } from '@/components/circle/RoomView';
import { SettleView } from '@/components/circle/SettleView';
import { ShortfallView } from '@/components/circle/ShortfallView';
import { useCircleData } from '@/lib/live/useCircleData';
import type { SampleCircleData } from '@/lib/sample-circles';

export type Screen = 'overview' | 'ket-qua' | 'thieu' | 'bao-chung' | 'giu-lai' | 'so-ho' | 'tat-toan';

function Overview({ c }: { c: SampleCircleData }) {
  if (c.state === 'forming') return <FormingView c={c} />;
  if (c.live && (c.live.view.state === 'active' || c.live.view.state === 'paused') && c.settled === Number(c.terms.n)) return <SettleView c={c} />;
  if (c.live && (c.live.view.state === 'cancelled' || c.live.view.state === 'unwound')) return <EndedView c={c} />;
  if (c.state === 'completed') return <DoneView c={c} />;
  return c.terms.mode === 'fixed' ? <FixedRoomView c={c} /> : <RoomView c={c} />;
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

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <section className="o-phang p-6 md:p-8" role="status">
        <h1 className="font-display text-h2 font-bold">{title}</h1>
        {children && <div className="mt-2 max-w-prose text-lead text-muted-foreground">{children}</div>}
        <Link href="/circles" className="mt-4 inline-flex min-h-12 items-center font-semibold text-primary underline underline-offset-4">
          Về danh sách dây
        </Link>
      </section>
    </main>
  );
}

/** One page of one circle: loads the circle (sample or chain) and hands it to the screen. */
export function CircleScreen({ id, screen }: { id: string; screen: Screen }) {
  const d = useCircleData(id);
  if (d.status === 'loading') return <Notice title="Đang đọc dây từ mạng…" />;
  if (d.status === 'missing') return <Notice title="Không tìm thấy dây này" />;
  if (d.status === 'error') return <Notice title="Chưa đọc được dây">{d.message}</Notice>;
  const View = SCREENS[screen];
  const paused = d.data.paused === true;
  return (
    <PauseLockProvider value={paused}>
      {paused && <PausedBanner />}
      <View c={d.data} />
    </PauseLockProvider>
  );
}

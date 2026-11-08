'use client';

import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatUsdc, previewCircle } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { Seal } from '@/components/brand/Seal';
import { CircleCard } from '@/components/circle/CircleCard';
import { RoundStripLegend } from '@/components/circle/RoundStrip';
import { LedgerList } from '@/components/LedgerList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SAMPLE_CIRCLES, SAMPLE_WALLET, usdc } from '@/lib/sample';

// Round-3 ceiling of the demo circle (docs/03 section 8: 3,287671 USDC), shown rounded DOWN to cents so it never overstates the cap.
const CAP_K3 = previewCircle({ n: 5n, c: usdc(100), periodDays: 30n, alphaBps: 2000n, bond: usdc(480), capBps: 2000n }).bidRows[2]!.maxBid;
const CAP_K3_CENTS = CAP_K3 - (CAP_K3 % 10_000n);

const URGENCY: Record<string, number> = { active: 0, forming: 1, completed: 2 };

/**
 * S02 "Dây của tôi" as a working dashboard: the one thing to do now comes first (verdict), then what you hold,
 * then every circle as a ledger row. The switch at the bottom only exists so reviewers can see the empty state.
 */
export function MyCirclesView() {
  const [empty, setEmpty] = useState(false);
  const list = empty ? [] : [...SAMPLE_CIRCLES].sort((a, b) => URGENCY[a.state]! - URGENCY[b.state]! || a.secondsLeft - b.secondsLeft);
  const open = list.filter((c) => c.state !== 'completed');
  const [first, ...others] = open;
  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-h1 font-bold">Dây của tôi</h1>
        <Badge variant="secondary">Dữ liệu mẫu</Badge>
      </div>
      <p className="mt-2 text-lead text-muted-foreground" aria-live="polite">
        {list.length === 0 ? 'Bạn chưa tham gia dây nào.' : `Bạn có ${open.length} dây đang cần chú ý trên ${list.length} dây.`}
      </p>

      {list.length > 0 ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          {first && (
            <section aria-labelledby="viec-ngay" className="nen-muc rounded-xl p-6 md:p-8 lg:col-start-1">
              <h2 id="viec-ngay" className="font-display text-h1 font-bold">
                {first.todo}
              </h2>
              <p className="mt-3 text-lead text-[#dfe5f0]">
                Việc gấp nhất của bạn, ở dây {first.label}. Còn <Countdown seconds={first.secondsLeft} className="font-semibold text-white" /> để làm.
              </p>
              {first.id === 'a' && (
                <p className="so-ke mt-1 text-[#c9d2e0]">Trần thăm kỳ này khoảng {formatUsdc(CAP_K3_CENTS)}. Thăm cao nhất được hốt.</p>
              )}
              <Button asChild size="lg" className="mt-6 bg-action-ink text-muc-dem hover:bg-action-ink/90">
                <Link href={first.href}>{first.action}</Link>
              </Button>
              {others.length > 0 && (
                <ul className="mt-6 border-t border-[#c9d2e0]/30 pt-4">
                  {others.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span>
                        <span className="font-semibold">{c.label}:</span> {c.todo.toLowerCase()} (còn{' '}
                        <Countdown seconds={c.secondsLeft} />)
                      </span>
                      <Link href={c.href} className="inline-flex min-h-12 items-center font-semibold text-action-ink underline underline-offset-4">
                        {c.action}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section aria-labelledby="so-cua-ban" className="o-phang p-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <h2 id="so-cua-ban" className="font-display text-h3 font-bold">
              Sổ của bạn
            </h2>
            <LedgerList
              className="mt-2"
              items={[
                { label: 'Mỗi kỳ đang góp', value: formatUsdc(SAMPLE_WALLET.perRound) },
                { label: 'Đã hốt', value: formatUsdc(SAMPLE_WALLET.received) },
                { label: 'Đang được giữ lại', value: formatUsdc(SAMPLE_WALLET.heldBack) },
              ]}
            />
            <p className="mt-3 text-muted-foreground">Tiền giữ lại được trả dần cho bạn sau mỗi kỳ bạn đóng đủ và đúng hạn.</p>
          </section>

          <section aria-labelledby="cac-day" className="lg:col-start-1">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="cac-day" className="font-display text-h2 font-bold">
                Các dây của bạn
              </h2>
              <RoundStripLegend />
            </div>
            <ol className="to-giay mt-4">
              {list.map((c) => (
                <CircleCard key={c.id} c={c} />
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <div className="to-giay mt-8 flex flex-col items-center px-6 py-14 text-center">
          <div className="relative">
            <BookOpen aria-hidden className="size-24 text-primary/70" strokeWidth={1.25} />
            <Seal size={56} className="absolute -right-5 -bottom-3 rotate-12 text-le-do" />
          </div>
          <h2 className="mt-5 font-display text-h2 font-bold">Sổ hụi của bạn còn trống</h2>
          <p className="mt-2 max-w-md text-lead text-muted-foreground">Tạo dây đầu tiên, hoặc nhờ chủ hụi gửi đường dẫn mời để vào dây.</p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Button asChild size="lg">
          <Link href="/circles/new">Tạo dây mới</Link>
        </Button>
        <label htmlFor="xem-trong" className="flex min-h-12 cursor-pointer items-center gap-3 text-muted-foreground">
          <Switch id="xem-trong" checked={empty} onCheckedChange={setEmpty} />
          Xem thử trạng thái chưa có dây
        </label>
      </div>
    </main>
  );
}

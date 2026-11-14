'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useChain } from '@/lib/chain/provider';
import { DEMO_BUILD } from '@/components/shell/DemoBanner';
import { isDemoBuild } from '@/lib/demo-build';
import { cycleDemoNet, fastForward, NET_LABEL, useDemo } from '@/lib/demo-store';
import s from './DemoChip.module.css';

/** Sentence of the popover, fixed by the B23 brief. */
export const DEMO_NOTE =
  'Bản chạy thử trên Avalanche Fuji (mạng thử nghiệm). Tiền là USDC thử nghiệm, không có giá trị. Thời gian được tua nhanh: 1 kỳ = 3 phút, ân hạn 2 phút; trần lãi và lãi chậm góp vẫn tính như hụi tháng.';

/**
 * `DEMO · Fuji`: the one demo label of the site, next to the logo on the landing and in the app. It replaces the black
 * strip. A small popover (not modal) says what "demo" means; Esc or a click elsewhere closes it. Shown on every build
 * that is not mainnet (`isDemoBuild`). With sample data (`sample`) the popover also says nothing is read from the network
 * and carries the two demo tools (also in Cài đặt), so a reviewer need not leave the screen to fast-forward.
 */
export function DemoChip({ sample }: { sample: boolean }) {
  const chain = useChain();
  const { net } = useDemo();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  if (!isDemoBuild(chain?.chainId, DEMO_BUILD)) return null;
  return (
    <span className={s.wrap} ref={root}>
      <button type="button" className={s.chip} data-testid="demo-chip" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        DEMO · Fuji
      </button>
      {open && (
        <div id={id} className={s.pop} role="note" data-testid="demo-banner">
          <p>{DEMO_NOTE}</p>
          {sample && <p data-testid="sample-mode">Màn hình này dùng số liệu mẫu, chưa đọc từ mạng.</p>}
          {sample && (
            <div className={s.tools}>
              <button type="button" onClick={() => cycleDemoNet()} title="Mô phỏng tình trạng mạng và dữ liệu">
                Thử: {NET_LABEL[net]}
              </button>
              <button type="button" onClick={fastForward} title="Đưa kỳ đang chạy của dây mẫu sang giai đoạn tiếp theo">
                Tua nhanh ›
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

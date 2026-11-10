'use client';

import { formatUsdc } from 'sdk';
import { ActionButton } from '@/components/chain/ActionButton';
import { useClaimable } from '@/lib/live/useCircleEvents';
import type { SampleCircleData } from '@/lib/sample-circles';

/**
 * Money the circle could not push to the wallet (for example an address Circle blocks) waits in `claimable` until the
 * owner calls `claim()` (docs/03 section 6.7). Renders nothing for sample data or when nothing waits.
 */
export function ClaimBox({ c }: { c: SampleCircleData }) {
  const live = c.live;
  const q = useClaimable(live?.address, live?.viewerAddress);
  if (!live || !q.data || q.data === 0n) return null;
  return (
    <section aria-labelledby="cho-nhan" className="to-giay mt-8 p-6">
      <h2 id="cho-nhan" className="font-display text-h3 font-bold">
        Có tiền chờ bạn nhận
      </h2>
      <p className="so-ke mt-2 text-lead">
        Có <strong>{formatUsdc(q.data)}</strong> chờ bạn nhận. Lần chuyển tự động không tới được ví của bạn, nên tiền được giữ an toàn trong dây.
      </p>
      <ActionButton size="lg" allowWhenPaused className="mt-3" noticeClassName="text-foreground" run={(a) => a.claim(live.address)} success="Đã nhận tiền.">
        Nhận tiền
      </ActionButton>
    </section>
  );
}

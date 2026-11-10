'use client';
/**
 * While a circle is `Paused` the contract reverts everything except `claim()` (`CircleIsPaused`, docs/03 section 5.4).
 * `CircleScreen` provides the flag; `useTx` and `ActionButton` read it, so every transaction button is locked in one place
 * and `claim` opts out with `allowWhenPaused`.
 */
import { createContext, useContext } from 'react';

const Ctx = createContext(false);
export const PauseLockProvider = Ctx.Provider;
export const usePaused = (): boolean => useContext(Ctx);

export const PAUSED_REASON = 'Dây đang tạm dừng, chỉ nhận tiền chờ (claim) được. Các nút khác mở lại khi dây hết tạm dừng.';

export function PausedBanner() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <section role="status" className="o-phang border-2 border-nghe-fg p-4 md:p-5">
        <h2 className="font-display text-h3 font-bold">Dây đang tạm dừng</h2>
        <p className="mt-1 max-w-prose text-lead">
          Lúc này chỉ nhận tiền chờ (claim) được, mọi nút khác đang khóa. Thời gian dừng được cộng vào lịch của dây, nên không ai bị tính trễ vì dừng.
        </p>
      </section>
    </div>
  );
}

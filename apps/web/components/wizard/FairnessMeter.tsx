'use client';

import { memo, useMemo, useState } from 'react';
import { formatBps, formatUsdc } from 'sdk';
import { formatCents } from '@/lib/money';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fairness, type Terms } from '@/lib/hui-calc';
import { cn, TOGGLE_ON } from '@/lib/utils';

const ASSUME = [
  { value: '0', bps: 0n, label: 'Không ai bỏ thăm' },
  { value: '5000', bps: 5_000n, label: 'Thăm vừa (nửa trần)' },
  { value: '10000', bps: 10_000n, label: 'Ai cũng đặt trần' },
] as const;

/**
 * "Đồng hồ công bằng" (decided 09/11): for each seat, how much it gains or pays over the whole circle if everyone pays on time.
 * Bars grow left (pays) or right (gains) from a centre line, and every row is also written as words and a signed amount.
 */
export const FairnessMeter = memo(function FairnessMeter({ terms, bond }: { terms: Terms; bond: bigint }) {
  const bidding = terms.mode === 'bidding';
  const [assume, setAssume] = useState<string>('5000');
  const pick = bidding ? (ASSUME.find((a) => a.value === assume) ?? ASSUME[1]) : ASSUME[0];
  const f = useMemo(() => fairness(terms, bond, pick.bps), [terms, bond, pick]);
  const max = f.seats.reduce((a, s) => (s.net > a ? s.net : -s.net > a ? -s.net : a), 1n);
  const best = f.seats.reduce((a, s) => (s.net > a.net ? s : a));
  const worst = f.seats.reduce((a, s) => (s.net < a.net ? s : a));

  return (
    <section aria-labelledby="cong-bang-tieu-de">
      <h2 id="cong-bang-tieu-de" className="text-2xl font-bold">
        Đồng hồ công bằng
      </h2>
      <p className="mt-1 text-muted-foreground">
        Nếu mọi người góp đủ, đúng hạn, mỗi chỗ ngồi được hay trả thêm bao nhiêu sau cả dây. Chỉ là phép tính, không phải lời khuyên.
      </p>
      {bidding ? (
        <div className="mt-3">
          <p id="gia-dinh" className="text-muted-foreground">
            Giả định về thăm
          </p>
          <ToggleGroup type="single" variant="outline" value={assume} onValueChange={(v) => v && setAssume(v)} aria-labelledby="gia-dinh" className="mt-1 flex-wrap">
            {ASSUME.map((a) => (
              <ToggleGroupItem key={a.value} value={a.value} className={TOGGLE_ON}>
                {a.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : (
        <p className="mt-2 font-semibold">Dây cố định không có thăm nên mọi chỗ ngồi chịu như nhau: chỉ trả tiền công.</p>
      )}

      <ol className="mt-4 space-y-1">
        {f.seats.map((s) => {
          const pct = Number((s.net < 0n ? -s.net : s.net) * 100n / max);
          return (
            <li key={s.k} className="grid grid-cols-[4.5rem_1fr_8.5rem] items-center gap-2 sm:grid-cols-[5rem_1fr_10rem]">
              <span className="font-semibold">Kỳ {s.k}</span>
              <span aria-hidden className="grid h-5 grid-cols-2 gap-px">
                <span className="flex justify-end">
                  {s.net < 0n && <span className="h-full rounded-l-full bg-le-do" style={{ width: `${pct}%` }} />}
                </span>
                <span className="flex">
                  {s.net > 0n && <span className="h-full rounded-r-full bg-state-ok" style={{ width: `${pct}%` }} />}
                </span>
              </span>
              <span className={cn('so-ke text-right', s.net < 0n && 'text-state-bad', s.net > 0n && 'text-state-ok')}>
                {s.net > 0n ? 'được ' : s.net < 0n ? 'trả ' : ''}
                {formatCents(s.net < 0n ? -s.net : s.net, s.net < 0n ? 'up' : 'down')}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3">
        {f.spread === 0n
          ? 'Mọi chỗ ngồi chênh nhau 0: công bằng tuyệt đối về số tiền.'
          : `Chênh lệch giữa chỗ được nhiều nhất (kỳ ${best.k}) và chỗ trả nhiều nhất (kỳ ${worst.k}) là ${formatUsdc(f.spread)}.`}
      </p>

      <div className="o-phang mt-4 p-4">
        <h3 className="font-semibold">Chủ hụi</h3>
        <p className="so-ke mt-1">
          Tiền công cả dây {formatCents(f.totalFee)}, trên ký quỹ {formatUsdc(bond)} bị khóa
          {f.organizerReturnBpsPerYear !== undefined ? `: khoảng ${formatBps(f.organizerReturnBpsPerYear)} mỗi năm` : ''}.
        </p>
        <p className="text-muted-foreground">Chưa trừ phần ký quỹ phải dùng nếu có người bỏ đóng. Xem số đo trong phòng mô phỏng.</p>
      </div>

      {f.warnings.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Cảnh báo về cấu hình dây">
          {f.warnings.map((w) => (
            <li key={w} className="rounded-xl border border-nghe-fg bg-nghe-bg p-3 font-semibold text-nghe-fg">
              {w}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

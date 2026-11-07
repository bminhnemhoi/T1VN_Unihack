'use client';

import { memo, useMemo, useState } from 'react';
import { formatBps, formatUsdc, previewCircle } from 'sdk';
import { Seal } from '@/components/brand/Seal';
import { LedgerList } from '@/components/LedgerList';
import { BorderBeam } from '@/components/ui/border-beam';
import { NumberTicker } from '@/components/ui/number-ticker';

const C = 100_000_000n; // 100 USDC
const MAX_BOND = 480; // (1 - 20%) * O_max for N = 5, C = 100 (docs/03 section 8)

// Does not depend on the bond, so it is computed once and the list below never re-renders while dragging.
const STATIC = previewCircle({ n: 5n, c: C, periodDays: 30n, alphaBps: 2000n, bond: 0n, capBps: 2000n });
const STATIC_ITEMS = [
  { label: 'Rủi ro lớn nhất của dây', value: formatUsdc(STATIC.maxExposure) },
  { label: 'Tiền giữ lại của người hốt', value: '20%' },
  { label: 'Trần thăm kỳ 1', value: formatUsdc(STATIC.bidRows[0]!.maxBid) },
];
const StaticStats = memo(function StaticStats() {
  return <LedgerList className="mt-2" items={STATIC_ITEMS} />;
});

/** The hero toy: drag the bond, watch the coverage index move. Same maths as the contract (previewCircle). */
export function HeroMeter() {
  const [bond, setBond] = useState(MAX_BOND);
  const p = useMemo(
    () => previewCircle({ n: 5n, c: C, periodDays: 30n, alphaBps: 2000n, bond: BigInt(bond) * 1_000_000n, capBps: 2000n }),
    [bond],
  );
  const pct = Number(p.coverageBps) / 100;
  const ok = p.canActivate;
  return (
    <div className="to-giay to-giay-nang relative overflow-hidden p-6 text-foreground md:rotate-[1.4deg] md:p-7">
      <BorderBeam size={140} duration={9} colorFrom="#e8b04a" colorTo="#a91d1d" borderWidth={2} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl leading-tight font-bold">Dây mẫu</h2>
          <p className="text-muted-foreground">5 người, mỗi kỳ góp 100 USDC</p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground">Chỉ số bảo chứng</p>
          <p className="font-display flex items-baseline leading-none font-bold" aria-label={formatBps(p.coverageBps)}>
            <NumberTicker value={pct} decimalPlaces={Number.isInteger(pct) ? 0 : 1} className="text-[4.25rem] sm:text-[5.5rem]" />
            <span className="text-5xl">%</span>
          </p>
        </div>
        <div className="grid h-24 w-24 shrink-0 place-content-center">
          {ok && <Seal key="dau" size={84} center="Đủ" ring="ĐỦ BẢO CHỨNG · BẮT ĐẦU DÂY · " className="dau-xuong text-ngoc" />}
        </div>
      </div>

      <div
        role="meter"
        aria-label="Chỉ số bảo chứng của dây mẫu"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${formatBps(p.coverageBps)}, ${ok ? 'đủ để bắt đầu dây' : 'chưa đủ để bắt đầu dây'}`}
        className="relative mt-3 h-4 rounded-full bg-secondary shadow-[inset_0_0_0_1px_var(--input)]"
      >
        <div className={`h-full origin-left rounded-full transition-transform duration-200 ease-out ${ok ? 'bg-ngoc' : 'bg-nghe-fg'}`} style={{ transform: `scaleX(${pct / 100})` }} />
        <div aria-hidden className="absolute -top-1.5 -bottom-1.5 left-1/2 w-0.5 bg-foreground" />
      </div>
      <p aria-hidden className="relative mt-1 h-6 text-base text-muted-foreground">
        <span className="absolute left-1/2 -translate-x-1/2">50% tối thiểu</span>
      </p>
      <p className={`mt-1 font-semibold ${ok ? 'text-ngoc' : 'text-nghe-fg'}`}>
        {ok ? 'Đủ để bắt đầu dây.' : `Chưa đủ để bắt đầu dây. Cần thêm ${formatUsdc(p.bondMissing)} ký quỹ.`}
      </p>

      <div className="mt-4">
        <label htmlFor="hero-bond" className="flex items-baseline justify-between gap-3 font-semibold">
          <span>Ký quỹ của chủ hụi</span>
          <span className="so-ke font-display text-2xl">{bond} USDC</span>
        </label>
        <p aria-hidden className="font-hand text-2xl leading-none font-bold text-primary">thử kéo thanh này đi</p>
        <input
          id="hero-bond"
          type="range"
          min={0}
          max={MAX_BOND}
          step={10}
          value={bond}
          onChange={(e) => setBond(Number(e.target.value))}
          className="thanh-keo"
          style={{ ['--fill' as string]: `${(bond / MAX_BOND) * 100}%` }}
        />
      </div>

      <StaticStats />
      <p className="mt-2 text-base text-muted-foreground">Số liệu tính theo đặc tả, không phải dây thật.</p>
    </div>
  );
}

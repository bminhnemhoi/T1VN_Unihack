import { memo } from 'react';
import { formatBps, formatUsdc, MIN_COVERAGE_BPS, type Preview } from 'sdk';
import { Seal } from '@/components/brand/Seal';
import { LedgerList } from '@/components/LedgerList';
import { Button } from '@/components/ui/button';
import { NumberTicker } from '@/components/ui/number-ticker';
import { vi } from '@/lib/vi';

interface Props {
  /** Makes element ids unique when the panel is rendered twice (desktop column and mobile sheet). */
  idPrefix?: string;
  preview: Preview;
  bond: bigint;
  alphaBps: bigint;
  onFillBond: () => void;
}

/**
 * Live "Chỉ số bảo chứng" for the wizard: a big numeral that ticks, a ruler with the 50% line, and a red seal that
 * drops once the circle may start. State is always in words too, never colour alone.
 */
export const CoverageMeter = memo(function CoverageMeter({ idPrefix = 'cov', preview, bond, alphaBps, onFillBond }: Props) {
  const pct = Math.min(100, Number(preview.coverageBps) / 100);
  const minPct = Number(MIN_COVERAGE_BPS) / 100;
  const ok = preview.canActivate;
  return (
    <div>
      <h2 id={`${idPrefix}-title`} className="font-display text-2xl font-bold">
        Chỉ số bảo chứng
      </h2>
      <p className="text-muted-foreground">{vi.help.coverage}</p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="font-display flex items-baseline leading-none font-bold" aria-label={formatBps(preview.coverageBps)}>
          <NumberTicker value={pct} decimalPlaces={Number.isInteger(pct) ? 0 : 1} className="text-[3.75rem] sm:text-[4.5rem]" />
          <span className="text-4xl">%</span>
        </p>
        <div className="grid size-24 shrink-0 place-content-center">
          {ok && <Seal key="dau" size={84} center="Đủ" ring="ĐỦ BẢO CHỨNG · BẮT ĐẦU DÂY · " className="dau-xuong text-ngoc" />}
        </div>
      </div>

      <div
        role="meter"
        aria-labelledby={`${idPrefix}-title`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${formatBps(preview.coverageBps)}, ${ok ? 'đủ để bắt đầu dây' : 'chưa đủ để bắt đầu dây'}`}
        className="relative mt-4 h-4 rounded-full bg-secondary shadow-[inset_0_0_0_1px_var(--input)]"
      >
        <div className={`h-full origin-left rounded-full transition-transform duration-200 ease-out ${ok ? 'bg-ngoc' : 'bg-nghe-fg'}`} style={{ transform: `scaleX(${pct / 100})` }} />
        <div aria-hidden className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-foreground" style={{ left: `${minPct}%` }} />
      </div>
      <div aria-hidden className="so-ke relative mt-1 h-6 text-base text-muted-foreground">
        <span className="absolute left-0">0%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${minPct}%` }}>
          50% tối thiểu
        </span>
        <span className="absolute right-0">100%</span>
      </div>

      {ok ? (
        <p className="mt-2 font-semibold text-ngoc">Đủ bảo chứng để bắt đầu dây.</p>
      ) : (
        <p className="mt-2 font-semibold text-nghe-fg">
          Chưa đủ để bắt đầu dây (tối thiểu 50%). Cần thêm {formatUsdc(preview.bondMissing)} ký quỹ.
        </p>
      )}

      <LedgerList
        className="mt-3"
        items={[
          { label: 'Rủi ro lớn nhất của dây', value: formatUsdc(preview.maxExposure) },
          { label: 'Tiền giữ lại của người hốt', value: formatBps(alphaBps) },
          { label: 'Ký quỹ đang nhập', value: formatUsdc(bond) },
          { label: 'Ký quỹ để đạt 100%', value: formatUsdc(preview.bondFor100) },
        ]}
      />
      {preview.coverageBps < 10_000n && (
        <Button type="button" variant="outline" size="lg" className="mt-3 w-full" onClick={onFillBond}>
          Điền ký quỹ {formatUsdc(preview.bondFor100)}
        </Button>
      )}
    </div>
  );
});

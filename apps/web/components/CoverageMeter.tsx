import { formatBps, formatUsdc, MIN_COVERAGE_BPS, type Preview } from 'sdk';
import { LedgerList } from '@/components/LedgerList';
import { Button } from '@/components/ui/button';
import { vi } from '@/lib/vi';

interface Props {
  preview: Preview;
  bond: bigint;
  alphaBps: bigint;
  onFillBond: () => void;
}

/**
 * Live "Chỉ số bảo chứng". The one bold element of the screen: a big numeral, a ruler with the 50% line,
 * and a seal that stamps once the circle may start. State is always written in words, never colour only.
 */
export function CoverageMeter({ preview, bond, alphaBps, onFillBond }: Props) {
  const pct = Math.min(100, Number(preview.coverageBps) / 100);
  const minPct = Number(MIN_COVERAGE_BPS) / 100;
  const ok = preview.canActivate;
  return (
    <div>
      <h2 id="cov-title" className="text-2xl font-bold">
        Chỉ số bảo chứng
      </h2>
      <p className="text-muted-foreground">{vi.help.coverage}</p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="so-ke text-[3.5rem] leading-none font-bold" aria-live="polite" aria-atomic="true">
          {formatBps(preview.coverageBps)}
        </p>
        {ok && (
          // key restarts the stamp animation each time the state flips to "enough"
          <p key="dau" className="dau-do -rotate-[4deg] rounded-sm border-[3px] border-ngoc px-3 py-1 text-center text-lg leading-tight font-bold text-ngoc">
            Đủ để
            <br />
            bắt đầu dây
          </p>
        )}
      </div>

      <div
        role="meter"
        aria-labelledby="cov-title"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${formatBps(preview.coverageBps)}, ${ok ? 'đủ để bắt đầu dây' : 'chưa đủ để bắt đầu dây'}`}
        className="relative mt-4 h-5 rounded-sm bg-secondary"
      >
        <div className={`h-full rounded-sm transition-[width] duration-200 ${ok ? 'bg-ngoc' : 'bg-nghe-fg'}`} style={{ width: `${pct}%` }} />
        <div aria-hidden className="absolute -top-1 -bottom-1 w-0.5 bg-foreground" style={{ left: `${minPct}%` }} />
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
}

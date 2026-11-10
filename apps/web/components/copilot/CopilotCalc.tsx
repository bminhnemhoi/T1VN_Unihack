'use client';

import { useId, useState } from 'react';
import { formatBps, formatUsdc, parseUsdc, previewCircle } from 'sdk';
import { MAX_ALPHA_BPS } from '@/lib/circleForm';
import { useMinCoverageBps } from '@/lib/live/useMinCoverage';
import { LedgerList } from '@/components/LedgerList';
import { Input } from '@/components/ui/input';

/** Deterministic calculators that work without the AI (docs/07 section 8, AC-11.4): bond for coverage, and the bid ceiling table. */
export function CopilotCalc() {
  const id = useId();
  const floor = useMinCoverageBps();
  const [n, setN] = useState('5');
  const [c, setC] = useState('100');
  const [alpha, setAlpha] = useState('20');
  const nn = /^\d{1,2}$/.test(n.trim()) ? Number(n) : NaN;
  const cc = parseUsdc(c);
  const aa = /^\d{1,3}$/.test(alpha.trim()) ? Number(alpha) : NaN;
  const ok = nn >= 3 && nn <= 30 && cc !== undefined && cc >= 1_000_000n && cc <= 10_000_000_000n && aa >= 0 && aa * 100 <= Number(MAX_ALPHA_BPS);
  const p = ok ? previewCircle({ n: BigInt(nn), c: cc, periodDays: 30n, alphaBps: BigInt(aa * 100), bond: 0n, capBps: 2000n, minCoverageBps: floor }) : undefined;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Máy tính chạy ngay trên máy bạn, không cần trợ lý AI. Dùng đúng công thức của dây.</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'n', label: 'Số người', v: n, set: setN },
          { key: 'c', label: 'Mức góp (USDC)', v: c, set: setC },
          { key: 'a', label: 'Giữ lại (%)', v: alpha, set: setAlpha },
        ].map((f) => (
          <div key={f.key}>
            <label htmlFor={`${id}-${f.key}`} className="block font-semibold">
              {f.label}
            </label>
            <Input id={`${id}-${f.key}`} inputMode="decimal" autoComplete="off" value={f.v} onChange={(e) => f.set(e.target.value)} className="so-ke text-right text-lg" />
          </div>
        ))}
      </div>
      {!p ? (
        <p className="font-semibold text-destructive">Nhập số người 3 đến 30, mức góp 1 đến 10.000 USDC, giữ lại 0 đến 50%.</p>
      ) : (
        <>
          <LedgerList
            items={[
              { label: 'Rủi ro đỉnh', value: formatUsdc(p.maxExposure) },
              { label: 'Ký quỹ để bảo chứng 100%', value: formatUsdc(p.bondFor100) },
              { label: `Ký quỹ tối thiểu để bắt đầu (${formatBps(floor)})`, value: formatUsdc(p.bondForMin) },
              { label: 'Chỉ số khi chưa ký quỹ', value: formatBps(p.coverageBps) },
            ]}
          />
          <h3 className="font-semibold">Trần thăm từng kỳ (kỳ 30 ngày)</h3>
          <ul>
            {p.bidRows.map((r) => (
              <li key={r.k} className="dong-ke so-ke flex justify-between py-1.5 last:border-b-0">
                <span>Kỳ {r.k}</span>
                <span className="font-semibold">{formatUsdc(r.maxBid)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

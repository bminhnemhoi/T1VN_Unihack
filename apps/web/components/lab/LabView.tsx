'use client';

import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { LabData, LabDesign } from '@/lib/lab-data';
import { cn, TOGGLE_ON } from '@/lib/utils';

const NAME: Record<string, string> = { traditional: 'Hụi truyền thống', naive_onchain: 'Trên mạng, không bảo chứng', huisafe: 'HụiSafe' };
const PLAN: Record<string, string> = {
  peak_all_at_once: 'Người đã hốt cùng bỏ một lúc, ở kỳ rủi ro đỉnh',
  peak_sequential: 'Cũng nhóm đó, nhưng bỏ lần lượt từng kỳ',
  sequential_all: 'Mọi người đã hốt bỏ lần lượt',
};
const SCENARIO_LABEL: Record<string, string> = { baseline: 'Kịch bản gốc', baseline_calibrated: 'Kịch bản đã hiệu chỉnh' };

const pct = (v: number): string => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
const usdc = (v: number): string => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} USDC`;

interface Metric {
  title: string;
  hint: string;
  pick: (d: LabDesign) => number | null;
  show: (v: number) => string;
}
const METRICS: Metric[] = [
  { title: 'Người hốt sau mất bao nhiêu', hint: 'Phần trăm tiền hốt bị nhận thiếu, trung bình.', pick: (d) => d.lateReceiverExpectedLossPct, show: pct },
  { title: 'Tỷ lệ dây có người bị nhận thiếu', hint: 'Trên 10.000 dây mô phỏng.', pick: (d) => (d.circleFailureProb === null ? null : d.circleFailureProb * 100), show: pct },
  { title: 'Khoản chưa bù được, trung bình', hint: 'Tính trên mỗi dây.', pick: (d) => d.uncoveredMeanUsdc, show: usdc },
];

function Bars({ metric, rows }: { metric: Metric; rows: LabDesign[] }) {
  const vals = rows.map((r) => metric.pick(r));
  const max = Math.max(0.0001, ...vals.map((v) => v ?? 0));
  return (
    <figure className="o-phang p-5">
      <figcaption>
        <span className="font-display text-h3 font-bold">{metric.title}</span>
        <span className="block text-muted-foreground">{metric.hint}</span>
      </figcaption>
      <ul className="mt-3 space-y-3">
        {rows.map((r, i) => {
          const v = vals[i] ?? null;
          return (
            <li key={r.design}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={cn('font-semibold', r.design === 'huisafe' && 'text-primary')}>{NAME[r.design] ?? r.design}</span>
                <span className="so-ke font-semibold">{v === null ? 'không áp dụng' : metric.show(v)}</span>
              </div>
              <div aria-hidden className="mt-1 h-4 rounded-full bg-secondary">
                {v !== null && <div className={cn('h-full rounded-full', r.design === 'huisafe' ? 'bg-primary' : 'bg-muted-foreground')} style={{ width: `${Math.max(v > 0 ? 1.5 : 0, (v / max) * 100)}%` }} />}
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** S16: three designs side by side from the simulation outputs, with the assumptions stated right above the charts. */
export function LabView({ data }: { data: LabData }) {
  const [id, setId] = useState(data.runs[0]?.id ?? '');
  const run = data.runs.find((r) => r.id === id);

  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-h1 font-bold">Phòng mô phỏng</h1>
      <p className="mt-2 max-w-prose text-lead text-muted-foreground">So sánh ba cách tổ chức hụi trên cùng một bộ giả định. Đây là mô phỏng, không phải kết quả đo ngoài đời.</p>

      {!run ? (
        <section className="o-phang mt-8 p-6 md:p-8">
          <h2 className="font-display text-h2 font-bold">Chưa có kết quả</h2>
          <p className="mt-2 max-w-prose text-lead text-muted-foreground">Chưa có kết quả mô phỏng nào trong thư mục kết quả. Chạy mô phỏng rồi mở lại trang này.</p>
        </section>
      ) : (
        <>
          <section aria-labelledby="gia-dinh" className="nen-muc mt-8 rounded-xl p-6 md:p-8">
            <h2 id="gia-dinh" className="font-display text-h2 font-bold">
              Giả định của lần chạy này
            </h2>
            <ul className="so-ke mt-3 space-y-1 text-lead text-[#dfe5f0]">
              <li>
                {run.circles.toLocaleString('vi-VN')} dây, mỗi dây {run.n} người, mức góp {run.c} USDC, kỳ {run.periodDays} ngày. Hạt giống ngẫu nhiên {run.seed} (chỉ trong mô phỏng ngoại tuyến).
              </li>
              <li>
                Người đã hốt bỏ đóng mỗi kỳ: {pct(run.hazardEarly * 100)} ở các kỳ đầu, {pct(run.hazardLate * 100)} ở các kỳ sau. Người chưa hốt: {pct(run.hazardLive * 100)} mỗi kỳ.
              </li>
              <li>
                HụiSafe: giữ lại {run.alphaBps / 100}%, ký quỹ bằng {run.bondRatio.toLocaleString('vi-VN')} lần rủi ro đỉnh{run.bondRatio === 1 - run.alphaBps / 10_000 ? ' (đúng mức bảo chứng 100%)' : ''}.
              </li>
            </ul>
            <p className="mt-3 font-semibold text-white">Các tỷ lệ bỏ đóng là giả định lấy cảm hứng từ nghiên cứu Klonner &amp; Rai (2008), không phải số đo thật.</p>
          </section>

          {data.runs.length > 1 && (
            <div className="mt-6">
              <p id="chon-kb" className="text-muted-foreground">
                Chọn kịch bản
              </p>
              <ToggleGroup type="single" variant="outline" value={id} onValueChange={(v) => v && setId(v)} aria-labelledby="chon-kb" className="mt-1 flex-wrap">
                {data.runs.map((r) => (
                  <ToggleGroupItem key={r.id} value={r.id} className={TOGGLE_ON}>
                    {SCENARIO_LABEL[r.id] ?? r.id}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
            {METRICS.map((m) => (
              <Bars key={m.title} metric={m} rows={run.results} />
            ))}
          </div>
          <p className="mt-3 text-muted-foreground">
            Kết quả sinh lúc {run.generatedAt ? new Date(run.generatedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'chưa rõ'}. Con số HụiSafe thấp vì ký quỹ và tiền giữ lại bù trước; điều đó chỉ đúng trong các giả định ở trên.
          </p>
        </>
      )}

      {data.inv08 && (
        <section aria-labelledby="cu-soc" className="mt-12">
          <h2 id="cu-soc" className="font-display text-h2 font-bold">
            Cú sốc cùng lúc và bỏ đóng lần lượt
          </h2>
          <p className="mt-2 max-w-prose text-lead">
            Ký quỹ chịu được cú sốc lớn nhất (mọi người đã hốt cùng bỏ một lúc, rủi ro đỉnh {usdc(data.inv08.maxExposureUsdc)}). Nếu họ bỏ lần lượt qua nhiều kỳ, tổng khoản thiếu có thể tới {usdc(data.inv08.worstCaseSequentialShortfallUsdc)} và vượt ký quỹ.
          </p>
          <div className="o-phang mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Bảng cú sốc, kéo ngang để xem hết">
            <table className="w-full min-w-[40rem] text-base">
              <caption className="sr-only">Tỷ lệ dây còn khoản chưa bù được theo kiểu bỏ đóng</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="p-3 font-semibold">Kiểu bỏ đóng</th>
                  <th scope="col" className="p-3 text-right font-semibold">Tỷ lệ người hốt bỏ</th>
                  <th scope="col" className="p-3 font-semibold">Thiết kế</th>
                  <th scope="col" className="p-3 text-right font-semibold">Dây còn khoản chưa bù</th>
                  <th scope="col" className="p-3 text-right font-semibold">Khoản chưa bù trung bình</th>
                </tr>
              </thead>
              <tbody>
                {data.inv08.rows.map((r, i) => (
                  <tr key={i} className="dong-ke last:border-b-0">
                    <td className="p-3">{PLAN[r.plan] ?? r.plan}</td>
                    <td className="so-ke p-3 text-right">{pct(r.q * 100)}</td>
                    <td className="p-3">
                      {NAME[r.design] ?? r.design}
                      {r.design === 'huisafe' ? ` (ký quỹ ${r.bondRatio.toLocaleString('vi-VN')}×)` : ''}
                    </td>
                    <td className="so-ke p-3 text-right font-semibold">{pct(r.uncoveredShare * 100)}</td>
                    <td className="so-ke p-3 text-right">{usdc(r.uncoveredEndMeanUsdc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

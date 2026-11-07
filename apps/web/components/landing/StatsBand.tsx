import { previewCircle } from 'sdk';
import { NumberTicker } from '@/components/ui/number-ticker';

const p = previewCircle({ n: 5n, c: 100_000_000n, periodDays: 30n, alphaBps: 2000n, bond: 480_000_000n, capBps: 2000n });

/** Four numbers of the sample circle. Values come from `previewCircle`, the code the contract maths mirrors. */
export function StatsBand() {
  const stats = [
    { value: 0, unit: 'USDC', label: 'chủ hụi cầm giữa các kỳ' },
    { value: Number(p.coverageBps) / 100, unit: '%', label: 'chỉ số bảo chứng của dây mẫu' },
    { value: Number(p.maxExposure / 1_000_000n), unit: 'USDC', label: 'rủi ro lớn nhất của dây mẫu' },
    { value: 20, unit: '%/năm', label: 'trần lãi theo NĐ 19 Điều 21' },
  ];
  return (
    <section aria-label="Số liệu dây mẫu" className="nen-muc mt-16">
      <dl className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="vien-le-do">
            <dd className="font-display flex items-baseline gap-2 font-bold">
              <NumberTicker value={s.value} className="text-6xl text-nghe" />
              <span className="text-2xl">{s.unit}</span>
            </dd>
            <dt className="mt-1 text-lg text-[#dfe5f0]">{s.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

import { memo } from 'react';
import { formatUsdc } from 'sdk';
import { riskTable, type Terms } from '@/lib/hui-calc';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * "Bảng rủi ro tối đa" (decided 09/11): per seat, the most that seat can lose in two bad cases, from simulating the whole
 * circle with `huiMath` rules. Written as plain sentences first; the table is the detail. Never says "an toàn tuyệt đối".
 */
export const RiskTable = memo(function RiskTable({ terms, bond, highlight, className }: { terms: Terms; bond: bigint; highlight?: number; className?: string }) {
  const t = riskTable(terms, bond);
  const worst = t.rows.reduce((a, r) => (r.worst > a ? r.worst : a), 0n);
  return (
    <section aria-labelledby="rui-ro-tieu-de" className={className}>
      <h2 id="rui-ro-tieu-de" className="font-display text-h2 font-bold">
        Rủi ro tối đa theo chỗ ngồi
      </h2>
      <p className="mt-2 max-w-prose text-lead">
        Dây này chịu được <strong>{t.tolerated}</strong> người đã hốt cùng bỏ đóng một lúc mà mọi người trung thực vẫn nhận đủ tiền.
        {worst > 0n ? ` Trường hợp xấu nhất, một chỗ mất tối đa ${formatCents(worst, 'up')}.` : ' Trong cả hai trường hợp dưới đây không ai mất tiền.'}
      </p>
      {t.sequentialExceedsBond && (
        <p className="mt-1 max-w-prose text-muted-foreground">
          Nếu người đã hốt bỏ đóng lần lượt qua nhiều kỳ, tổng khoản thiếu có thể vượt ký quỹ, và người hốt cuối bị nhận thiếu. Khoản thiếu đó thành khoản đòi công khai, không biến mất.
        </p>
      )}
      <div className="o-phang mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Bảng số tiền tối đa mỗi chỗ có thể mất, kéo ngang để xem hết">
        <table className="w-full min-w-[34rem] text-base">
          <caption className="sr-only">Số tiền tối đa mỗi chỗ có thể mất, theo kỳ hốt</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-3 font-semibold">Hốt ở kỳ</th>
              <th scope="col" className="p-3 text-right font-semibold">Người hốt trước</th>
              <th scope="col" className="p-3 text-right font-semibold">Cùng bỏ một lúc</th>
              <th scope="col" className="p-3 text-right font-semibold">Bỏ lần lượt</th>
              <th scope="col" className="p-3 text-right font-semibold">Mất tối đa</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.k} className={cn('dong-ke last:border-b-0', highlight === r.k && 'bg-secondary')}>
                <th scope="row" className="p-3 text-left font-semibold">
                  Kỳ {r.k}
                  {highlight === r.k && <span className="ml-2 font-normal text-muted-foreground">(chỗ của bạn)</span>}
                </th>
                <td className="so-ke p-3 text-right">{r.before}</td>
                <td className="so-ke p-3 text-right">{formatCents(r.together, 'up')}</td>
                <td className="so-ke p-3 text-right">{formatCents(r.sequential, 'up')}</td>
                <td className={cn('so-ke p-3 text-right font-semibold', r.worst > 0n && 'text-state-bad')}>{formatCents(r.worst, 'up')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-base text-muted-foreground">
        Giả định xấu nhất: không ai bỏ thăm, người đã hốt ngừng đóng từ kỳ sau khi hốt, người hốt kỳ đó trung thực. Ký quỹ {formatUsdc(bond)}.
      </p>
    </section>
  );
});

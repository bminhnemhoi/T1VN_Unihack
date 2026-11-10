import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface SettleRow {
  id: string | number;
  name: string;
  round: number;
  paid: bigint;
  interestReceived: bigint;
  /** Pot received plus holdback paid back. */
  got: bigint;
  reward: bigint;
  net: bigint;
  me: boolean;
}

/** One row per member: paid in, interest received on bids, received, on-time reward, net. Shared by sample and chain settlement. */
export function SettleTable({ rows }: { rows: SettleRow[] }) {
  return (
    <div className="o-phang mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Bảng tất toán từng người, kéo ngang để xem hết">
      <table className="w-full min-w-[52rem] text-base">
        <caption className="sr-only">Tất toán của từng thành viên</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="p-3 font-semibold">Thành viên</th>
            <th scope="col" className="p-3 font-semibold">Hốt kỳ</th>
            <th scope="col" className="p-3 text-right font-semibold">Đã góp</th>
            <th scope="col" className="p-3 text-right font-semibold">Lãi thăm đã nhận</th>
            <th scope="col" className="p-3 text-right font-semibold">Đã nhận</th>
            <th scope="col" className="p-3 text-right font-semibold">Thưởng đúng hạn</th>
            <th scope="col" className="p-3 text-right font-semibold">Ròng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className={cn('dong-ke last:border-b-0', m.me && 'bg-secondary')}>
              <th scope="row" className="p-3 text-left font-semibold">{m.name}</th>
              <td className="so-ke p-3">{m.round > 0 ? m.round : '-'}</td>
              <td className="so-ke p-3 text-right">{formatCents(m.paid, 'up')}</td>
              <td className="so-ke p-3 text-right">{formatCents(m.interestReceived)}</td>
              <td className="so-ke p-3 text-right">{formatCents(m.got)}</td>
              <td className="so-ke p-3 text-right">{formatCents(m.reward)}</td>
              <td className={cn('so-ke p-3 text-right font-semibold', m.net < 0n && 'text-state-bad')}>{formatCents(m.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

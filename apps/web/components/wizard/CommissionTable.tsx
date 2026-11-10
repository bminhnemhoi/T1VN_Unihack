import { formatBps, formatUsdc } from 'sdk';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { commissionSchedule, type Terms } from '@/lib/hui-calc';

/**
 * "Trần thăm và hoa hồng từng kỳ" (AC-01.3, docs/03 section 2.7): phi turned into money for every round. The legal ceiling
 * comes from ND 19 Article 21; the ceiling the contract enforces is that minus the organizer's share; the commission is the
 * most the organizer can take in that round. Last round is 0 because nobody is left to pay interest.
 */
export function CommissionTable({ terms }: { terms: Terms }) {
  const rows = commissionSchedule(terms);
  const shared = (terms.shareBps ?? 0n) > 0n && terms.feeBps > 0n;
  const hasFee = terms.feeBps > 0n;
  const total = rows.reduce((a, r) => a + r.fee, 0n);
  return (
    <div>
      <h2 className="text-2xl font-bold">Trần thăm và hoa hồng từng kỳ</h2>
      <p className="text-muted-foreground">
        {shared
          ? `Luật cho phép người hốt trả một khoản lãi tối đa mỗi kỳ. Chủ hụi lấy ${formatBps(terms.shareBps!)} khoản đó làm hoa hồng (không quá ${formatBps(terms.feeBps)} tiền hốt), phần còn lại dành cho thăm.`
          : 'Thăm cao nhất được phép theo trần lãi 20%/năm.'}
      </p>
      <Table className="so-ke mt-2">
        <caption className="sr-only">Trần thăm theo luật, trần thăm thực thi và hoa hồng của từng kỳ, tính bằng USDC</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="text-base font-semibold text-foreground">Kỳ</TableHead>
            <TableHead scope="col" className="text-base font-semibold text-foreground">Người góp</TableHead>
            <TableHead scope="col" className="text-right text-base font-semibold text-foreground">{shared ? 'Trần thăm theo luật' : 'Trần thăm'}</TableHead>
            {shared && <TableHead scope="col" className="text-right text-base font-semibold text-foreground">Trần thăm thực thi</TableHead>}
            {hasFee && <TableHead scope="col" className="text-right text-base font-semibold text-foreground">Hoa hồng tối đa</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.k}>
              <TableCell className="font-semibold">{r.k}</TableCell>
              <TableCell>{r.payers}</TableCell>
              <TableCell className="text-right">{formatUsdc(r.statutoryCap)}</TableCell>
              {shared && <TableCell className="text-right">{formatUsdc(r.cap)}</TableCell>}
              {hasFee && <TableCell className="text-right">{formatUsdc(r.fee)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasFee && (
        <p className="so-ke mt-2">
          Hoa hồng cả dây tối đa <strong>{formatUsdc(total)}</strong>. Kỳ chủ hụi tự hốt không thu hoa hồng; kỳ cuối bằng 0.
        </p>
      )}
      <p className="mt-2 text-muted-foreground">
        {shared
          ? 'Thăm cộng hoa hồng của mỗi kỳ không bao giờ vượt trần lãi của Nghị định 19 Điều 21, dù hoa hồng được xem là khoản riêng hay tính gộp vào lãi (cách hiểu của HụiSafe, cần luật sư xác nhận).'
          : 'Trần lãi 20%/năm theo NĐ 19 Điều 21 (cách hiểu của HụiSafe, cần luật sư xác nhận).'}
      </p>
    </div>
  );
}

/** One line under the phi field: what the share means in money in the first round, so the percent is never abstract. */
export function CommissionNote({ terms }: { terms: Terms }) {
  const first = commissionSchedule(terms)[0];
  if (!first) return null;
  return (
    <p className="so-ke -mt-2 rounded-lg bg-secondary p-3" aria-live="polite">
      Kỳ 1: chủ hụi nhận tối đa <strong>{formatUsdc(first.fee)}</strong>, thăm tối đa <strong>{formatUsdc(first.cap)}</strong> (trần luật {formatUsdc(first.statutoryCap)}). Bảng đủ các kỳ ở bước xem lại.
    </p>
  );
}

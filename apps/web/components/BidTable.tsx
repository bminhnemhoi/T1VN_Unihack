import { formatUsdc, type BidRow } from 'sdk';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { vi } from '@/lib/vi';

/** "Trần thăm từng kỳ" (AC-01.3). */
export function BidTable({ rows }: { rows: BidRow[] }) {
  return (
    <div>
      <h2 className="text-2xl font-bold">Trần thăm từng kỳ</h2>
      <p className="text-muted-foreground">{vi.help.maxBid}</p>
      <Table className="so-ke mt-2">
        <caption className="sr-only">Trần thăm của từng kỳ, tính bằng USDC</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="text-base font-semibold text-foreground">Kỳ</TableHead>
            <TableHead scope="col" className="text-base font-semibold text-foreground">Người góp</TableHead>
            <TableHead scope="col" className="text-right text-base font-semibold text-foreground">Trần thăm</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.k}>
              <TableCell className="font-semibold">{r.k}</TableCell>
              <TableCell>{r.payers}</TableCell>
              <TableCell className="text-right">{formatUsdc(r.maxBid)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-2 text-muted-foreground">
        Trần lãi 20%/năm theo NĐ 19 Điều 21 (cách hiểu của HụiSafe, cần luật sư xác nhận).
      </p>
    </div>
  );
}

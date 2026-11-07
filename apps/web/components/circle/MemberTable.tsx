import { CircleCheck, Hourglass, Snowflake, TriangleAlert, type LucideIcon } from 'lucide-react';
import { formatUsdc } from 'sdk';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MemberStatus, SampleMember } from '@/lib/sample';

const STATUS: Record<MemberStatus, { label: string; icon: LucideIcon; cls: string }> = {
  live: { label: 'Hụi sống, chưa hốt', icon: Hourglass, cls: 'bg-secondary text-foreground' },
  dead: { label: 'Hụi chết, đã hốt', icon: CircleCheck, cls: 'bg-ngoc/10 text-ngoc' },
  frozen: { label: 'Đóng băng', icon: Snowflake, cls: 'bg-primary/10 text-primary' },
  defaultedDead: { label: 'Vỡ nợ sau khi hốt', icon: TriangleAlert, cls: 'bg-destructive/10 text-destructive' },
};

/** Member list. Status is a word plus an icon plus a tint, never a colour alone. */
export function MemberTable({ members }: { members: SampleMember[] }) {
  return (
    <div className="to-giay overflow-hidden p-2 md:p-4">
      <Table className="so-ke">
        <caption className="sr-only">Thành viên của dây, trạng thái và tiền đang giữ lại</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="text-base font-semibold text-foreground">Thành viên</TableHead>
            <TableHead scope="col" className="text-base font-semibold text-foreground">Trạng thái</TableHead>
            <TableHead scope="col" className="text-right text-base font-semibold text-foreground">Đang giữ lại</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const s = STATUS[m.status];
            const Icon = s.icon;
            return (
              <TableRow key={m.name}>
                <TableCell className="font-semibold whitespace-normal">
                  {m.name}
                  {m.receivedRound && <span className="block font-normal text-muted-foreground">Hốt kỳ {m.receivedRound}</span>}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${s.cls}`}>
                    <Icon aria-hidden className="size-4 shrink-0" />
                    {s.label}
                  </span>
                  {m.note && <span className="mt-1 block text-muted-foreground">{m.note}</span>}
                </TableCell>
                <TableCell className="text-right">{formatUsdc(m.holdback)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

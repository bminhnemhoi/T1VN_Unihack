import Link from 'next/link';
import { formatUsdc } from 'sdk';
import { RoundStrip } from '@/components/circle/RoundStrip';
import { LedgerList } from '@/components/LedgerList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSampleCircle, type CircleId } from '@/lib/sample-circles';

/** Overview of a finished circle: one verdict, two real links (settlement and book). */
export function DoneView({ id }: { id: CircleId }) {
  const c = getSampleCircle(id);
  const n = Number(c.terms.n);
  const myRound = c.winnerByRound.indexOf(c.viewer) + 1;
  return (
    <main id="noi-dung" className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/circles" className="inline-flex min-h-12 items-center font-semibold text-primary underline-offset-4 hover:underline">
        ← Dây của tôi
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold">{c.label}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Đã kết thúc</Badge>
            <Badge variant="outline">Bạn là thành viên {c.viewer + 1}</Badge>
            <Badge variant="secondary">Dữ liệu mẫu</Badge>
          </div>
        </div>
        <RoundStrip n={n} done={n} myRound={myRound} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
        <section aria-labelledby="xong" className="to-giay p-6 md:p-8">
          <h2 id="xong" className="font-display text-h1 font-bold">
            Dây đã kết thúc đủ {n} kỳ
          </h2>
          <p className="mt-3 text-lead text-muted-foreground">Mọi người đóng đủ, không có khoản thiếu nào cần bù (số liệu mẫu).</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={`/circles/${id}/tat-toan`}>Xem tất toán và nhận tiền</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/circles/${id}/so-ho`}>Xem sổ hụi</Link>
            </Button>
          </div>
        </section>
        <section aria-labelledby="tom-tat" className="o-phang p-6">
          <h3 id="tom-tat" className="font-display text-h3 font-bold">
            Tóm tắt
          </h3>
          <LedgerList
            className="mt-2"
            items={[
              { label: 'Mỗi kỳ góp', value: formatUsdc(c.terms.c) },
              { label: 'Số phần hụi', value: String(n) },
              { label: 'Bạn đã hốt', value: `kỳ ${myRound}` },
            ]}
          />
        </section>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { formatUsdc } from 'sdk';
import { ActionButton } from '@/components/chain/ActionButton';
import { RoundStrip } from '@/components/circle/RoundStrip';
import { LedgerList } from '@/components/LedgerList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type SampleCircleData } from '@/lib/sample-circles';

/** Overview of a finished circle: one verdict, two real links (settlement and book). */
export function DoneView({ c }: { c: SampleCircleData }) {
  const id = c.id;
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
            {c.viewer >= 0 ? <Badge variant="outline">Bạn là thành viên {c.viewer + 1}</Badge> : c.live && <Badge variant="outline">Bạn đang xem, chưa ở trong dây</Badge>}
            {!c.live && <Badge variant="secondary">Dữ liệu mẫu</Badge>}
          </div>
        </div>
        <RoundStrip n={n} done={n} myRound={myRound || undefined} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
        <section aria-labelledby="xong" className="to-giay p-6 md:p-8">
          <h2 id="xong" className="font-display text-h1 font-bold">
            Dây đã kết thúc đủ {n} kỳ
          </h2>
          <p className="mt-3 text-lead text-muted-foreground">
            {c.live ? (c.shortfalls.length === 0 ? 'Mọi người đóng đủ, không có khoản thiếu nào cần bù.' : 'Trong dây có khoản thiếu; xem sổ hụi để biết ai đã bù, ai đã trả.') : 'Mọi người đóng đủ, không có khoản thiếu nào cần bù (số liệu mẫu).'}
          </p>
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
              { label: 'Bạn đã hốt', value: myRound > 0 ? `kỳ ${myRound}` : c.viewer >= 0 ? 'Chưa hốt' : 'Bạn không ở trong dây' },
            ]}
          />
        </section>
      </div>
    </main>
  );
}

/** A circle that never started (cancelled after the join deadline) or was unwound by the admin after a 48 hour pause. */
export function EndedView({ c }: { c: SampleCircleData }) {
  const live = c.live!;
  const cancelled = live.view.state === 'cancelled';
  return (
    <main id="noi-dung" className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/circles" className="inline-flex min-h-12 items-center font-semibold text-primary underline-offset-4 hover:underline">
        ← Dây của tôi
      </Link>
      <h1 className="mt-2 font-display text-h1 font-bold">{c.label}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{cancelled ? 'Đã hủy' : 'Đã giải thể khẩn cấp'}</Badge>
      </div>
      <section aria-labelledby="het" className="to-giay mt-8 p-6 md:p-8">
        <h2 id="het" className="font-display text-h2 font-bold">
          {cancelled ? 'Dây không đủ người nên đã hủy' : 'Dây đã giải thể sau 48 giờ tạm dừng'}
        </h2>
        <p className="mt-3 text-lead text-muted-foreground">
          {cancelled
            ? 'Chưa có kỳ nào chạy, không ai bị trích tiền. Chủ hụi rút lại ký quỹ; thành viên nên thu hồi quyền trích tiền ở ví.'
            : 'Tiền đã trả theo sổ: ký quỹ về chủ hụi, tiền giữ lại về chủ của nó, quỹ dự phòng chia đều cho người không vỡ nợ.'}
        </p>
        {cancelled && c.viewerIsOrganizer && c.bondRemaining > 0n && (
          <ActionButton size="lg" className="mt-4" run={(a) => a.withdrawBond(live.address)} success="Đã rút ký quỹ về ví của bạn.">
            Rút ký quỹ {formatUsdc(c.bondRemaining)}
          </ActionButton>
        )}
        <div className="mt-4">
          <Button asChild size="lg" variant="outline">
            <Link href={`/circles/${c.id}/so-ho`}>Xem sổ hụi</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

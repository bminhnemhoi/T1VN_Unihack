import Link from 'next/link';
import { Seal } from '@/components/brand/Seal';
import { Button } from '@/components/ui/button';

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-4">
      <div className="to-giay to-giay-nang relative overflow-hidden p-8 md:p-12">
        <Seal size={120} className="absolute -top-4 right-4 hidden rotate-12 text-le-do opacity-90 sm:block" />
        <h2 className="max-w-xl font-display text-4xl leading-tight font-bold md:text-5xl">Thử ngay một dây với số của bạn.</h2>
        <p className="mt-3 max-w-prose text-xl text-muted-foreground">Nhập số người, mức góp, ký quỹ. Chỉ số bảo chứng hiện ngay khi bạn gõ.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/circles/new">Tạo dây thử</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/circles/demo">Xem phòng bỏ thăm mẫu</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Không tìm thấy trang' };

export default function NotFound() {
  return (
    <main id="noi-dung" className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="font-display text-7xl font-bold text-le-do">404</p>
      <h1 className="mt-4 font-display text-4xl font-bold">Không tìm thấy trang này</h1>
      <p className="mt-3 text-xl text-muted-foreground">Đường dẫn có thể đã gõ sai hoặc trang đã được dời đi.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">Về trang chủ</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/circles">Dây của tôi</Link>
        </Button>
      </div>
    </main>
  );
}

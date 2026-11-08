'use client';

import { Button } from '@/components/ui/button';

/** Last-resort boundary: a Vietnamese message and a way out, never a blank screen. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="noi-dung" className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-4xl font-bold">Có lỗi xảy ra</h1>
      <p className="mt-3 text-xl text-muted-foreground">Trang này gặp sự cố. Dữ liệu bạn đã nhập trên máy này vẫn được giữ.</p>
      <Button size="lg" className="mt-8" onClick={reset}>
        Thử lại
      </Button>
    </main>
  );
}

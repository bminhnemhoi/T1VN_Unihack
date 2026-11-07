'use client';

import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Seal } from '@/components/brand/Seal';
import { CircleCard } from '@/components/circle/CircleCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SAMPLE_CIRCLES } from '@/lib/sample';

/** S02 body. The switch lets a reviewer see the empty state without clearing anything. */
export function MyCirclesView() {
  const [empty, setEmpty] = useState(false);
  const list = empty ? [] : SAMPLE_CIRCLES;
  const todo = list.filter((c) => c.state !== 'completed').length;
  return (
    <main id="noi-dung" className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-bold md:text-5xl">Dây của tôi</h1>
        <Badge variant="secondary">Dữ liệu mẫu</Badge>
      </div>
      <p className="mt-2 text-xl text-muted-foreground" aria-live="polite">
        {list.length === 0 ? 'Bạn chưa tham gia dây nào.' : `Bạn có ${todo} dây đang cần chú ý trên ${list.length} dây.`}
      </p>

      <label htmlFor="xem-trong" className="mt-4 flex min-h-12 cursor-pointer items-center gap-3">
        <Switch id="xem-trong" checked={empty} onCheckedChange={setEmpty} />
        Xem thử trạng thái chưa có dây
      </label>

      {list.length > 0 ? (
        <ol className="mt-6 space-y-5">
          {list.map((c) => (
            <CircleCard key={c.id} c={c} />
          ))}
        </ol>
      ) : (
        <div className="to-giay mt-6 flex flex-col items-center px-6 py-14 text-center">
          <div className="relative">
            <BookOpen aria-hidden className="size-24 text-primary/70" strokeWidth={1.25} />
            <Seal size={56} className="absolute -right-5 -bottom-3 rotate-12 text-le-do" />
          </div>
          <h2 className="mt-5 font-display text-3xl font-bold">Sổ hụi của bạn còn trống</h2>
          <p className="mt-2 max-w-md text-xl text-muted-foreground">Tạo dây đầu tiên, hoặc nhờ chủ hụi gửi đường dẫn mời để vào dây.</p>
        </div>
      )}

      <Button asChild size="lg" className="mt-8">
        <Link href="/circles/new">Tạo dây mới</Link>
      </Button>
    </main>
  );
}

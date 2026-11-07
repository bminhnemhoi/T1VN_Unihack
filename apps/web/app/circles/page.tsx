import Link from 'next/link';
import { formatUsdc } from 'sdk';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SampleCircle {
  id: string;
  label: string;
  state: string;
  round: string;
  contribution: bigint;
  todo: string;
  countdown: string;
}

const SAMPLE: SampleCircle[] = [
  {
    id: 'a',
    label: 'Hụi tổ dân phố 7',
    state: 'Đang chạy',
    round: 'Kỳ 2 trên 5',
    contribution: 100_000_000n,
    todo: 'Nộp thăm kín trước 20:00 hôm nay',
    countdown: 'Còn 1 giờ 12 phút',
  },
  {
    id: 'b',
    label: 'Hụi bạn đại học',
    state: 'Đang gom người',
    round: 'Chưa bắt đầu',
    contribution: 10_000_000n,
    todo: 'Chờ đủ người rồi bắt đầu dây (đã có 3 trên 5)',
    countdown: 'Còn 6 ngày để vào dây',
  },
];

/** S02: my circles. Two fake circles, labelled as sample data. */
export default function MyCircles() {
  return (
    <main className="le-vo">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Dây của tôi</h1>
        <Badge variant="secondary">Dữ liệu mẫu</Badge>
      </div>
      <ol className="mt-6 max-w-3xl">
        {SAMPLE.map((c) => (
          <li key={c.id} className="dong-ke py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 className="text-xl font-bold">{c.label}</h2>
              <Badge variant="outline">{c.state}</Badge>
            </div>
            <p className="so-ke mt-1 text-muted-foreground">
              {c.round}, mỗi kỳ góp {formatUsdc(c.contribution)}
            </p>
            <p className="mt-2 font-semibold">Việc cần làm: {c.todo}</p>
            <p className="text-muted-foreground">{c.countdown}</p>
          </li>
        ))}
      </ol>
      <Button asChild size="lg" className="mt-6">
        <Link href="/circles/new">Tạo dây mới</Link>
      </Button>
    </main>
  );
}

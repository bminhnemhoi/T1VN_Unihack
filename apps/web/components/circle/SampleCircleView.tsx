'use client';

import { Copy } from 'lucide-react';
import Link from 'next/link';
import { formatUsdc, previewCircle } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { ProgressRing } from '@/components/brand/ProgressRing';
import { LedgerList } from '@/components/LedgerList';
import { SoonButton } from '@/components/shell/SoonButton';
import { useToast } from '@/components/shell/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usdc } from '@/lib/sample';

const FORMING = previewCircle({ n: 5n, c: usdc(10), periodDays: 30n, alphaBps: 2000n, bond: usdc(48), capBps: 2000n });

/**
 * The other two sample circles from "Dây của tôi": one still gathering people, one finished.
 * Each answers for itself instead of sending the user to the bid room of a different circle.
 */
export function SampleCircleView({ kind }: { kind: 'dang-gom' | 'da-xong' }) {
  const { show } = useToast();
  const forming = kind === 'dang-gom';

  const copyInvite = async () => {
    const url = `${window.location.origin}/circles/dang-gom`;
    try {
      await navigator.clipboard.writeText(url);
      show('Đã sao chép đường dẫn mời (bản mẫu). Gửi cho người bạn muốn mời vào dây.');
    } catch {
      show(`Máy không cho sao chép tự động. Hãy chép tay: ${url}`, 'error');
    }
  };

  return (
    <main id="noi-dung" className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/circles" className="inline-flex min-h-12 items-center font-semibold text-primary underline-offset-4 hover:underline">
        ← Dây của tôi
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-5">
        <ProgressRing value={forming ? 0 : 8} total={forming ? 5 : 8} size={104} label={forming ? 'Chưa bắt đầu' : 'Đã chi 8 trên 8 kỳ'}>
          <span className="so-ke font-display text-4xl leading-none font-bold">{forming ? 0 : 8}</span>
          <span className="text-base text-muted-foreground">/{forming ? 5 : 8} kỳ</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl leading-tight font-bold md:text-5xl">{forming ? 'Hụi bạn đại học' : 'Hụi chị em văn phòng'}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={forming ? 'secondary' : 'outline'}>{forming ? 'Đang gom người' : 'Đã kết thúc'}</Badge>
            <Badge variant="outline">{forming ? 'Bạn là chủ hụi' : 'Bạn là thành viên'}</Badge>
            <Badge variant="secondary">Dữ liệu mẫu</Badge>
          </div>
        </div>
      </div>

      {forming ? (
        <section aria-labelledby="gom" className="to-giay mt-8 p-6">
          <h2 id="gom" className="font-display text-3xl font-bold">Đang chờ đủ người: 3 trên 5</h2>
          <p className="mt-2 text-xl text-muted-foreground">
            Còn <Countdown seconds={6 * 86_400 + 3 * 3600} className="font-semibold text-foreground" /> để mời đủ người. Quá hạn mà chưa đủ thì dây tự hủy và bạn rút lại ký quỹ.
          </p>
          <LedgerList
            className="mt-4"
            items={[
              { label: 'Mỗi kỳ góp', value: formatUsdc(usdc(10)) },
              { label: 'Ký quỹ đã khóa', value: formatUsdc(usdc(48)) },
              { label: 'Chỉ số bảo chứng', value: `${Number(FORMING.coverageBps) / 100}%` },
            ]}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" size="lg" onClick={copyInvite}>
              <Copy aria-hidden className="size-5" /> Sao chép đường dẫn mời
            </Button>
            <SoonButton size="lg" variant="outline" message="Chưa bắt đầu được: dây mới có 3 trên 5 người. Cần đủ 5 người, rồi mới bấm bắt đầu.">
              Bắt đầu dây
            </SoonButton>
          </div>
        </section>
      ) : (
        <section aria-labelledby="xong" className="to-giay mt-8 p-6">
          <h2 id="xong" className="font-display text-3xl font-bold">Dây đã kết thúc đủ 8 kỳ</h2>
          <p className="mt-2 text-xl text-muted-foreground">Mọi người đóng đủ, không có khoản thiếu nào cần bù (số liệu mẫu).</p>
          <LedgerList
            className="mt-4"
            items={[
              { label: 'Mỗi kỳ góp', value: formatUsdc(usdc(50)) },
              { label: 'Số phần hụi', value: '8' },
              { label: 'Bạn đã hốt', value: 'kỳ 5' },
            ]}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <SoonButton size="lg" message="Sổ hụi dạng PDF sẽ dựng từ dữ liệu trên mạng, sắp có. Hiện là màn hình mẫu.">
              Xem sổ hụi
            </SoonButton>
            <SoonButton size="lg" variant="outline" message="Nhận lại phần còn lại cần nối ví, sắp có. Hiện là màn hình mẫu.">
              Nhận lại phần còn lại
            </SoonButton>
          </div>
        </section>
      )}
      <p className="mt-6 text-muted-foreground">Đây là màn hình mẫu. Muốn xem phòng bỏ thăm đang chạy, mở <Link href="/circles/demo" className="font-semibold text-primary underline underline-offset-4">dây Hụi tổ dân phố 7</Link>.</p>
    </main>
  );
}

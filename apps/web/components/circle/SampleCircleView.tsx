'use client';

import { Copy } from 'lucide-react';
import Link from 'next/link';
import { formatUsdc, previewCircle } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { RoundStrip } from '@/components/circle/RoundStrip';
import { LedgerList } from '@/components/LedgerList';
import { SoonButton } from '@/components/shell/SoonButton';
import { useToast } from '@/components/shell/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SAMPLE_CIRCLES, usdc } from '@/lib/sample';

const SEATS = ['Bạn (chủ hụi)', 'Thành viên 2', 'Thành viên 3'];
const DONE = SAMPLE_CIRCLES.find((c) => c.id === 'c')!;
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
    <main id="noi-dung" className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/circles" className="inline-flex min-h-12 items-center font-semibold text-primary underline-offset-4 hover:underline">
        ← Dây của tôi
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold">{forming ? 'Hụi bạn đại học' : 'Hụi chị em văn phòng'}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{forming ? 'Đang gom người' : 'Đã kết thúc'}</Badge>
            <Badge variant="outline">{forming ? 'Bạn là chủ hụi' : 'Bạn là thành viên'}</Badge>
            <Badge variant="secondary">Dữ liệu mẫu</Badge>
          </div>
        </div>
        {forming ? <RoundStrip n={5} done={0} /> : <RoundStrip n={8} done={8} myRound={DONE.myRound} />}
      </div>

      {forming ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
          <div className="space-y-6">
          <section aria-labelledby="gom" className="nen-muc rounded-xl p-6 md:p-8">
            <h2 id="gom" className="font-display text-h1 font-bold">
              Đang chờ đủ người: 3 trên 5
            </h2>
            <p className="mt-3 text-lead text-[#dfe5f0]">
              Còn <Countdown seconds={6 * 86_400 + 3 * 3600} className="font-semibold text-white" /> để mời đủ người. Quá hạn mà chưa đủ thì dây tự hủy và bạn rút lại ký quỹ.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" size="lg" onClick={copyInvite} className="bg-action-ink text-muc-dem hover:bg-action-ink/90">
                <Copy aria-hidden className="size-5" /> Sao chép đường dẫn mời
              </Button>
              <SoonButton
                size="lg"
                variant="outline"
                className="border-[#c9d2e0] bg-transparent text-white hover:bg-white/10 hover:text-white"
                message="Chưa bắt đầu được: dây mới có 3 trên 5 người. Cần đủ 5 người, rồi mới bấm bắt đầu."
              >
                Bắt đầu dây
              </SoonButton>
            </div>
          </section>
          <section aria-labelledby="bao-chung" className="o-phang p-6">
              <h3 id="bao-chung" className="font-display text-h3 font-bold">
                Bảo chứng đã sẵn sàng
              </h3>
              <LedgerList
                className="mt-2"
                items={[
                  { label: 'Mỗi kỳ góp', value: formatUsdc(usdc(10)) },
                  { label: 'Ký quỹ đã khóa', value: formatUsdc(usdc(48)) },
                  { label: 'Chỉ số bảo chứng', value: `${Number(FORMING.coverageBps) / 100}%` },
                ]}
              />
            </section>
          </div>
          <div>
            <section aria-labelledby="cho-ngoi" className="o-phang p-6">
              <h3 id="cho-ngoi" className="font-display text-h3 font-bold">
                Người đã vào dây
              </h3>
              <ol className="mt-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={i} className="dong-ke flex min-h-12 items-center justify-between gap-3 py-2 last:border-b-0">
                    <span className={i < SEATS.length ? 'font-semibold' : 'text-muted-foreground'}>{SEATS[i] ?? 'Chỗ trống'}</span>
                    <span className="text-muted-foreground">{i < SEATS.length ? `vào thứ ${i + 1}` : 'chờ người mời'}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
          <section aria-labelledby="xong" className="to-giay p-6 md:p-8">
            <h2 id="xong" className="font-display text-h1 font-bold">
              Dây đã kết thúc đủ 8 kỳ
            </h2>
            <p className="mt-3 text-lead text-muted-foreground">Mọi người đóng đủ, không có khoản thiếu nào cần bù (số liệu mẫu).</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <SoonButton size="lg" message="Sổ hụi dạng PDF sẽ dựng từ dữ liệu trên mạng, sắp có. Hiện là màn hình mẫu.">
                Xem sổ hụi
              </SoonButton>
              <SoonButton size="lg" variant="outline" message="Nhận lại phần còn lại cần nối ví, sắp có. Hiện là màn hình mẫu.">
                Nhận lại phần còn lại
              </SoonButton>
            </div>
          </section>
          <section aria-labelledby="tom-tat" className="o-phang p-6">
            <h3 id="tom-tat" className="font-display text-h3 font-bold">
              Tóm tắt
            </h3>
            <LedgerList
              className="mt-2"
              items={[
                { label: 'Mỗi kỳ góp', value: formatUsdc(usdc(50)) },
                { label: 'Số phần hụi', value: '8' },
                { label: 'Bạn đã hốt', value: `kỳ ${DONE.myRound}` },
              ]}
            />
          </section>
        </div>
      )}
      <p className="mt-8 text-muted-foreground">
        Đây là màn hình mẫu. Muốn xem phòng bỏ thăm đang chạy, mở{' '}
        <Link href="/circles/demo" className="font-semibold text-primary underline underline-offset-4">
          dây Hụi tổ dân phố 7
        </Link>
        .
      </p>
    </main>
  );
}

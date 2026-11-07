import Link from 'next/link';
import { formatBps, formatUsdc, previewCircle } from 'sdk';
import { LedgerList } from '@/components/LedgerList';
import { Button } from '@/components/ui/button';
import { vi } from '@/lib/vi';

const PROMISES = [
  { head: 'Tiền ở trong ví bạn', rest: 'cho đến hạn góp. Dây chỉ trích đúng phần góp của kỳ đó.' },
  { head: 'Chủ hụi khóa ký quỹ', rest: 'để bảo lãnh. Người hốt sau không phải gánh người bỏ đóng.' },
  { head: 'Ai cũng kiểm lại được', rest: 'mọi khoản thu chi trong sổ hụi công khai.' },
];

/** Worked example of docs/03 section 8, computed by the same maths the contract uses. */
const example = previewCircle({
  n: 5n,
  c: 100_000_000n,
  periodDays: 30n,
  alphaBps: 2000n,
  bond: 480_000_000n,
  capBps: 2000n,
});

/** S01: landing and login placeholder. */
export default function Home() {
  return (
    <main className="grid grid-cols-1 gap-10 md:grid-cols-[3fr_2fr] md:gap-14 [&>*]:min-w-0">
      <section>
        <h1 className="text-[clamp(2rem,6vw,3.5rem)] leading-[1.1] font-bold">{vi.tagline}</h1>
        <ul className="mt-8 max-w-prose">
          {PROMISES.map((p) => (
            <li key={p.head} className="dong-ke py-3">
              <strong>{p.head}</strong> {p.rest}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex max-w-md flex-col gap-2">
          <Button size="lg" disabled aria-describedby="dang-nhap-ghi-chu">
            Đăng nhập bằng Google hoặc email
          </Button>
          <p id="dang-nhap-ghi-chu" className="text-muted-foreground">
            Đăng nhập sẽ có sau. Không cần ví, không cần AVAX.
          </p>
          <Button asChild variant="outline" size="lg" className="mt-2">
            <Link href="/circles">Xem thử màn hình mẫu</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="vd-title" className="le-vo self-start">
        <h2 id="vd-title" className="text-2xl font-bold">
          Một dây mẫu
        </h2>
        <p className="text-muted-foreground">5 người, mỗi kỳ góp 100 USDC. Số liệu tính theo đặc tả, không phải dây thật.</p>
        <LedgerList
          className="mt-3"
          items={[
            { label: 'Rủi ro lớn nhất của dây', value: formatUsdc(example.maxExposure) },
            { label: 'Tiền giữ lại của người hốt', value: '20%' },
            { label: 'Ký quỹ chủ hụi khóa', value: formatUsdc(480_000_000n) },
            { label: 'Chỉ số bảo chứng', value: formatBps(example.coverageBps) },
            { label: 'Trần thăm kỳ 1', value: formatUsdc(example.bidRows[0]!.maxBid) },
          ]}
        />
        <p className="mt-3">
          <Link href="/circles/new" className="font-semibold text-primary underline underline-offset-4">
            Tự thử với số của bạn
          </Link>
        </p>
      </section>
    </main>
  );
}

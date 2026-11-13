import Link from 'next/link';
import { Seal } from '@/components/brand/Seal';
import { LoginActions } from '@/components/chain/LoginActions';

export const metadata = { title: 'Đăng nhập' };

/** The three promises a newcomer should read before signing in. Labels name what each sentence is about. */
const PROMISES = [
  ['Ký quỹ', 'Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh bằng ký quỹ.'],
  ['Ví của bạn', 'Tiền nằm trong ví của bạn đến lúc chi, không ai giữ hộ.'],
  ['Sổ hụi', 'Mọi lần tiền đi đều có sổ, ai cũng kiểm lại được.'],
] as const;

/**
 * S01: three promises, three ways in. Real Privy login when configured; otherwise every button says it is coming.
 * Motion (13/11, "tin tưởng"): the sign-in card is there at once; the seal stamps (400 ms, 120 ms in), then the three
 * promises rise 80 ms apart. CSS only, transform + opacity; the global reduced-motion rule shows everything at rest.
 */
export default async function Login({ searchParams }: { searchParams: Promise<{ tiep?: string }> }) {
  const { tiep } = await searchParams;
  const back = tiep && /^\/moi\/(dang-gom|0x[0-9a-fA-F]{40})$/.test(tiep) ? tiep : undefined;
  return (
    <main id="noi-dung" className="pg login md:grid-cols-[3fr_2fr] md:items-center">
      <div className="grid gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <Seal size={112} center="100%" ring="CHỦ HỤI KHÔNG CẦM TIỀN · BẢO CHỨNG · " className="dn-dau size-18 shrink-0 text-le-do sm:size-28" />
          <h1 className="dn-len font-display text-h1 font-bold">Đăng nhập để vào hụi</h1>
        </div>
        <ul className="dn-hua grid gap-2 sm:gap-3">
          {PROMISES.map(([label, text]) => (
            <li key={label} className="grid gap-1 border-t border-border pt-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-4">
              <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase sm:pt-1">{label}</span>
              <span className="leading-snug sm:text-lg">{text}</span>
            </li>
          ))}
        </ul>
        {back && (
          <p className="rounded-xl border border-border bg-card p-4">
            Bạn đang vào dây từ lời mời.{' '}
            <Link href={back} className="font-semibold text-primary underline underline-offset-4">
              Quay lại trang mời
            </Link>
            .
          </p>
        )}
      </div>

      <section aria-labelledby="chon" className="dn-the to-giay p-6 md:p-8">
        <h2 id="chon" className="font-display text-h2 font-bold">
          Chọn cách đăng nhập
        </h2>
        <LoginActions next={back} />
        <p className="mt-3 text-muted-foreground">
          Chưa đăng nhập vẫn xem được sổ hụi và các màn mẫu.{' '}
          <Link href="/circles" className="font-semibold text-primary underline underline-offset-4">
            Xem dây mẫu
          </Link>
          .
        </p>
      </section>
    </main>
  );
}

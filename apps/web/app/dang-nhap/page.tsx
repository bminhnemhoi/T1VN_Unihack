import Link from 'next/link';
import { Seal } from '@/components/brand/Seal';
import { LoginActions } from '@/components/chain/LoginActions';

export const metadata = { title: 'Đăng nhập' };

/** S01: three sentences, three ways in. Real Privy login when configured; otherwise every button says it is coming. */
export default async function Login({ searchParams }: { searchParams: Promise<{ tiep?: string }> }) {
  const { tiep } = await searchParams;
  const back = tiep && /^\/moi\/(dang-gom|0x[0-9a-fA-F]{40})$/.test(tiep) ? tiep : undefined;
  return (
    <main id="noi-dung" className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[3fr_2fr] md:items-start md:py-16">
      <div>
        <h1 className="font-display text-h1 font-bold">Đăng nhập để vào hụi</h1>
        <ul className="mt-6 space-y-3 text-lead">
          <li>Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh bằng ký quỹ.</li>
          <li>Tiền nằm trong ví của bạn đến lúc chi, không ai giữ hộ.</li>
          <li>Mọi lần tiền đi đều có sổ, ai cũng kiểm lại được.</li>
        </ul>
        {back && (
          <p className="mt-6 rounded-xl border border-border bg-card p-4">
            Bạn đang vào dây từ lời mời.{' '}
            <Link href={back} className="font-semibold text-primary underline underline-offset-4">
              Quay lại trang mời
            </Link>
            .
          </p>
        )}
      </div>

      <section aria-labelledby="chon" className="to-giay p-6 md:p-8">
        <div className="flex items-center gap-3">
          <Seal size={44} center="Hụi" ring="HỤISAFE · KHÔNG AI CẦM TIỀN · " className="-rotate-6 text-le-do" />
          <h2 id="chon" className="font-display text-h3 font-bold">
            Chọn cách đăng nhập
          </h2>
        </div>
        <LoginActions />
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

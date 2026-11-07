import Link from 'next/link';
import { Seal } from '@/components/brand/Seal';
import { NAV } from '@/components/shell/nav';
import { vi } from '@/lib/vi';

export function SiteFooter() {
  return (
    <footer className="nen-muc mt-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[2fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Seal size={56} className="-rotate-6 text-le-do-sang" />
            <p className="font-display text-3xl font-bold">{vi.appName}</p>
          </div>
          <p className="mt-4 max-w-prose font-display text-xl leading-snug">{vi.tagline}</p>
          <p className="mt-6 max-w-prose text-base text-[#c9d2e0]">
            Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý. Chạy trên Avalanche Fuji (mạng thử), dùng USDC thử nghiệm.
          </p>
        </div>
        <nav aria-label="Liên kết chân trang">
          <ul>
            {NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

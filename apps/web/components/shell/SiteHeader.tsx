'use client';

import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Seal } from '@/components/brand/Seal';
import { CopilotDrawer } from '@/components/copilot/CopilotDrawer';
import { NAV, isActive } from '@/components/shell/nav';
import { vi } from '@/lib/vi';
import { cn } from '@/lib/utils';

/** Sticky top bar: wordmark with the red seal, desktop links with a visible active state, the assistant and the login link. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label="HụiSafe, về trang chủ" className="flex min-h-14 items-center gap-2.5 text-foreground">
          <Seal size={40} center="Hụi" ring="HỤISAFE · KHÔNG AI CẦM TIỀN · " className="-rotate-6 text-le-do" />
          <span className="font-display text-2xl font-bold tracking-tight">{vi.appName}</span>
        </Link>
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
          {NAV.map((l) => {
            const on = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-12 items-center rounded-full px-4 font-semibold transition-colors duration-150',
                  on ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted',
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1.5">
          <CopilotDrawer />
          <Link
            href="/dang-nhap"
            aria-current={pathname === '/dang-nhap' ? 'page' : undefined}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-3 font-semibold text-foreground transition-colors duration-150 hover:bg-muted"
          >
            <LogIn aria-hidden className="size-5" />
            <span className="hidden sm:inline">Đăng nhập</span>
            <span className="sr-only sm:hidden">Đăng nhập</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

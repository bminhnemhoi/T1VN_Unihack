'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Seal } from '@/components/brand/Seal';
import { NAV, isActive } from '@/components/shell/nav';
import { vi } from '@/lib/vi';
import { cn } from '@/lib/utils';

/** Sticky top bar: wordmark with the red seal, desktop links with a visible active state. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-h-14 items-center gap-2.5 text-foreground">
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
      </div>
    </header>
  );
}

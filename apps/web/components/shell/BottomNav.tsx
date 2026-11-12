'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActive, navFor } from '@/components/shell/nav';
import { useChain } from '@/lib/chain/provider';
import { cn } from '@/lib/utils';

/** Mobile bottom navigation: icon + word for every item (never icon only), 64px tall. */
export function BottomNav() {
  const pathname = usePathname();
  const items = navFor(useChain() !== null);
  return (
    <>
      {/* Keeps the last content clear of the fixed bar (was pb-16 on <body>, which the landing page does not want). */}
      <div aria-hidden className="h-16 lg:hidden" />
      <nav aria-label="Điều hướng chính (điện thoại)" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className={items.length === 3 ? 'grid grid-cols-3' : 'grid grid-cols-4'}>
          {items.map((l) => {
            const on = isActive(pathname, l.href);
            const Icon = l.icon;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-center text-[0.75rem] leading-tight font-semibold transition-colors duration-150',
                    on ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {on && <span aria-hidden className="absolute top-0 left-1/2 -ml-[9px] h-[3px] w-[18px] rounded-b-full bg-foreground" />}
                  <Icon aria-hidden className="size-[22px]" strokeWidth={on ? 2.4 : 1.8} />
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

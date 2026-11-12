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
      <nav aria-label="Điều hướng chính (điện thoại)" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden">
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
                    'relative flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-[0.8rem] leading-tight font-semibold transition-colors duration-150',
                    on ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {on && <span aria-hidden className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-primary" />}
                  <Icon aria-hidden className="size-6" strokeWidth={on ? 2.5 : 2} />
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

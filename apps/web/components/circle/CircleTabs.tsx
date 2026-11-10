'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export const CIRCLE_TABS = [
  { slug: '', label: 'Tổng quan' },
  { slug: 'ket-qua', label: 'Kết quả kỳ' },
  { slug: 'thieu', label: 'Khoản thiếu' },
  { slug: 'bao-chung', label: 'Bảo chứng' },
  { slug: 'giu-lai', label: 'Tiền giữ lại' },
  { slug: 'so-ho', label: 'Sổ hụi' },
  { slug: 'tat-toan', label: 'Tất toán' },
] as const;

/** Sections of one circle (S07 to S12). Scrolls sideways inside its own box on phones; the page itself never scrolls sideways. */
export function CircleTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const strip = useRef<HTMLUListElement>(null);
  // On a phone the strip is wider than the screen: bring the current section into view so the highlighted tab is visible.
  useEffect(() => {
    const list = strip.current;
    const on = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !on) return;
    const box = on.getBoundingClientRect();
    const left = box.left - list.getBoundingClientRect().left + list.scrollLeft;
    list.scrollLeft = Math.max(0, left - (list.clientWidth - box.width) / 2);
  }, [pathname]);
  return (
    <nav aria-label="Các mục của dây" className="border-b border-border bg-card">
      <ul ref={strip} className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {CIRCLE_TABS.map((t) => {
          const href = `/circles/${id}${t.slug ? `/${t.slug}` : ''}`;
          const on = pathname === href;
          return (
            <li key={t.slug} className="shrink-0">
              <Link
                href={href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'relative inline-flex min-h-12 items-center px-3 font-semibold transition-colors duration-150',
                  on ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {on && <span aria-hidden className="absolute inset-x-3 bottom-0 h-1 rounded-t-full bg-primary" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

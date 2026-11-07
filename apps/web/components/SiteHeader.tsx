import Link from 'next/link';
import { vi } from '@/lib/vi';

const links = [
  { href: '/', label: vi.nav.home },
  { href: '/circles', label: vi.nav.myCircles },
  { href: '/circles/new', label: vi.nav.create },
];

/** Wordmark with a small red seal, plus three plain links. */
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
        <Link href="/" className="flex min-h-12 items-center gap-2 text-xl font-bold text-foreground">
          <span aria-hidden className="grid size-8 -rotate-3 place-content-center rounded-sm border-2 border-le-do text-sm font-bold text-le-do">
            Hụi
          </span>
          {vi.appName}
        </Link>
        <nav aria-label="Điều hướng chính" className="flex flex-wrap gap-x-5">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-12 items-center font-semibold text-primary underline-offset-4 hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

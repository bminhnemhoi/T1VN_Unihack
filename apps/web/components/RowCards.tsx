import { cn } from '@/lib/utils';

/** Below which screen width a wide table gives way to cards: a table wider than the screen hides its result columns off to the side. */
export type Below = 'md' | 'lg';
const HIDE_AT: Record<Below, string> = { md: 'md:hidden', lg: 'lg:hidden' };
const SHOW_AT: Record<Below, string> = { md: 'hidden md:block', lg: 'hidden lg:block' };

export interface CardRow {
  k: string;
  v: string;
  strong?: boolean;
  /** Red value, for a loss. The text must already say so in words. */
  bad?: boolean;
}
export interface CardItem {
  title: string;
  rows: CardRow[];
  /** The row of the person looking, shaded like the table row. */
  me?: boolean;
}

/** One table row as a card for narrow screens: a title and label/value pairs, in the same order as the table columns. */
export function RowCards({ label, items, below = 'md' }: { label: string; items: CardItem[]; below?: Below }) {
  return (
    <ul aria-label={label} className={cn('mt-4 space-y-3', HIDE_AT[below])}>
      {items.map((it, i) => (
        <li key={i} className={cn('o-phang p-4', it.me && 'bg-secondary')}>
          <h4 className="font-display text-h3 font-bold">{it.title}</h4>
          <dl className="mt-2">
            {it.rows.map((r) => (
              <div key={r.k} className="dong-ke flex items-baseline justify-between gap-3 py-1.5 last:border-b-0">
                <dt className="text-muted-foreground">{r.k}</dt>
                <dd className={cn('so-ke text-right', r.strong && 'font-semibold', r.bad && 'text-state-bad')}>{r.v}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** The table side of the pair: a labelled, keyboard-focusable scroll box, shown from `below` upward. */
export function WideTable({ label, below = 'md', children }: { label: string; below?: Below; children: React.ReactNode }) {
  return (
    <div className={cn('o-phang mt-4 overflow-x-auto', SHOW_AT[below])} tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}

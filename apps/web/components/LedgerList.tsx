import type { ReactNode } from 'react';

export interface LedgerItem {
  label: string;
  value: ReactNode;
}

/** Label / value rows ruled like a ledger page. Numbers align via tabular figures. */
export function LedgerList({ items, className = '' }: { items: LedgerItem[]; className?: string }) {
  return (
    <dl className={className}>
      {items.map((it) => (
        <div key={it.label} className="dong-ke flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-muted-foreground">{it.label}</dt>
          <dd className="so-ke text-right font-semibold">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

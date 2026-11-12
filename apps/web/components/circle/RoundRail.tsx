'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RailRound {
  k: number;
  state: 'done' | 'now' | 'later';
  /** One short line under the round: who took the pot, the phase, or the bid ceiling. */
  line: string;
  /** Second line in mono: an amount or a time. */
  sub?: string;
  /** Someone did not pay in this round (red mark, also said in words). */
  short?: boolean;
}

interface Props {
  rounds: RailRound[];
  selected: number;
  onSelect: (k: number) => void;
}

const SAID = { done: 'đã chốt', now: 'đang diễn ra', later: 'chưa tới' } as const;

/**
 * The round rail: the circle's navigation (DESIGN.md "dòng thời gian"). One button per kỳ on wide screens; on a phone
 * a story strip with ‹ › and "Kỳ k/n", so the rail never scrolls sideways. Selecting a kỳ changes only the stage below.
 */
export function RoundRail({ rounds, selected, onSelect }: Props) {
  const n = rounds.length;
  const cur = rounds.find((r) => r.k === selected) ?? rounds[0]!;
  return (
    <nav aria-label="Các kỳ của dây">
      <ol className="hidden gap-2 lg:grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {rounds.map((r) => {
          const on = r.k === selected;
          return (
            <li key={r.k} className="min-w-0">
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Kỳ ${r.k}, ${SAID[r.state]}${r.short ? ', có người thiếu' : ''}: ${r.line}${r.sub ? ` ${r.sub}` : ''}`}
                onClick={() => onSelect(r.k)}
                className={cn(
                  'relative grid min-h-[68px] w-full content-start gap-1 rounded-xl border px-3 py-2 text-left transition-colors duration-150',
                  r.state === 'done' && 'border-border bg-card',
                  r.state === 'now' && 'border-foreground bg-action',
                  r.state === 'later' && 'border-dashed border-border bg-transparent text-muted-foreground',
                  on && 'shadow-[0_0_0_2px_var(--foreground)]',
                )}
              >
                <span className="flex items-center justify-between font-mono text-[0.7rem] tracking-[0.06em] uppercase">
                  Kỳ {r.k}
                  {r.short && <span aria-hidden className="size-2 rounded-full bg-le-do" />}
                  {r.state === 'now' && <span aria-hidden className="size-2 rounded-full bg-foreground" />}
                </span>
                <span className="truncate text-[0.95rem] leading-tight font-bold">{r.line}</span>
                {r.sub && <span className="truncate font-mono text-[0.75rem]">{r.sub}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-2 lg:hidden">
        <div aria-hidden className="grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {rounds.map((r) => (
            <span
              key={r.k}
              className={cn(
                'h-1 rounded-full',
                r.k === selected ? 'bg-foreground' : r.short ? 'bg-le-do' : r.state === 'done' ? 'bg-foreground/45' : r.state === 'now' ? 'bg-action shadow-[inset_0_0_0_1px_var(--foreground)]' : 'bg-border',
              )}
            />
          ))}
        </div>
        <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2">
          <button
            type="button"
            aria-label="Kỳ trước"
            disabled={selected <= 1}
            onClick={() => onSelect(selected - 1)}
            className="grid size-12 place-content-center rounded-full border border-border bg-card disabled:opacity-35"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <p className="min-w-0 text-center" aria-live="polite">
            <span className="block text-[1.05rem] font-bold">
              Kỳ {cur.k}/{n}
            </span>
            <span className="block truncate font-mono text-[0.72rem] text-muted-foreground">
              {cur.line}
              {cur.sub ? ` · ${cur.sub}` : ''}
            </span>
          </p>
          <button
            type="button"
            aria-label="Kỳ sau"
            disabled={selected >= n}
            onClick={() => onSelect(selected + 1)}
            className="grid size-12 place-content-center rounded-full border border-border bg-card disabled:opacity-35"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}

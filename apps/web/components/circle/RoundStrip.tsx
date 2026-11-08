import { cn } from '@/lib/utils';

interface Props {
  /** Number of rounds (= members). */
  n: number;
  /** Rounds already paid out. */
  done: number;
  /** True when round done + 1 is running now. */
  running?: boolean;
  /** Round the viewer received the pot in. */
  myRound?: number;
  /** Winner of each settled round, index 0 = kỳ 1. */
  winners?: string[];
  className?: string;
}

/**
 * One line of the "sổ hụi": a cell per round, the way a paper ledger has a column per kỳ.
 * Each cell says its state in words for screen readers; sighted users get number + fill + the "bạn" mark,
 * never colour alone. This is the dashboard's signature element, shared with the bid room's full ledger.
 */
export function RoundStrip({ n, done, running, myRound, winners, className }: Props) {
  const cells = Array.from({ length: n }, (_, i) => {
    const k = i + 1;
    const state = k <= done ? 'done' : k === done + 1 && running ? 'now' : 'later';
    const who = winners?.[i];
    const said =
      state === 'done'
        ? `Kỳ ${k}: đã chi${k === myRound ? ', bạn hốt' : who ? `, ${who} hốt` : ''}`
        : state === 'now'
          ? `Kỳ ${k}: đang diễn ra`
          : `Kỳ ${k}: chưa tới`;
    return { k, state, mine: k === myRound, said };
  });
  return (
    <ol className={cn('flex flex-wrap gap-1.5', className)} aria-label={`Các kỳ của dây: đã chi ${done} trên ${n}`}>
      {cells.map((c) => (
        <li
          key={c.k}
          className={cn(
            'so-ke relative grid size-9 place-content-center rounded-md text-base font-semibold',
            c.state === 'done' && 'bg-foreground text-background',
            c.state === 'now' && 'bg-card text-foreground shadow-[inset_0_0_0_2.5px_var(--foreground)]',
            c.state === 'later' && 'bg-card text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--border)]',
            c.mine && 'bg-le-do text-white',
          )}
        >
          <span aria-hidden>{c.k}</span>
          <span className="sr-only">{c.said}</span>
        </li>
      ))}
    </ol>
  );
}

/** Words for the cells above, shown once per list so the strip never relies on colour. */
export function RoundStripLegend({ className }: { className?: string }) {
  const sw = 'inline-block size-4 rounded-[4px] align-[-2px]';
  return (
    <p aria-hidden className={cn('flex flex-wrap gap-x-5 gap-y-1 text-base text-muted-foreground', className)}>
      <span><span className={cn(sw, 'bg-foreground')} /> đã chi</span>
      <span><span className={cn(sw, 'bg-le-do')} /> kỳ bạn hốt</span>
      <span><span className={cn(sw, 'bg-card shadow-[inset_0_0_0_2.5px_var(--foreground)]')} /> đang diễn ra</span>
      <span><span className={cn(sw, 'bg-card shadow-[inset_0_0_0_1.5px_var(--border)]')} /> chưa tới</span>
    </p>
  );
}

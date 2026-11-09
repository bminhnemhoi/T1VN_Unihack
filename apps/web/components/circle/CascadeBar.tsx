import { formatUsdc } from 'sdk';

export interface Cascade {
  holdback: bigint;
  bond: bigint;
  reserve: bigint;
  uncovered: bigint;
}

const PARTS = [
  { id: 'holdback', label: 'Tiền giữ lại', color: 'bg-primary' },
  { id: 'bond', label: 'Ký quỹ chủ hụi', color: 'bg-nghe-fg' },
  { id: 'reserve', label: 'Quỹ dự phòng', color: 'bg-state-ok' },
  { id: 'uncovered', label: 'Chưa bù được', color: 'bg-le-do' },
] as const;

/** One shortfall as a bar in cascade order (holdback, bond, reserve, uncovered). Every part is also written out with its amount. */
export function CascadeBar({ title, parts }: { title: string; parts: Cascade }) {
  const total = parts.holdback + parts.bond + parts.reserve + parts.uncovered;
  return (
    <figure>
      <figcaption className="mb-2 font-semibold">{title}</figcaption>
      <div aria-hidden className="flex h-7 overflow-hidden rounded-full bg-secondary shadow-[inset_0_0_0_1px_var(--input)]">
        {total > 0n &&
          PARTS.filter((p) => parts[p.id] > 0n).map((p) => (
            <div key={p.id} className={p.color} style={{ width: `${(Number(parts[p.id]) / Number(total)) * 100}%` }} />
          ))}
      </div>
      <ol className="mt-2 grid gap-x-6 sm:grid-cols-2">
        {PARTS.map((p, i) => (
          <li key={p.id} className="so-ke flex items-center justify-between gap-3 py-1">
            <span className="flex items-center gap-2">
              <span aria-hidden className={`size-3.5 rounded-sm ${p.color}`} />
              {i + 1}. {p.label}
            </span>
            <span className={parts[p.id] > 0n ? 'font-semibold' : 'text-muted-foreground'}>{formatUsdc(parts[p.id])}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  total: number;
  size?: number;
  label: string;
  className?: string;
  children?: ReactNode;
}

/** Ring showing `value` of `total` rounds. The text label is the accessible name; the ring itself is decoration. */
export function ProgressRing({ value, total, size = 88, label, className, children }: Props) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <div role="img" aria-label={label} className={cn('relative grid shrink-0 place-content-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ngoc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div aria-hidden="true" className="absolute inset-0 grid place-content-center text-center">
        {children}
      </div>
    </div>
  );
}

import type { SampleCircle } from '@/lib/sample';

type Splittable = Pick<SampleCircle, 'state' | 'role' | 'bondLeft'>;

/** Circles with nothing left to run. A cancelled circle is closed too, but it is NOT "done". */
export const isClosed = (c: Pick<SampleCircle, 'state'>): boolean => c.state === 'completed' || c.state === 'cancelled' || c.state === 'unwound';

/**
 * The Overview's two groups: `top` is what still needs the viewer (running, gathering, or a closed circle whose organizer
 * still has a bond to withdraw); `ended` is everything finished, shown folded under "Đã kết thúc". Order is kept.
 */
export function splitEnded<T extends Splittable>(list: readonly T[]): { top: T[]; ended: T[] } {
  const top: T[] = [];
  const ended: T[] = [];
  for (const c of list) (!isClosed(c) || (c.bondLeft && c.role === 'organizer') ? top : ended).push(c);
  return { top, ended };
}

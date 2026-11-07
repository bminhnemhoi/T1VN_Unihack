import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Phase = 'commit' | 'reveal' | 'settle';
const STEPS: { id: Phase; title: string; text: string }[] = [
  { id: 'commit', title: 'Nộp thăm kín', text: 'Mỗi người niêm phong thăm của mình.' },
  { id: 'reveal', title: 'Mở thăm', text: 'Thăm được mở, so sánh theo luật cố định.' },
  { id: 'settle', title: 'Chốt kỳ', text: 'Trích phần góp và trả người hốt trong một giao dịch.' },
];

/** Round timeline: done steps carry a tick, the current one is highlighted and announced, later ones are muted. */
export function RoundTimeline({ phase }: { phase: Phase }) {
  const idx = STEPS.findIndex((s) => s.id === phase);
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const on = i === idx;
        return (
          <li key={s.id} aria-current={on ? 'step' : undefined} className={cn('rounded-xl border-2 p-4 transition-colors duration-200', on ? 'border-foreground bg-card shadow-md' : 'border-border bg-card/60', !on && !done && 'text-muted-foreground')}>
            <div className="flex items-center gap-2.5">
              <span className={cn('font-display grid size-9 shrink-0 place-content-center rounded-full border-2 text-lg font-bold', done && 'border-ngoc bg-ngoc text-white', on && 'border-foreground bg-nghe text-muc-dem', !done && !on && 'border-input')}>
                {done ? <Check aria-hidden className="size-5" strokeWidth={3} /> : i + 1}
              </span>
              <h3 className="font-display text-xl font-bold">{s.title}</h3>
              <span className="sr-only">{done ? '(đã xong)' : on ? '(đang diễn ra)' : '(chưa tới)'}</span>
            </div>
            <p className="mt-1">{s.text}</p>
          </li>
        );
      })}
    </ol>
  );
}

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Step indicator. Current step is announced with aria-current="step"; done steps carry a tick, not just colour. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label={`Bước ${current + 1} trên ${steps.length}`} className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={label} aria-current={on ? 'step' : undefined} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={cn(
                'font-display grid size-11 shrink-0 place-content-center rounded-full border-2 text-xl font-bold transition-colors duration-200',
                done && 'border-ngoc bg-ngoc text-white',
                on && 'border-foreground bg-nghe text-muc-dem',
                !done && !on && 'border-input text-muted-foreground',
              )}
            >
              {done ? <Check aria-hidden className="size-5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('hidden font-semibold sm:inline', on ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
            {i < steps.length - 1 && <span aria-hidden className={cn('h-0.5 flex-1', done ? 'bg-ngoc' : 'bg-border')} />}
          </li>
        );
      })}
    </ol>
  );
}

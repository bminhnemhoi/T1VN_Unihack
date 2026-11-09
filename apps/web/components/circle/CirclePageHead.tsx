import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { SampleCircleData } from '@/lib/sample-circles';

const STATE = { forming: 'Đang gom người', active: 'Đang chạy', completed: 'Đã kết thúc' } as const;

/** Title block shared by the section pages of one circle: what this page is, which circle, and that the data is a sample. */
export function CirclePageHead({ circle, title, children }: { circle: SampleCircleData; title: string; children?: ReactNode }) {
  return (
    <header>
      <h1 className="font-display text-h1 font-bold">{title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{circle.label}</Badge>
        <Badge variant="secondary">{STATE[circle.state]}</Badge>
        <Badge variant="secondary">{circle.terms.mode === 'fixed' ? 'Cố định' : 'Bỏ thăm'}</Badge>
        <Badge variant="secondary">Dữ liệu mẫu</Badge>
      </div>
      {children && <div className="mt-3 max-w-prose text-lead text-muted-foreground">{children}</div>}
    </header>
  );
}

/** Shown when a section has nothing to show yet for this circle. Says why and where to go. */
export function EmptyNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="o-phang mt-8 p-6 md:p-8">
      <h2 className="font-display text-h2 font-bold">{title}</h2>
      <div className="mt-2 max-w-prose text-lead text-muted-foreground">{children}</div>
    </section>
  );
}

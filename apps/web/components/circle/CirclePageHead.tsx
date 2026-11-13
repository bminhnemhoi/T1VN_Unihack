import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { SampleCircleData } from '@/lib/sample-circles';

const STATE = { forming: 'Đang gom người', active: 'Đang chạy', completed: 'Đã kết thúc' } as const;

/**
 * Title block of a circle's section page (B22f): the title, the circle's facts as mono tags, one short intro. Same head
 * rhythm as the room (`.ctxHead`): 26 px title, 8 px to the tags, intro capped at 72 characters a line.
 */
export function CirclePageHead({ circle, title, children }: { circle: SampleCircleData; title: string; children?: ReactNode }) {
  return (
    <header className="pgHead">
      <h1>{title}</h1>
      <div className="pgTags">
        <Badge variant="outline">{circle.label}</Badge>
        <Badge variant="secondary">{STATE[circle.state]}</Badge>
        <Badge variant="secondary">{circle.terms.mode === 'fixed' ? 'Cố định' : 'Bỏ thăm'}</Badge>
        {!circle.live && <Badge variant="secondary">Dữ liệu mẫu</Badge>}
      </div>
      {children && <div className="pgIntro">{children}</div>}
    </header>
  );
}

/** Shown when a section has nothing to show yet for this circle. Says why and where to go. */
export function EmptyNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="o-phang">
      <span className="label">Chưa có gì</span>
      <h2 style={{ marginTop: 8 }}>{title}</h2>
      <div className="pgIntro" style={{ marginTop: 8 }}>
        {children}
      </div>
    </section>
  );
}

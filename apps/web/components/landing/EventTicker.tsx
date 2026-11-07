import { Marquee } from '@/components/ui/marquee';

/** Sample ledger lines, numbers from docs/03 section 8 (kỳ 1 and 2). Marked as sample data. */
const EVENTS = [
  { dot: 'bg-ngoc', text: 'Kỳ 1: Thành viên 4 hốt 288,48 USDC' },
  { dot: 'bg-primary', text: 'Quỹ dự phòng +3,76 USDC' },
  { dot: 'bg-ngoc', text: 'Kỳ 2: Thành viên 1 hốt 323,18 USDC' },
  { dot: 'bg-le-do', text: 'Thành viên 4 thiếu 100 USDC: bù 80 từ tiền giữ lại, 20 từ ký quỹ' },
  { dot: 'bg-primary', text: 'Ký quỹ còn 460 USDC' },
  { dot: 'bg-nghe-fg', text: 'Tiền công kỳ 2 chuyển vào quỹ dự phòng' },
];

export function EventTicker() {
  return (
    <section aria-label="Dòng sổ hụi mẫu" className="border-y border-border bg-card">
      <p className="px-4 pt-3 text-center text-base font-semibold text-muted-foreground">Vài dòng trong sổ hụi mẫu (số minh họa)</p>
      <Marquee pauseOnHover className="marquee-tinh [--duration:50s] [--gap:1rem]" repeat={3}>
        {EVENTS.map((e) => (
          <span key={e.text} className="so-ke inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-background px-4 whitespace-nowrap">
            <span aria-hidden className={`size-2.5 rounded-full ${e.dot}`} />
            {e.text}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

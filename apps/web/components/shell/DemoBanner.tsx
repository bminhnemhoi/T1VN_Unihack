import { vi } from '@/lib/vi';

/** True when the site was built for the live demo (`NEXT_PUBLIC_HUISAFE_DEMO=true`, inlined at build time). */
export const DEMO_BUILD = process.env.NEXT_PUBLIC_HUISAFE_DEMO === 'true';

/**
 * Fixed demo-mode strip (docs/02 US-10): cannot be dismissed, role=status, contrast >= 4.5:1. Shown on every screen of a
 * demo build, and while nothing is deployed (`sample`), when every number is a sample anyway. A deployed, non-demo
 * build has real rounds and shows nothing.
 */
export function DemoBanner({ sample = true }: { sample?: boolean }) {
  if (!DEMO_BUILD && !sample) return null;
  const text = sample ? vi.demoBanner : vi.demoBanner.replace(' Màn hình này dùng số liệu mẫu.', '');
  return (
    <p role="status" data-testid="demo-banner" className="flex items-start gap-3 bg-muc-dem px-4 py-2 text-[0.8rem] leading-snug text-[#e9e4da] sm:items-center sm:px-6">
      <b className="font-mono shrink-0 rounded-[3px] bg-background px-2 py-1 text-[0.65rem] leading-none font-semibold tracking-[0.08em] text-foreground uppercase">Demo</b>
      <span className="min-w-0">{text}</span>
    </p>
  );
}

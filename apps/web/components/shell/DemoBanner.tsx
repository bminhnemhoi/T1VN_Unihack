import { vi } from '@/lib/vi';

/** Fixed demo-mode strip (docs/02 US-10): cannot be dismissed, role=status, contrast >= 4.5:1. */
export function DemoBanner() {
  return (
    <p role="status" className="bg-nghe-bg px-4 py-1.5 text-center text-[0.9rem] leading-snug font-semibold md:py-2 md:text-base text-nghe-fg">
      {vi.demoBanner}
    </p>
  );
}

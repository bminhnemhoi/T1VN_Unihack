import { vi } from '@/lib/vi';

/** Fixed demo-mode strip (docs/02 US-10): cannot be dismissed, role=status, contrast >= 4.5:1. `sample` = nothing deployed yet. */
export function DemoBanner({ sample = true }: { sample?: boolean }) {
  const text = sample ? vi.demoBanner : vi.demoBanner.replace(' Màn hình này dùng số liệu mẫu.', '');
  return (
    <p role="status" className="bg-nghe-bg px-4 py-1.5 text-center text-[0.9rem] leading-snug font-semibold md:py-2 md:text-base text-nghe-fg">
      {text}
    </p>
  );
}

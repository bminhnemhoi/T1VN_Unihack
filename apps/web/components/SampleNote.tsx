import { vi } from '@/lib/vi';

export function SampleNote() {
  return (
    <p role="note" className="bg-nghe-bg px-4 py-2 text-center text-base text-nghe-fg">
      {vi.sampleBanner}
    </p>
  );
}

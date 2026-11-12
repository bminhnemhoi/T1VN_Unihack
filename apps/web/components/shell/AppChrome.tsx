'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * App header, footer and bottom nav. The landing page (`/`) carries its own navigation and footer, so the app chrome
 * stays out of it; every other route keeps it. The landing also sets its own compact demo strip and sample label (same text
 * and roles), so the app's two full-width bars are wrapped here too: every screen still says it is a demo.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  return usePathname() === '/' ? null : <>{children}</>;
}

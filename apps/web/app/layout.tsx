import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import { SampleNote } from '@/components/SampleNote';
import { SiteHeader } from '@/components/SiteHeader';
import { cn } from '@/lib/utils';
import './globals.css';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HụiSafe',
  description: 'Hụi bỏ thăm trên Avalanche Fuji. Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={cn('font-sans', font.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SampleNote />
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </body>
    </html>
  );
}

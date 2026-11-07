import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Dancing_Script, Newsreader } from 'next/font/google';
import type { ReactNode } from 'react';
import { BottomNav } from '@/components/shell/BottomNav';
import { DemoBanner } from '@/components/shell/DemoBanner';
import { SiteFooter } from '@/components/shell/SiteFooter';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { cn } from '@/lib/utils';
import './globals.css';

const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});
const display = Newsreader({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const hand = Dancing_Script({
  subsets: ['latin', 'vietnamese'],
  weight: ['600', '700'],
  variable: '--font-hand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HụiSafe',
  description: 'Hụi bỏ thăm trên Avalanche Fuji. Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={cn('font-sans', sans.variable, display.variable, hand.variable)}>
      <body className="min-h-screen bg-background pb-16 text-foreground antialiased md:pb-0">
        <DemoBanner />
        <SiteHeader />
        {children}
        <SiteFooter />
        <BottomNav />
      </body>
    </html>
  );
}

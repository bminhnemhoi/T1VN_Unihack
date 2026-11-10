import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Newsreader } from 'next/font/google';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { BottomNav } from '@/components/shell/BottomNav';
import { DemoBanner } from '@/components/shell/DemoBanner';
import { SampleModeLabel } from '@/components/shell/SampleModeLabel';
import { FontSizeInit } from '@/components/shell/FontSizeInit';
import { SiteFooter } from '@/components/shell/SiteFooter';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { ToastProvider } from '@/components/shell/Toast';
import { ChainProvider } from '@/lib/chain/provider';
import { loadChainConfig } from '@/lib/chain/server';
import { HuiWalletProvider } from '@/lib/chain/walletProvider';
import { cn } from '@/lib/utils';
import './globals.css';

// Fonts, kept to the minimum that the approved look needs (Lighthouse mobile FCP 2.0 s -> 1.1 s when the extra
// italic cut and the full hand font were removed): Be Vietnam Pro 400 + 600 (bold maps to 600), Newsreader variable
// (display, roman only), plus a 12 KB subset of Dancing Script for three short notes.
const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600'],
  variable: '--font-sans',
  display: 'swap',
});
const display = Newsreader({
  subsets: ['latin', 'vietnamese'],
  style: ['normal'],
  variable: '--font-display',
  display: 'swap',
});

// Subset of Dancing Script (OFL), 12 KB instead of ~70 KB. See app/fonts/README.md.
const hand = localFont({
  src: './fonts/so-hui-hand.woff2',
  variable: '--font-hand',
  display: 'swap',
  fallback: ['cursive'],
});

export const metadata: Metadata = {
  title: { default: 'HụiSafe', template: '%s | HụiSafe' },
  description: 'Hụi bỏ thăm trên Avalanche Fuji. Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c1730',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // `null` = nothing deployed on this network: every screen keeps showing sample data and says so.
  const chain = loadChainConfig();
  return (
    <html lang="vi" className={cn('font-sans', sans.variable, display.variable, hand.variable)}>
      <body className="min-h-screen bg-background pb-16 text-foreground antialiased lg:pb-0">
        <a
          href="#noi-dung"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-full focus-visible:bg-foreground focus-visible:px-5 focus-visible:py-3 focus-visible:font-semibold focus-visible:text-background"
        >
          Bỏ qua, đến nội dung chính
        </a>
        <ChainProvider config={chain}>
          <HuiWalletProvider>
            <ToastProvider>
              <FontSizeInit />
              <DemoBanner sample={chain === null} />
              {chain === null && <SampleModeLabel />}
              <SiteHeader />
              {children}
              <SiteFooter />
              <BottomNav />
            </ToastProvider>
          </HuiWalletProvider>
        </ChainProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppChrome } from '@/components/shell/AppChrome';
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
import { mono, sans } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'HụiSafe', template: '%s | HụiSafe' },
  description: 'Hụi bỏ thăm trên Avalanche Fuji. Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4f0e8',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // `null` = nothing deployed on this network: every screen keeps showing sample data and says so.
  const chain = loadChainConfig();
  return (
    <html lang="vi" className={cn('font-sans', sans.variable, mono.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
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
              <AppChrome>
                <DemoBanner sample={chain === null} />
                {chain === null && <SampleModeLabel />}
                <SiteHeader />
              </AppChrome>
              {children}
              <AppChrome>
                <SiteFooter inChain={chain !== null} />
                <BottomNav />
              </AppChrome>
            </ToastProvider>
          </HuiWalletProvider>
        </ChainProvider>
      </body>
    </html>
  );
}

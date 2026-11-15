import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppFrame } from '@/components/app/AppFrame';
import { FontSizeInit } from '@/components/shell/FontSizeInit';
import { ToastProvider } from '@/components/shell/Toast';
import { ChainProvider } from '@/lib/chain/provider';
import { loadChainConfig } from '@/lib/chain/server';
import { HuiWalletProvider } from '@/lib/chain/walletProvider';
import { cn } from '@/lib/utils';
import { mono, sans } from './fonts';
import './globals.css';
import './hs.css';

export const metadata: Metadata = {
  title: { default: 'HụiSafe', template: '%s | HụiSafe' },
  description: 'Hụi bỏ thăm trên Avalanche Fuji. Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.',
  icons: {
    icon: [{ url: '/brand/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'HụiSafe', statusBarStyle: 'default' },
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
              <AppFrame sample={chain === null}>{children}</AppFrame>
            </ToastProvider>
          </HuiWalletProvider>
        </ChainProvider>
      </body>
    </html>
  );
}

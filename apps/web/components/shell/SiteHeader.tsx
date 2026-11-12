'use client';

import { LogIn, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/brand/Wordmark';
import { CopilotDrawer } from '@/components/copilot/CopilotDrawer';
import { isActive, navFor } from '@/components/shell/nav';
import { useChain } from '@/lib/chain/provider';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { useCopyAddress } from '@/components/shell/CopyAddress';
import { shortAddress } from '@/lib/live/circleData';
import { vi } from '@/lib/vi';
import { cn } from '@/lib/utils';

/** Sticky top bar: the HỤI wordmark, desktop links with a visible active state, the assistant and the login link. */
export function SiteHeader() {
  const pathname = usePathname();
  const chain = useChain();
  const copyAddress = useCopyAddress();
  const { status, wallet, login, logout } = useHuiWallet();
  const signedIn = chain !== null && status === 'ready' && wallet !== undefined;
  const canLogin = chain !== null && (status === 'logged-out' || status === 'loading');
  const loginClass =
    'inline-flex min-h-12 items-center gap-2 rounded-[4px] px-3 text-[0.95rem] font-semibold text-foreground transition-colors duration-150 hover:bg-muted';
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="HụiSafe, về trang chủ" className="flex min-h-14 items-center gap-2 text-foreground">
          <Wordmark />
          <span className="font-mono text-[0.7rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">{vi.appName.replace(/^Hụi/, '')}</span>
        </Link>
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
          {navFor(chain !== null).map((l) => {
            const on = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-12 items-center rounded-[4px] px-3 text-[0.95rem] font-semibold transition-colors duration-150',
                  on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1.5">
          <CopilotDrawer />
          {signedIn ? (
            <>
              <button
                type="button"
                onClick={() => void copyAddress(wallet.address)}
                className="so-ke hidden min-h-12 items-center px-2 text-base text-muted-foreground sm:inline-flex"
                data-testid="wallet-address"
                title={`${wallet.address} (bấm để sao chép)`}
                aria-label={`Sao chép địa chỉ ví ${shortAddress(wallet.address)}`}
              >
                {shortAddress(wallet.address)}
              </button>
              <button type="button" onClick={logout} className={loginClass}>
                <LogOut aria-hidden className="size-5" />
                <span className="hidden sm:inline">Đăng xuất</span>
                <span className="sr-only sm:hidden">Đăng xuất</span>
              </button>
            </>
          ) : canLogin ? (
            <button type="button" onClick={login} disabled={status === 'loading'} className={loginClass}>
              <LogIn aria-hidden className="size-5" />
              <span className="hidden sm:inline">Đăng nhập</span>
              <span className="sr-only sm:hidden">Đăng nhập</span>
            </button>
          ) : (
            <Link href="/dang-nhap" aria-current={pathname === '/dang-nhap' ? 'page' : undefined} className={loginClass}>
              <LogIn aria-hidden className="size-5" />
              <span className="hidden sm:inline">Đăng nhập</span>
              <span className="sr-only sm:hidden">Đăng nhập</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

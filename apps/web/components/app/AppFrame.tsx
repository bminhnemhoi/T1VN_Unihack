'use client';

import { LogIn, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LogoMark } from '@/components/brand/LogoMark';
import { InstallHint } from '@/components/app/InstallHint';
import { OnboardingHost } from '@/components/app/Onboarding';
import { CopilotDrawer } from '@/components/copilot/CopilotDrawer';
import { useCopyAddress } from '@/components/shell/CopyAddress';
import { DemoChip } from '@/components/shell/DemoChip';
import { useChain } from '@/lib/chain/provider';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { tabOf, useCurrentCircle, type AppTab } from '@/lib/current-circle';
import { shortAddress } from '@/lib/live/circleData';
import { useWalletBalance } from '@/lib/live/useWalletBalance';
import { formatCents } from '@/lib/money';

/**
 * The web-app frame of the approved prototype: top bar (wordmark, `DEMO · Fuji` chip, four tabs, the circle's health chips,
 * account), the page area and the phone tab bar, all exactly one screen tall. The landing (`/`) keeps its own frame.
 */
export function AppFrame({ sample, children }: { sample: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const entering = useEnterFromLanding(pathname);
  if (pathname === '/') return <>{children}</>;
  return (
    <div id="hs-root" className={entering ? 'hs entering' : 'hs'}>
      {entering && <EnterCover />}
      <TopBar pathname={pathname} sample={sample} />
      <div className="view" id="hs-view">
        {children}
      </div>
      <TabBar pathname={pathname} />
      <InstallHint />
      <OnboardingHost />
    </div>
  );
}

/**
 * Entering the app from the landing (13/11, "màn mực kéo lên"): only a client navigation from `/` into the app plays
 * it, so a reload or a shared link opens the app at once. The ink cover with the wordmark lifts away (350 ms, after a
 * 260 ms hold) while the page's blocks rise under it, 60 ms apart (`.hs.entering` in hs.css). Off with reduced motion. The
 * landing itself is untouched: the frame notices the route change.
 */
function useEnterFromLanding(pathname: string): boolean {
  const prev = useRef(pathname);
  const [entering, setEntering] = useState(false);
  useLayoutEffect(() => {
    const fromLanding = prev.current === '/' && pathname !== '/';
    prev.current = pathname;
    if (!fromLanding || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setEntering(true);
    const t = window.setTimeout(() => setEntering(false), 1000); // cover ends at 610 ms, last block at 600 + 240 ms
    return () => window.clearTimeout(t);
  }, [pathname]);
  return entering;
}

function EnterCover() {
  return (
    <div className="enterCover" aria-hidden="true">
      <span className="logo">
        H
        <span>
          U<i />
        </span>
        I
      </span>
    </div>
  );
}

const TAB_LABEL: Record<AppTab, string> = { 'tong-quan': 'Tổng quan', day: 'Dây', 'so-hui': 'Sổ hụi', tao: 'Dây mới' };

function useTabs(pathname: string): { tab: AppTab; href: string }[] {
  const circle = useCurrentCircle(pathname);
  return [
    { tab: 'tong-quan', href: '/circles' },
    { tab: 'day', href: circle ? `/circles/${circle}` : '/circles' },
    { tab: 'so-hui', href: circle ? `/circles/${circle}/so-ho` : '/circles' },
    { tab: 'tao', href: '/circles/new' },
  ];
}

function TopBar({ pathname, sample }: { pathname: string; sample: boolean }) {
  const tabs = useTabs(pathname);
  const on = tabOf(pathname);
  return (
    <header className="top">
      <Link className="logo" href="/circles" aria-label="HụiSafe, tổng quan">
        <LogoMark height={24} />
        <span className="wm">HụiSafe</span>
      </Link>
      <DemoChip sample={sample} />
      <nav className="tabs" aria-label="Điều hướng chính">
        {tabs.map((t) => (
          <Link key={t.tab} href={t.href} aria-current={on === t.tab ? 'page' : undefined}>
            {TAB_LABEL[t.tab]}
          </Link>
        ))}
      </nav>
      <div className="health" id="hs-health" />
      <Account pathname={pathname} />
    </header>
  );
}

function Account({ pathname }: { pathname: string }) {
  const chain = useChain();
  const copyAddress = useCopyAddress();
  const { status, wallet, login, logout } = useHuiWallet();
  const signedIn = chain !== null && status === 'ready' && wallet !== undefined;
  const canLogin = chain !== null && (status === 'logged-out' || status === 'loading');
  return (
    <div className="acct">
      <CopilotDrawer />
      {signedIn ? (
        <>
          <button type="button" className="mono" onClick={() => void copyAddress(wallet.address)} data-testid="wallet-address" title={`${wallet.address} (bấm để sao chép)`} aria-label={`Sao chép địa chỉ ví ${shortAddress(wallet.address)}`}>
            <span className="lbl">{shortAddress(wallet.address)}</span>
          </button>
          <WalletBalanceChip owner={wallet.address} />
          <button type="button" onClick={logout} aria-label="Đăng xuất">
            <LogOut aria-hidden />
            <span className="lbl">Đăng xuất</span>
          </button>
        </>
      ) : canLogin ? (
        <button type="button" onClick={login} disabled={status === 'loading'} aria-label="Đăng nhập">
          <LogIn aria-hidden />
          <span className="lbl">Đăng nhập</span>
        </button>
      ) : (
        <Link href="/dang-nhap" aria-current={pathname === '/dang-nhap' ? 'page' : undefined} aria-label="Đăng nhập">
          <LogIn aria-hidden />
          <span className="lbl">Đăng nhập</span>
        </Link>
      )}
      <Link href="/cai-dat" aria-current={pathname === '/cai-dat' ? 'page' : undefined} aria-label="Cài đặt và công cụ khác">
        <Settings aria-hidden />
      </Link>
    </div>
  );
}

/** USDC in the wallet, next to the address. Keeps the last value while refreshing; "…" only on the first load. */
function WalletBalanceChip({ owner }: { owner: `0x${string}` }) {
  const { data, isError } = useWalletBalance(owner);
  const text = data ? formatCents(data.usdc) : isError ? 'Chưa đọc được số dư' : 'Đang đọc số dư…';
  return (
    <Link
      href="/cai-dat#so-du"
      className="bal mono"
      data-testid="wallet-balance"
      aria-busy={!data && !isError}
      aria-label={data ? `Số dư ví: ${text}. Xem chi tiết` : text}
      title={isError ? 'Không đọc được số dư từ mạng Fuji, sẽ thử lại' : 'Số dư USDC của ví. Bấm để xem chi tiết'}
    >
      {data ? text : isError ? '–' : '…'}
    </Link>
  );
}

const ICON: Record<AppTab, ReactNode> = {
  'tong-quan': <path d="M4 10.5 12 4l8 6.5V20h-5v-5.5H9V20H4z" />,
  day: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  'so-hui': (
    <>
      <path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" />
      <path d="M9 9h6M9 13h6" />
    </>
  ),
  tao: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
};

function TabBar({ pathname }: { pathname: string }) {
  const tabs = useTabs(pathname);
  const on = tabOf(pathname);
  const index = Math.max(0, tabs.findIndex((t) => t.tab === on));
  return (
    <nav className="tabbar" aria-label="Điều hướng chính (điện thoại)" data-on={on ?? 'none'} style={{ ['--i' as string]: index }}>
      <span className="pill" aria-hidden="true" />
      {tabs.map((t) => (
        <Link key={t.tab} href={t.href} aria-current={on === t.tab ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {ICON[t.tab]}
          </svg>
          {TAB_LABEL[t.tab]}
        </Link>
      ))}
    </nav>
  );
}

/** Renders into an element of the frame (the top bar's health slot, or the frame root for sheets). */
export function FrameSlot({ target, children }: { target: 'hs-health' | 'hs-root'; children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.getElementById(target)), [target]);
  return el ? createPortal(children, el) : null;
}

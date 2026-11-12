'use client';

import { LogIn, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CopilotDrawer } from '@/components/copilot/CopilotDrawer';
import { useCopyAddress } from '@/components/shell/CopyAddress';
import { DEMO_BUILD } from '@/components/shell/DemoBanner';
import { useChain } from '@/lib/chain/provider';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { tabOf, useCurrentCircle, type AppTab } from '@/lib/current-circle';
import { cycleDemoNet, fastForward, NET_LABEL, useDemo } from '@/lib/demo-store';
import { shortAddress } from '@/lib/live/circleData';
import { vi } from '@/lib/vi';

/**
 * The web-app frame of the approved prototype: demo strip, top bar (wordmark, four tabs, the circle's health chips,
 * account), the page area and the phone tab bar, all exactly one screen tall. The landing (`/`) keeps its own frame.
 */
export function AppFrame({ sample, children }: { sample: boolean; children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return <>{children}</>;
  return (
    <div id="hs-root" className="hs">
      <DemoStrip sample={sample} />
      <TopBar pathname={pathname} />
      <div className="view" id="hs-view">
        {children}
      </div>
      <TabBar pathname={pathname} />
    </div>
  );
}

function DemoStrip({ sample }: { sample: boolean }) {
  const { net } = useDemo();
  if (!DEMO_BUILD && !sample) return null;
  const text = sample ? vi.demoBanner : vi.demoBanner.replace(' Màn hình này dùng số liệu mẫu.', '');
  return (
    <div className="demo" role="status" data-testid="demo-banner">
      <b data-testid="sample-mode">
        Demo<span className="more">{sample ? ' · dữ liệu mẫu' : ''}</span>
      </b>
      <span className="txt">{text}</span>
      {sample && (
        <div className="ctl">
          <button type="button" onClick={() => cycleDemoNet()} title="Mô phỏng tình trạng mạng và dữ liệu">
            Thử: {NET_LABEL[net]}
          </button>
          <button type="button" onClick={fastForward} title="Đưa kỳ đang chạy của dây mẫu sang giai đoạn tiếp theo">
            Tua nhanh ›
          </button>
        </div>
      )}
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

function TopBar({ pathname }: { pathname: string }) {
  const tabs = useTabs(pathname);
  const on = tabOf(pathname);
  return (
    <header className="top">
      <Link className="logo" href="/circles" aria-label="HụiSafe, tổng quan">
        H
        <span>
          U<i />
        </span>
        I
      </Link>
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
  return (
    <nav className="tabbar" aria-label="Điều hướng chính (điện thoại)">
      {tabs.map((t) => (
        <Link key={t.tab} href={t.href} aria-current={on === t.tab ? 'page' : undefined}>
          <i aria-hidden />
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

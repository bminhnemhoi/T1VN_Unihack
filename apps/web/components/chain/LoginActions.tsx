'use client';

import { Mail, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { loginRedirect } from '@/lib/login-redirect';
import { useChain } from '@/lib/chain/provider';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { shortAddress } from '@/lib/live/circleData';
import { SoonButton } from '@/components/shell/SoonButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const GOOGLE_MSG = 'Đăng nhập bằng Google sẽ chạy khi nối ví. Hiện là màn hình mẫu, chưa có tài khoản nào được tạo.';
const EMAIL_MSG = 'Đăng nhập bằng email sẽ chạy khi nối ví. Hiện là màn hình mẫu, chưa gửi mã nào.';
const PHONE_MSG = 'Mã OTP số điện thoại là phần thêm, sắp có. Mỗi số điện thoại chỉ dùng cho một ví. Hiện là màn hình mẫu.';

/**
 * The three login buttons of S01. Real Privy login when configured, a local test wallet on anvil, otherwise the "sắp có"
 * answers. Once signed in (status ready with a wallet) the page leaves on its own: back to the invite, else /circles.
 */
export function LoginActions({ next }: { next?: string }) {
  const chain = useChain();
  const router = useRouter();
  const { status, wallet, login, logout, devIndex, setDevIndex } = useHuiWallet();
  const target = chain ? loginRedirect(status, Boolean(wallet), next) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (target && wallet) {
    return (
      <div className="mt-5">
        <p role="status" className="font-semibold">
          Bạn đã đăng nhập với ví <span className="so-ke" data-testid="login-address">{shortAddress(wallet.address)}</span>.
          Đang chuyển về {next ? 'trang mời' : 'dây của bạn'}…
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={target}>{next ? 'Quay lại trang mời' : 'Xem dây của tôi'}</Link>
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={logout}>
            Đăng xuất
          </Button>
        </div>
      </div>
    );
  }

  if (chain && status !== 'unavailable' && setDevIndex) {
    return (
      <div className="mt-5">
        <label htmlFor="vi-thu" className="font-semibold">
          Ví thử nghiệm trên máy này (chỉ có ở mạng cục bộ)
        </label>
        <select
          id="vi-thu"
          className="mt-1 block min-h-12 w-full rounded-lg border border-input bg-background px-3 text-lg"
          value={devIndex ?? 5}
          onChange={(e) => setDevIndex(Number(e.target.value))}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i} value={i}>
              Tài khoản thử nghiệm {i}
            </option>
          ))}
        </select>
        <Button type="button" size="lg" className="mt-3 w-full" onClick={() => setDevIndex(devIndex ?? 5)}>
          Vào bằng ví thử nghiệm
        </Button>
        <p className="mt-2 text-muted-foreground">Ví công khai của anvil, không có giá trị ngoài máy này.</p>
      </div>
    );
  }

  if (chain && status !== 'unavailable') {
    return (
      <div className="mt-5 flex flex-col gap-3">
        <Button type="button" size="lg" disabled={status === 'loading'} onClick={login}>
          Tiếp tục với Google
        </Button>
        <Button type="button" size="lg" variant="outline" disabled={status === 'loading'} onClick={login}>
          <Mail aria-hidden className="size-5" /> Tiếp tục với email
        </Button>
        <SoonButton size="lg" variant="outline" message={PHONE_MSG}>
          <Phone aria-hidden className="size-5" /> Tiếp tục với số điện thoại
        </SoonButton>
        <p className="flex items-start gap-2 font-semibold">
          <ShieldCheck aria-hidden className="mt-1 size-5 shrink-0 text-state-ok" />
          Không cần ví, không cần AVAX. Ví được tạo tự động cho bạn.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 flex flex-col gap-3">
        <SoonButton size="lg" message={GOOGLE_MSG}>
          Tiếp tục với Google
        </SoonButton>
        <SoonButton size="lg" variant="outline" message={EMAIL_MSG}>
          <Mail aria-hidden className="size-5" /> Tiếp tục với email
        </SoonButton>
        <SoonButton size="lg" variant="outline" message={PHONE_MSG}>
          <Phone aria-hidden className="size-5" /> Tiếp tục với số điện thoại
        </SoonButton>
      </div>
      <p className="mt-4 flex items-start gap-2 font-semibold">
        <ShieldCheck aria-hidden className="mt-1 size-5 shrink-0 text-state-ok" />
        Không cần ví, không cần AVAX. Ví được tạo tự động cho bạn.
      </p>
      <p className="mt-3">
        <Badge variant="secondary">Sắp có khi nối ví</Badge>
      </p>
    </>
  );
}

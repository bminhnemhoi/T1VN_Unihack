'use client';

import Link from 'next/link';
import { SoonButton } from '@/components/shell/SoonButton';
import { Button } from '@/components/ui/button';
import { useChain } from '@/lib/chain/provider';
import { useHuiWallet } from '@/lib/chain/walletProvider';

/** Landing actions. On sample data: "xem thử" and a login that says it is coming. With a deployment: the real circles and the real login. */
export function HeroActions() {
  const chain = useChain();
  const { status, login } = useHuiWallet();
  const canLogin = chain !== null && (status === 'logged-out' || status === 'loading');
  const signedIn = chain !== null && status === 'ready';
  return (
    <div className="vao mt-8 flex max-w-md flex-col gap-2" style={{ ['--i' as string]: 3 }}>
      <Button asChild size="lg" className="bg-nghe text-muc-dem hover:bg-nghe/90">
        <Link href="/circles">{chain ? 'Xem dây của tôi' : 'Xem thử màn hình mẫu'}</Link>
      </Button>
      {!chain && <p className="text-[#c9d2e0]">Không cần đăng nhập, không cần ví.</p>}
      {signedIn ? (
        <p className="text-[#c9d2e0]">Bạn đã đăng nhập.</p>
      ) : canLogin ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={status === 'loading'}
            onClick={login}
            className="mt-1 border-[#c9d2e0] bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            Đăng nhập bằng Google hoặc email
          </Button>
          <p className="text-[#c9d2e0]">Ví được tạo tự động, bạn không cần AVAX.</p>
        </>
      ) : (
        <>
          <SoonButton
            variant="outline"
            size="lg"
            aria-describedby="dang-nhap-ghi-chu"
            message="Đăng nhập bằng Google hoặc email sẽ có khi nối ví. Hiện là màn hình mẫu, bạn xem thử các màn hình bằng nút Xem thử màn hình mẫu."
            className="mt-1 border-[#c9d2e0] bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            Đăng nhập bằng Google hoặc email
          </SoonButton>
          <p id="dang-nhap-ghi-chu" className="text-[#c9d2e0]">
            Đăng nhập sẽ có sau khi nối ví.
          </p>
        </>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useChain } from '@/lib/chain/provider';
import { openOnboarding } from '@/lib/onboarding-store';
import { cycleDemoNet, fastForward, NET_LABEL, useDemo } from '@/lib/demo-store';
import { useHuiActions } from '@/lib/chain/actions';
import { useHuiWallet } from '@/lib/chain/walletProvider';
import { formatUsdc } from 'sdk';
import { useWalletBalance } from '@/lib/live/useWalletBalance';
import { formatAvax } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { RepBadge, RepDisclaimer } from '@/components/circle/RepBadge';
import { applyFontSize, FONT_KEY, readFontSize, type FontSize } from '@/components/shell/FontSizeInit';
import { CopyAddressButton } from '@/components/shell/CopyAddress';
import { SoonButton } from '@/components/shell/SoonButton';
import { useToast } from '@/components/shell/Toast';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useHiddenCircles } from '@/lib/hidden-store';
import { getSampleCircle } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

const ME = getSampleCircle('demo').seats[1]!; // the sample viewer: Thành viên 2
const MIN_PASS = 8;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** S14: only the text size works for real today (it is stored in this browser); backup and reminders explain what they will do. */
export function SettingsView() {
  const { show } = useToast();
  const [size, setSize] = useState<FontSize>('normal');
  const [remind, setRemind] = useState(false);
  const [pass, setPass] = useState('');
  const chain = useChain();
  const actions = useHuiActions();
  const { wallet } = useHuiWallet();
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | undefined>();
  const live = chain !== null;

  const backup = async () => {
    if (pass.length < MIN_PASS) return setBackupMsg({ ok: false, text: `Hãy nhập mật khẩu dài ít nhất ${MIN_PASS} ký tự trước.` });
    if (!actions) return setBackupMsg({ ok: false, text: 'Hãy đăng nhập bằng ví của bạn trước, để biết sao lưu thăm của ví nào.' });
    try {
      const text = await actions.exportSaltBackup(pass);
      download('huisafe-sao-luu-tham.json', text);
      setBackupMsg({ ok: true, text: 'Đã tải file sao lưu, mã hóa bằng mật khẩu của bạn. Giữ file và mật khẩu ở nơi an toàn.' });
    } catch {
      setBackupMsg({ ok: false, text: 'Chưa có thăm niêm phong nào của ví này trên máy để sao lưu, hoặc trình duyệt không cho tải file.' });
    }
  };
  const restore = async (file: File | undefined) => {
    if (!file) return;
    if (pass.length < MIN_PASS) return setBackupMsg({ ok: false, text: `Nhập mật khẩu của file sao lưu (ít nhất ${MIN_PASS} ký tự) rồi chọn lại file.` });
    if (!actions) return setBackupMsg({ ok: false, text: 'Hãy đăng nhập trước khi nạp file sao lưu.' });
    try {
      const n = await actions.importSaltBackup(await file.text(), pass);
      setBackupMsg({ ok: true, text: `Đã nạp lại ${n} mã bí mật thăm vào máy này.` });
    } catch {
      setBackupMsg({ ok: false, text: 'Không mở được file: sai mật khẩu hoặc file không phải bản sao lưu của HụiSafe.' });
    }
  };
  useEffect(() => setSize(readFontSize()), []);

  const change = (v: FontSize) => {
    setSize(v);
    applyFontSize(v);
    try {
      localStorage.setItem(FONT_KEY, v);
    } catch {
      show('Máy không cho lưu lựa chọn này, nên lần sau bạn cần chọn lại.', 'error');
    }
  };

  return (
    <main id="noi-dung" className="pg narrow">
      <h1 className="font-display text-h1 font-bold">Cài đặt</h1>
      <p className="mt-2 text-lead text-muted-foreground">Mọi lựa chọn ở đây chỉ nằm trên trình duyệt này.</p>

      {live && (
        <section aria-labelledby="dia-chi-vi" className="o-phang mt-8 p-6">
          <h2 id="dia-chi-vi" className="font-display text-h2 font-bold">
            Địa chỉ ví của bạn
          </h2>
          {wallet?.address ? (
            <>
              <p className="mt-1 max-w-prose text-muted-foreground">Ví này do HụiSafe tạo cho bạn khi đăng nhập. Gửi địa chỉ cho đội hoặc chủ hụi khi họ cần chuyển USDC thử nghiệm cho bạn.</p>
              <p className="so-ke mt-3 rounded-lg bg-secondary p-3 break-all" data-testid="wallet-address-full">
                {wallet.address}
              </p>
              <div className="mt-3">
                <CopyAddressButton address={wallet.address} />
              </div>
              <WalletBalanceBlock owner={wallet.address as `0x${string}`} />
            </>
          ) : (
            <p className="mt-1 max-w-prose text-muted-foreground">Hãy đăng nhập để thấy địa chỉ ví của bạn.</p>
          )}
        </section>
      )}

      <section aria-labelledby="co-chu" className={live ? 'to-giay mt-6 p-6' : 'to-giay mt-8 p-6'}>
        <h2 id="co-chu" className="font-display text-h2 font-bold">
          Cỡ chữ
        </h2>
        <p id="co-chu-nhan" className="mt-1 text-muted-foreground">
          Chữ lớn tăng toàn bộ chữ trong ứng dụng từ 18 lên 22 điểm.
        </p>
        <ToggleGroup type="single" variant="outline" value={size} onValueChange={(v) => v && change(v as FontSize)} aria-labelledby="co-chu-nhan" className="mt-2">
          <ToggleGroupItem value="normal" className={TOGGLE_ON}>Chữ thường</ToggleGroupItem>
          <ToggleGroupItem value="large" className={TOGGLE_ON}>Chữ lớn</ToggleGroupItem>
        </ToggleGroup>
        <p className="mt-3 rounded-lg bg-secondary p-3">Câu mẫu: thăm cao nhất được hốt, không có may rủi.</p>
      </section>

      <section aria-labelledby="sao-luu" className="o-phang mt-6 p-6">
        <h2 id="sao-luu" className="font-display text-h2 font-bold">
          Sao lưu thăm
        </h2>
        <p className="mt-1 max-w-prose text-muted-foreground">
          Thăm niêm phong được khóa bằng một mã bí mật chỉ lưu trên máy này. Đổi máy hoặc xóa dữ liệu trình duyệt mà chưa sao lưu thì không mở được thăm và mất cọc mở thăm.
        </p>
        <Field className="mt-3">
          <FieldLabel htmlFor="mat-khau">Mật khẩu để mã hóa file sao lưu</FieldLabel>
          <Input id="mat-khau" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} className="max-w-sm" />
          <FieldDescription>Mật khẩu không gửi đi đâu. Quên mật khẩu thì file sao lưu không mở được.</FieldDescription>
        </Field>
        <div className="mt-3 flex flex-wrap gap-3">
          {live ? (
            <>
              <Button type="button" size="lg" onClick={() => void backup()}>
                Sao lưu thăm
              </Button>
              <label className="inline-flex min-h-12 cursor-pointer items-center rounded-full border border-border bg-background px-5 font-semibold hover:bg-muted">
                Nhập file sao lưu
                <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void restore(e.target.files?.[0])} />
              </label>
            </>
          ) : (
            <>
              <SoonButton
                size="lg"
                message={pass.length < 8 ? 'Hãy nhập mật khẩu dài ít nhất 8 ký tự trước. Hiện chưa có thăm nào trên máy này để sao lưu, vì đây là màn hình mẫu.' : 'Chưa có thăm niêm phong nào trên máy này để sao lưu. Khi nộp thăm thật, nút này tải file mã hóa.'}
              >
                Sao lưu thăm
              </SoonButton>
              <SoonButton size="lg" variant="outline" message="Nhập file sao lưu để mở thăm trên máy mới, sắp có cùng lúc với nộp thăm thật.">
                Nhập file sao lưu
              </SoonButton>
            </>
          )}
        </div>
        {backupMsg && (
          <p role={backupMsg.ok ? 'status' : 'alert'} className={backupMsg.ok ? 'mt-3 font-semibold text-state-ok' : 'mt-3 font-semibold text-state-bad'}>
            {backupMsg.text}
          </p>
        )}
      </section>

      <section aria-labelledby="nhac" className="o-phang mt-6 p-6">
        <h2 id="nhac" className="font-display text-h2 font-bold">
          Nhắc hụi qua Telegram
        </h2>
        <p className="mt-1 text-muted-foreground">Phần thêm, tự chọn. Nhắc trước giờ đóng nộp thăm và trước hạn góp.</p>
        <label htmlFor="nhac-bat" className="mt-3 flex min-h-12 cursor-pointer items-center gap-3">
          <Switch
            id="nhac-bat"
            checked={remind}
            onCheckedChange={(v) => {
              setRemind(v);
              if (v) show('Nhắc hụi qua Telegram cần đăng nhập và liên kết tài khoản, sắp có. Hiện là màn hình mẫu, chưa có tin nhắn nào được gửi.');
            }}
          />
          Bật nhắc hụi
        </label>
      </section>

      <section aria-labelledby="huy-hieu" className="o-phang mt-6 p-6">
        <h2 id="huy-hieu" className="font-display text-h2 font-bold">
          Huy hiệu của bạn
        </h2>
        <div className="mt-2">
          {live ? (
            wallet ? (
              <>
                <p className="mb-2 text-muted-foreground">Chủ hụi và thành viên có huy hiệu riêng, tính từ lịch sử của ví này.</p>
                <RepBadge rep={{ ...ME.rep, address: wallet.address }} showNext />
                <div className="mt-2">
                  <RepBadge rep={{ ...ME.rep, address: wallet.address }} who="organizer" showNext />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Đăng nhập để xem huy hiệu của ví bạn.</p>
            )
          ) : (
            <RepBadge rep={ME.rep} showNext />
          )}
        </div>
        <RepDisclaimer className="mt-3" />
      </section>

      {!chain && <DemoTools />}

      <HiddenCircles owner={wallet?.address} />

      <section aria-labelledby="cong-cu" className="o-phang mt-6 p-6">
        <h2 id="cong-cu" className="font-display text-h2 font-bold">
          Công cụ khác
        </h2>
        <ul aria-label="Công cụ khác" className="mt-2">
          {[
            ['/lab', 'Phòng mô phỏng', 'so ba cách chơi hụi trên 10.000 dây giả lập'],
            ['/thong-bao-ubnd', 'Thông báo UBND', 'soạn thông báo tổ chức dây theo NĐ 19 Điều 14'],
            ['/', 'Trang giới thiệu', 'HụiSafe là gì, chơi thử 5 tình huống'],
          ].map(([href = '/', label, note]) => (
            <li key={href} className="dong-ke last:border-b-0">
              <Link href={href} className="flex min-h-12 flex-wrap items-center gap-x-3 py-2 font-semibold underline-offset-4 hover:underline">
                {label}
                <span className="font-normal text-muted-foreground">{note}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="lg" className="mt-4" onClick={openOnboarding}>
          Xem lại hướng dẫn
        </Button>
      </section>
    </main>
  );
}

/** "Dây đã ẩn" (B25): circles this wallet deleted from the list on this device, each with "Hiện lại". The on-chain book is untouched. */
function HiddenCircles({ owner }: { owner?: `0x${string}` }) {
  const { hidden, unhide } = useHiddenCircles(owner);
  const { show } = useToast();
  return (
    <section id="day-da-an" aria-labelledby="da-an" className="o-phang mt-6 p-6" data-testid="hidden-circles">
      <h2 id="da-an" className="font-display text-h2 font-bold">
        Dây đã ẩn
      </h2>
      <p className="mt-1 text-muted-foreground">Dây bạn đã xóa khỏi danh sách trên máy này. Sổ trên blockchain vẫn giữ nguyên; hiện lại là dây quay về danh sách.</p>
      {hidden.length === 0 ? (
        <p className="mt-3 text-muted-foreground">Chưa ẩn dây nào.</p>
      ) : (
        <ul aria-label="Dây đã ẩn" className="mt-2">
          {hidden.map((h) => (
            <li key={h.id} className="dong-ke flex min-h-12 flex-wrap items-center justify-between gap-3 py-2 last:border-b-0">
              <span className="font-semibold">{h.label}</span>
              <Button
                type="button"
                variant="outline"
                size="lg"
                aria-label={`Hiện lại dây ${h.label}`}
                onClick={() => {
                  unhide(h.id);
                  show(`Đã hiện lại dây "${h.label}"`);
                }}
              >
                Hiện lại
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Balance of the signed-in wallet (USDC exact, AVAX), with the faucet when the wallet has no USDC yet. */
function WalletBalanceBlock({ owner }: { owner: `0x${string}` }) {
  const { data, isError, isFetching, refetch } = useWalletBalance(owner);
  return (
    <div id="so-du" className="mt-6" aria-busy={!data && !isError}>
      <h3 className="font-display text-lg font-bold">Số dư ví</h3>
      {data ? (
        <>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">USDC</dt>
            <dd className="so-ke text-right" data-testid="balance-usdc">{formatUsdc(data.usdc)}</dd>
            <dt className="text-muted-foreground">AVAX</dt>
            <dd className="so-ke text-right" data-testid="balance-avax">{formatAvax(data.avax)}</dd>
          </dl>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Không cần AVAX: phí mạng do HụiSafe trả. Số dư tự cập nhật{isFetching ? ' (đang làm mới…)' : ''}.
          </p>
          {data.usdc === 0n && (
            <p className="mt-2 max-w-prose text-sm" role="status">
              Ví chưa có USDC thử nghiệm. Lấy miễn phí 20 USDC ở{' '}
              <a className="underline underline-offset-4" href="https://faucet.circle.com" target="_blank" rel="noreferrer">
                faucet.circle.com
              </a>{' '}
              (chọn Avalanche Fuji, dán địa chỉ ví ở trên).
            </p>
          )}
        </>
      ) : isError ? (
        <div className="mt-2" role="status">
          <p className="text-muted-foreground">Chưa đọc được số dư từ mạng Fuji.</p>
          <Button type="button" variant="outline" className="mt-2" onClick={() => void refetch()}>
            Đọc lại số dư
          </Button>
        </div>
      ) : (
        <div className="mt-2 grid gap-2" role="status" aria-label="Đang đọc số dư">
          <div className="h-6 w-full animate-pulse rounded bg-secondary motion-reduce:animate-none" />
          <div className="h-6 w-full animate-pulse rounded bg-secondary motion-reduce:animate-none" />
        </div>
      )}
    </div>
  );
}

/**
 * "Công cụ demo" (sample data only; it used to be the black demo strip). "Thử: …" cycles the network the sample screens
 * pretend to have, "Tua nhanh" moves the sample round to its next phase. Nothing here touches the chain.
 */
function DemoTools() {
  const { net } = useDemo();
  return (
    <section aria-labelledby="cong-cu-demo" className="o-phang mt-6 p-6" data-testid="demo-tools">
      <h2 id="cong-cu-demo" className="font-display text-h2 font-bold">
        Công cụ demo
      </h2>
      <p className="mt-2 max-w-prose text-muted-foreground">Chỉ có khi xem dữ liệu mẫu. Đổi tình trạng mạng để xem các trạng thái tải, trống và lỗi; tua nhanh để đưa kỳ đang chạy sang giai đoạn kế tiếp.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="lg" onClick={() => cycleDemoNet()} title="Mô phỏng tình trạng mạng và dữ liệu">
          Thử: {NET_LABEL[net]}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={fastForward} title="Đưa kỳ đang chạy của dây mẫu sang giai đoạn tiếp theo">
          Tua nhanh ›
        </Button>
      </div>
    </section>
  );
}

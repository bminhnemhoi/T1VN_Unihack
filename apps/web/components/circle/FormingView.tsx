'use client';

import { Copy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatBps, formatUsdc, parseUsdc, previewCircle } from 'sdk';
import { ActionButton } from '@/components/chain/ActionButton';
import { Countdown } from '@/components/brand/Countdown';
import { QrCode } from '@/components/circle/QrCode';
import { RepBadge, RepDisclaimer } from '@/components/circle/RepBadge';
import { RoundStrip } from '@/components/circle/RoundStrip';
import { LedgerList } from '@/components/LedgerList';
import { SoonButton } from '@/components/shell/SoonButton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shell/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useChainNowSec } from '@/lib/live/useChainClock';
import { useMemberBalances } from '@/lib/live/useMemberBalances';
import { useMinCoverageBps } from '@/lib/live/useMinCoverage';
import { type SampleCircleData } from '@/lib/sample-circles';

/**
 * S04: a circle still gathering people. Invite link + QR, who joined (with reputation), the bond state, and "Bắt đầu dây",
 * which stays closed until the circle is full AND coverage reaches the on-chain floor (`minCoverageBps`), and says which one is missing.
 */
export function FormingView({ c }: { c: SampleCircleData }) {
  const id = c.id;
  const { show } = useToast();
  const t = c.terms;
  const n = Number(t.n);
  const [pretendFull, setPretendFull] = useState(false);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const live = c.live;
  const nowSec = useChainNowSec(live?.nowMs);
  const [topUp, setTopUp] = useState('');
  const joined = c.seats.filter((s) => s.joined).length;
  const joinedAddrs = useMemo(
    () => c.seats.flatMap((s) => (s.joined && s.address ? [s.address] : [])),
    [c.seats],
  );
  const memberBalances = useMemberBalances(joinedAddrs, Boolean(live && c.state === 'forming'));
  const underfundedSeats = useMemo(() => {
    if (!live || !memberBalances.data) return [];
    return c.seats.flatMap((s, i) => {
      if (!s.joined || !s.address) return [];
      const bal = memberBalances.data[s.address.toLowerCase()];
      return bal !== undefined && bal < t.c ? [`Thành viên ${i + 1}`] : [];
    });
  }, [live, memberBalances.data, c.seats, t.c]);
  const have = !live && pretendFull ? n : joined;
  const full = have >= n;
  const floor = useMinCoverageBps(live?.address);
  const preview = previewCircle({ n: t.n, c: t.c, periodDays: t.periodDays, alphaBps: t.alphaBps, bond: c.bond, capBps: t.capBps, minCoverageBps: floor });
  const ready = full && preview.canActivate;
  const pastDeadline = live ? nowSec > live.view.params.joinDeadline : false;
  const joinLeftSec = live ? Math.max(0, live.view.params.joinDeadline - nowSec) : (c.joinSecondsLeft ?? 0);
  const topUpAmount = topUp.trim() === '' ? preview.bondMissing : parseUsdc(topUp);
  const reason = !full
    ? `Chưa bắt đầu được: dây mới có ${have} trên ${n} người. Cần đủ ${n} người, rồi mới bấm bắt đầu.`
    : !preview.canActivate
      ? `Chưa bắt đầu được: chỉ số bảo chứng ${formatBps(preview.coverageBps)}, thấp hơn mức tối thiểu ${formatBps(preview.minCoverageBps)}. Cần nạp thêm ${formatUsdc(preview.bondMissing)} ký quỹ.`
      : 'Đủ người và đủ bảo chứng. Bấm bắt đầu để dây chạy kỳ 1.';
  const invitePath = `/moi/${id}`;
  const inviteUrl = `${origin || 'https://huisafe.example'}${invitePath}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      show('Đã sao chép đường dẫn mời (bản mẫu). Gửi cho người bạn muốn mời vào dây.');
    } catch {
      show(`Máy không cho sao chép tự động. Hãy chép tay: ${inviteUrl}`, 'error');
    }
  };
  const start = () => {
    if (!ready) {
      show(reason, 'error');
      return;
    }
    show('Bắt đầu dây cần đăng nhập và nối mạng, sắp có. Hiện là màn hình mẫu, dây chưa chạy.');
  };

  return (
    <main id="noi-dung" className="pg">
      <Link href="/circles" className="inline-flex min-h-12 items-center font-semibold text-primary underline-offset-4 hover:underline">
        ← Dây của tôi
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold">{c.label}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Đang gom người</Badge>
            <Badge variant="outline">{c.viewerIsOrganizer ? 'Bạn là chủ hụi' : c.viewer >= 0 ? `Bạn là thành viên ${c.viewer + 1}` : live ? 'Bạn đang xem, chưa ở trong dây' : 'Bạn là chủ hụi'}</Badge>
            <Badge variant="secondary">{t.mode === 'fixed' ? 'Cố định' : 'Bỏ thăm'}</Badge>
            {!live && <Badge variant="secondary">Dữ liệu mẫu</Badge>}
          </div>
        </div>
        <RoundStrip n={n} done={0} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
        <div className="space-y-6">
          <section aria-labelledby="gom" className="nen-muc rounded-xl p-6 md:p-8">
            <h2 id="gom" className="font-display text-h1 font-bold">
              Đang chờ đủ người: {have} trên {n}
            </h2>
            <p className="mt-3 text-lead text-[#e9e4da]">
              {full ? (
                <>
                  Đã đủ {n} người. Còn <Countdown seconds={joinLeftSec} className="font-semibold text-white" /> để bấm &quot;Bắt đầu dây&quot;; quá hạn mà chưa bắt đầu thì dây tự hủy và ký quỹ được rút lại.
                </>
              ) : (
                <>
                  Còn <Countdown seconds={joinLeftSec} className="font-semibold text-white" /> để mời đủ người. Quá hạn mà chưa đủ thì dây tự hủy và ký quỹ được rút lại.
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {live ? (
                c.viewerIsOrganizer ? (
                  <>
                    <ActionButton
                      size="lg"
                      disabled={!ready}
                      aria-describedby="ly-do-bat-dau"
                      className={ready ? 'bg-action-ink text-muc-dem hover:bg-action-ink/90' : 'border border-[#c9c2b6] bg-transparent text-[#e9e4da] hover:bg-white/10'}
                      run={(a) => a.activate(live.address)}
                      success="Dây đã bắt đầu chạy kỳ 1."
                      noticeClassName="text-white"
                    >
                      Bắt đầu dây
                    </ActionButton>
                    {c.viewer < 0 && !full && !pastDeadline && (
                      <Button asChild size="lg" variant="outline" className="border-[#c9c2b6] bg-transparent text-white hover:bg-white/10 hover:text-white">
                        <Link href={invitePath}>Tham gia 1 chân trong dây này</Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <Button asChild size="lg" className="bg-action-ink text-muc-dem hover:bg-action-ink/90">
                    <Link href={invitePath}>Vào dây này</Link>
                  </Button>
                )
              ) : (
                <Button type="button" size="lg" onClick={start} aria-disabled={!ready} aria-describedby="ly-do-bat-dau" className={ready ? 'bg-action-ink text-muc-dem hover:bg-action-ink/90' : 'border border-[#c9c2b6] bg-transparent text-[#e9e4da] hover:bg-white/10'}>
                  Bắt đầu dây
                </Button>
              )}
            </div>
            <p id="ly-do-bat-dau" className="mt-3 text-[#e9e4da]">
              {reason}
            </p>
            {underfundedSeats.length > 0 && c.viewerIsOrganizer && (
              <p role="alert" className="mt-3 rounded-lg border border-[#ff6a5c] bg-white/10 p-3 text-sm font-semibold text-white">
                Cảnh báo bảo vệ ký quỹ: {underfundedSeats.join(', ')} hiện chưa đủ {formatUsdc(t.c)} trong ví cho kỳ 1. Hãy nhắc nạp đủ trước khi bấm Bắt đầu dây.
              </p>
            )}
            {!live && (
              <label htmlFor="xem-du" className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 text-[#c9c2b6]">
                <Switch id="xem-du" checked={pretendFull} onCheckedChange={setPretendFull} />
                Xem thử khi đã đủ {n} người (chỉ có ở bản mẫu)
              </label>
            )}
          </section>

          <section aria-labelledby="moi" className="to-giay p-6">
            <h2 id="moi" className="font-display text-h2 font-bold">
              Mời người vào dây
            </h2>
            <div className="mt-3 flex flex-wrap items-start gap-6">
              <div className="shrink-0">
                <QrCode text={inviteUrl} label={`Mã QR của đường dẫn mời ${c.label}`} />
              </div>
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-muted-foreground">Người được mời quét mã hoặc mở đường dẫn, xem luật, rồi vào dây.</p>
                <p className="so-ke mt-2 rounded-lg bg-secondary p-3 break-all" data-testid="invite-url">
                  {inviteUrl}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button type="button" size="lg" onClick={copy}>
                    <Copy aria-hidden className="size-5" /> Sao chép đường dẫn mời
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href={invitePath}>Xem trang mời</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="ky-quy" className="o-phang p-6">
            <h2 id="ky-quy" className="font-display text-h3 font-bold">
              Ký quỹ của bạn
            </h2>
            <LedgerList
              className="mt-2"
              items={[
                { label: 'Mỗi kỳ góp', value: formatUsdc(t.c) },
                { label: 'Ký quỹ đã khóa', value: formatUsdc(c.bond) },
                { label: `Cần tối thiểu để bắt đầu (${formatBps(preview.minCoverageBps)})`, value: formatUsdc(preview.bondForMin) },
                { label: 'Cần để đạt chỉ số 100%', value: formatUsdc(preview.bondFor100) },
                { label: 'Chỉ số bảo chứng', value: formatBps(preview.coverageBps) },
              ]}
            />
            <p className="mt-3 text-muted-foreground">
              {preview.canActivate ? 'Ký quỹ đã đủ để bắt đầu dây.' : `Còn thiếu ${formatUsdc(preview.bondMissing)} để bắt đầu.`} Hết dây bạn lấy lại ký quỹ, chỉ mất phần đã dùng để bù cho người bỏ đóng.
            </p>
            {live && !c.viewerIsOrganizer ? null : live ? (
              <div className="mt-3">
                <label htmlFor="nap-them" className="font-semibold">
                  Số USDC muốn nạp thêm
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Input id="nap-them" inputMode="decimal" autoComplete="off" className="so-ke max-w-40 text-right text-lg" value={topUp} placeholder={formatUsdc(preview.bondMissing > 0n ? preview.bondMissing : 0n).replace(' USDC', '')} onChange={(e) => setTopUp(e.target.value)} />
                  <span className="text-lg">USDC</span>
                </div>
                <ActionButton
                  variant="outline"
                  size="lg"
                  className="mt-3"
                  disabled={topUpAmount === undefined || topUpAmount <= 0n}
                  run={(a) => a.depositBond(live.address, topUpAmount!)}
                  success="Đã nạp thêm ký quỹ."
                >
                  Nạp thêm ký quỹ
                </ActionButton>
              </div>
            ) : (
              <SoonButton variant="outline" size="lg" className="mt-3" message="Nạp thêm ký quỹ cần đăng nhập và nối ví, sắp có. Hiện là màn hình mẫu, chưa nạp gì.">
                Nạp thêm ký quỹ
              </SoonButton>
            )}
            {live && pastDeadline && (
              <div className="mt-6 border-t border-border pt-4">
                <p className="font-semibold">Hết hạn gom người mà dây chưa đủ.</p>
                <p className="text-muted-foreground">Ai cũng hủy dây được. Sau khi hủy, chủ hụi rút lại ký quỹ.</p>
                <ActionButton variant="outline" size="lg" className="mt-3" run={(a) => a.cancel(live.address)} success="Đã hủy dây.">
                  Hủy dây quá hạn
                </ActionButton>
              </div>
            )}
          </section>
        </div>

        <section aria-labelledby="cho-ngoi" className="o-phang p-6">
          <h2 id="cho-ngoi" className="font-display text-h3 font-bold">
            Người đã vào dây
          </h2>
          <ol className="mt-2">
            {c.seats.map((s, i) => {
              const here = s.joined || (pretendFull && !s.joined);
              const bal = s.joined && s.address && memberBalances.data ? memberBalances.data[s.address.toLowerCase()] : undefined;
              const funded = bal === undefined ? undefined : bal >= t.c;
              return (
                <li key={i} className="dong-ke flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 last:border-b-0">
                  <span className="min-w-0">
                    <span className={here ? 'font-semibold' : 'text-muted-foreground'}>{here && !s.joined ? `Thành viên ${i + 1}` : s.name}</span>
                    <span className="block text-muted-foreground">{here ? `vào thứ ${i + 1}` : 'chờ người mời'}</span>
                  </span>
                  {here && (
                    <span className="flex flex-wrap items-center gap-2">
                      {funded !== undefined && (
                        <Badge variant={funded ? 'secondary' : 'destructive'}>
                          {funded ? 'Đủ kỳ 1' : 'Thiếu USDC kỳ 1'}
                        </Badge>
                      )}
                      <RepBadge rep={s.rep} who={s.organizer ? 'organizer' : 'member'} />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <RepDisclaimer className="mt-3" />
          {live && c.viewer >= 0 && !c.viewerIsOrganizer && (
            <div className="mt-4 border-t border-border pt-4">
              <ActionButton variant="outline" size="lg" run={(a) => a.leave(live.address)} success="Bạn đã rời dây. Nhớ thu hồi quyền trích tiền ở ví nếu có.">
                Rời dây
              </ActionButton>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { formatBps, formatUsdc, previewCircle } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { TxNotice, useTx } from '@/components/chain/useTx';
import { RepBadge, RepDisclaimer } from '@/components/circle/RepBadge';
import { RiskTable } from '@/components/circle/RiskTable';
import { LedgerList } from '@/components/LedgerList';
import { useToast } from '@/components/shell/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { TermsBox } from '@/components/circle/TermsBox';
import { CommissionTable } from '@/components/wizard/CommissionTable';
import { termsViewOf } from '@/lib/live/terms';
import { capOf } from '@/lib/hui-calc';
import { ErrorState } from '@/components/app/parts';
import { Missing, PageSkeleton } from '@/components/circle/CircleScreen';
import { useCircleData } from '@/lib/live/useCircleData';
import { useMinCoverageBps } from '@/lib/live/useMinCoverage';
import type { SampleCircleData } from '@/lib/sample-circles';

const REVEAL_BOND_BPS = 100n;

/** `/moi/[id]`: loads the circle (sample or chain) and shows its invite page. */
export function InviteScreen({ id }: { id: string }) {
  const d = useCircleData(id);
  // Same four states as a circle's pages (B22f): skeleton, error with retry, "not found", data.
  if (d.status === 'loading') return <PageSkeleton />;
  if (d.status === 'error') return <ErrorState text={d.message} onRetry={() => window.location.reload()} />;
  if (d.status !== 'ready') return <Missing />;
  return <InviteView c={d.data} />;
}

/**
 * S05: the page a person opens from an invite link. It answers four questions before asking for anything: what is this
 * circle, who runs it, what is the worst that can happen to me, and what exactly am I agreeing to (text + its hash).
 */
export function InviteView({ c: C }: { c: SampleCircleData }) {
  const router = useRouter();
  const tx = useTx();
  const live = C.live;
  const terms = termsViewOf(C);
  const { show } = useToast();
  const [agreed, setAgreed] = useState(false);
  const box = useRef<HTMLButtonElement>(null);
  const t = C.terms;
  const n = Number(t.n);
  const joined = C.seats.filter((s) => s.joined);
  const left = n - joined.length;
  const mySeat = joined.length + 1;
  const floor = useMinCoverageBps(live?.address);
  const preview = previewCircle({ n: t.n, c: t.c, periodDays: t.periodDays, alphaBps: t.alphaBps, bond: C.bond, capBps: t.capBps, minCoverageBps: floor });
  const allowance = live ? live.view.requiredAllowance : (t.n - 1n) * (t.c + (t.c * REVEAL_BOND_BPS) / 10_000n);
  const open = !live || live.view.state === 'forming';
  const already = live ? C.viewer >= 0 : false;

  const join = () => {
    if (!agreed) {
      show('Hãy tích ô xác nhận đủ 18 tuổi và đồng ý luật dây trước khi vào dây.', 'error');
      box.current?.scrollIntoView({ block: 'center' });
      box.current?.focus();
      return;
    }
    if (!live) {
      router.push(`/dang-nhap?tiep=/moi/${C.id}`);
      return;
    }
    void tx.run((a) => a.join(live.address, { ageConfirmed: true })).then((r) => {
      if (r?.ok) router.push(`/circles/${live.address}`);
    });
  };

  return (
    <main id="noi-dung" className="pg">
      <h1 className="font-display text-h1 font-bold">Lời mời vào dây {C.label}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Còn {left} chỗ</Badge>
        <Badge variant="secondary">{t.mode === 'fixed' ? 'Cố định' : 'Bỏ thăm'}</Badge>
        {!live && <Badge variant="secondary">Dữ liệu mẫu</Badge>}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start [&>*]:min-w-0">
        <section aria-labelledby="tom-tat" className="to-giay p-6 md:p-8">
          <h2 id="tom-tat" className="font-display text-h2 font-bold">
            Dây này là gì
          </h2>
          <p className="so-ke mt-2 text-lead">
            {n} người, mỗi kỳ ({t.periodDays} ngày) góp <strong>{formatUsdc(t.c)}</strong>. Mỗi kỳ một người nhận cả hũ, ai cũng hốt đúng một lần.
          </p>
          <LedgerList
            className="mt-3"
            items={[
              { label: 'Đã vào / còn chỗ', value: `${joined.length} / ${left}` },
              { label: 'Hạn vào dây', value: <Countdown seconds={C.joinSecondsLeft ?? 0} /> },
              { label: 'Ký quỹ chủ hụi đã khóa', value: formatUsdc(C.bond) },
              { label: 'Chỉ số bảo chứng tối thiểu', value: formatBps(preview.coverageBps) },
              { label: 'Tiền giữ lại khi bạn hốt', value: formatBps(t.alphaBps) },
              { label: 'Trần thăm kỳ 1', value: formatUsdc(capOf(t, 1)) },
              ...(t.feeBps > 0n
                ? [{ label: 'Hoa hồng chủ hụi', value: (t.shareBps ?? 0n) > 0n ? `${formatBps(t.shareBps!)} quỹ lãi mỗi kỳ, tối đa ${formatBps(t.feeBps)} tiền hốt` : `${formatBps(t.feeBps)} tiền hốt mỗi kỳ` }]
                : []),
              { label: 'Ân hạn trả trễ', value: '48 giờ' },
            ]}
          />
        </section>

        <section aria-labelledby="chu-hui" className="o-phang p-6">
          <h2 id="chu-hui" className="font-display text-h3 font-bold">
            Chủ hụi và người đã vào
          </h2>
          <ul className="mt-2">
            <li className="dong-ke flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="font-semibold">Chủ hụi {C.organizerAddr}</span>
              <RepBadge rep={C.organizerRep} who="organizer" showNext />
            </li>
            {joined.map((s, i) => (
              <li key={i} className="dong-ke flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 last:border-b-0">
                <span className="font-semibold">{s.organizer ? 'Thành viên 1 (cũng là chủ hụi)' : s.name}</span>
                <RepBadge rep={s.rep} />
              </li>
            ))}
          </ul>
          <RepDisclaimer className="mt-3" />
        </section>
      </div>

      <section aria-labelledby="luat" className="mt-10">
        <h2 id="luat" className="font-display text-h2 font-bold">
          Luật chính
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-lead">
          <li>Chủ hụi không cầm tiền của bạn. Mỗi kỳ chỉ trích đúng phần góp từ ví của bạn, chi thẳng cho người hốt.</li>
          <li>Chủ hụi phải khóa ký quỹ để bảo lãnh. Người đã hốt mà bỏ đóng thì ký quỹ bù cho người hốt sau.</li>
          <li>Người hốt bị giữ lại {formatBps(t.alphaBps)} tiền hốt, đóng đủ thì nhận lại hết.</li>
          <li>Thăm cao nhất hốt, không có may rủi. Bằng nhau thì người ít lần trễ hơn, rồi ai nộp trước.</li>
          <li>Rời dây được trước khi dây bắt đầu. Rời rồi thì không vào lại.</li>
        </ul>
      </section>

      {t.mode === 'bidding' && (t.shareBps ?? 0n) > 0n && t.feeBps > 0n && (
        // phi > 0: the same per-round table as the create form, read from the circle, so the newcomer sees the organizer's share before joining
        <section aria-label="Hoa hồng của chủ hụi theo từng kỳ" className="mt-10">
          <CommissionTable terms={t} />
        </section>
      )}

      <RiskTable terms={t} bond={C.bond} highlight={mySeat <= n ? mySeat : undefined} className="mt-10" />
      <p className="mt-2 text-muted-foreground">Chỗ của bạn trong bảng là chỗ đang trống kế tiếp (kỳ {mySeat}); kiểu bỏ thăm thì kỳ hốt của bạn do thăm quyết định.</p>

      <section aria-labelledby="thoa-thuan" className="mt-10">
        <h2 id="thoa-thuan" className="font-display text-h2 font-bold">
          Thỏa thuận bạn đồng ý
        </h2>
        <div className="mt-3">
          <TermsBox view={terms} source={live ? 'chain' : 'sample'} />
        </div>
      </section>

      <section aria-labelledby="vao" className="to-giay mt-10 p-6 md:p-8">
        <h2 id="vao" className="font-display text-h2 font-bold">
          Vào dây
        </h2>
        <p className="so-ke mt-2 text-lead">
          Bạn ký một lần để cho phép dây trích tối đa {formatUsdc(allowance)} trong cả dây (mỗi kỳ chỉ trích phần góp). Không cần ví riêng, không cần AVAX.
        </p>
        <Field orientation="horizontal" className="mt-3">
          <Checkbox id="dong-y" ref={box} checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
          <FieldLabel htmlFor="dong-y" className="min-h-12 flex-1 items-center font-normal">
            Tôi đủ 18 tuổi và đồng ý luật dây
          </FieldLabel>
        </Field>
        {!open ? (
          <p role="status" className="mt-3 font-semibold">Dây này không còn nhận người vào.</p>
        ) : already ? (
          <p role="status" className="mt-3 font-semibold">
            Bạn đã ở trong dây này.{' '}
            <a href={`/circles/${C.id}`} className="text-primary underline underline-offset-4">Mở dây</a>
          </p>
        ) : (
          <>
            <Button type="button" size="lg" className="mt-3" onClick={join} disabled={tx.pending || terms.check === 'mismatch'} aria-describedby={terms.check === 'mismatch' ? 'vao-khong-khop' : undefined}>
              {tx.pending ? 'Đang gửi…' : 'Vào dây'}
            </Button>
            {terms.check === 'mismatch' && (
              <p id="vao-khong-khop" className="mt-2 font-semibold text-state-bad">
                Nút vào dây tắt vì thỏa thuận không khớp mã băm trên mạng.
              </p>
            )}
          </>
        )}
        <TxNotice state={tx} chainId={tx.chainId} success="Bạn đã vào dây." needed={allowance} />
        {!live && <p className="mt-2 text-muted-foreground">Bạn sẽ đăng nhập ở bước sau. Hiện là màn hình mẫu, chưa có gì được gửi đi.</p>}
      </section>
    </main>
  );
}

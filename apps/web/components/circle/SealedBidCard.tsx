'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { formatUsdc, parseUsdc } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { Seal } from '@/components/brand/Seal';
import { ActionButton } from '@/components/chain/ActionButton';
import { TxNotice, useTx } from '@/components/chain/useTx';
import type { Phase } from '@/components/circle/RoundTimeline';
import { SoonButton } from '@/components/shell/SoonButton';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { commitBlocker, eligibilityBlocker } from '@/lib/live/bidEligibility';
import { useMyCommit } from '@/lib/live/useMyCommit';
import type { SampleCircleData } from '@/lib/sample-circles';

interface Props {
  phase: Phase;
  round: number;
  /** Ceiling for this round in USDC base units (docs/03 section 2.4). */
  maxBid: bigint;
  revealBond: bigint;
  /** Seconds left in the commit window (sample). */
  commitSeconds?: number;
  /** Chain data: the commit / reveal / settle buttons send real transactions. Without it the card is a sample. */
  c?: SampleCircleData;
}

/** The bid room. On sample data state is local and nothing is sent; on chain data every button sends its transaction. */
export function SealedBidCard({ phase, round, maxBid, revealBond, commitSeconds = 74, c }: Props) {
  return c?.live ? <LiveCard c={c} phase={phase} round={round} maxBid={maxBid} revealBond={revealBond} /> : <SampleCard phase={phase} round={round} maxBid={maxBid} revealBond={revealBond} commitSeconds={commitSeconds} />;
}

function BidForm({ maxBid, revealBond, onSeal, busy, disabledReason, text, setText }: { maxBid: bigint; revealBond: bigint; onSeal: (bid: bigint) => void; busy?: boolean; disabledReason?: string; text: string; setText: (v: string) => void }) {
  const bid = parseUsdc(text);
  const error = bid === undefined ? 'Nhập thăm bằng số, ví dụ 2 hoặc 1,5.' : bid > maxBid ? `Thăm tối đa kỳ này là ${formatUsdc(maxBid)}.` : undefined;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (bid !== undefined && !error) onSeal(bid);
      }}
      noValidate
      className="mt-4 space-y-4"
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="bid">Tiền thăm mỗi phần hụi trả bớt</FieldLabel>
        <div className="flex items-center gap-2">
          <Input id="bid" inputMode="decimal" autoComplete="off" className="so-ke max-w-40 text-right text-lg" value={text} aria-invalid={error ? true : undefined} aria-describedby={`bid-hint ${error ? 'bid-err' : ''}`} onChange={(e) => setText(e.target.value)} />
          <span className="text-lg">USDC</span>
        </div>
        <FieldDescription id="bid-hint">Thăm cao nhất được hốt. Tối đa {formatUsdc(maxBid)} (trần lãi 20%/năm). Cọc mở thăm {formatUsdc(revealBond)}, trả lại khi mở thăm.</FieldDescription>
        {error && <FieldError id="bid-err">{error}</FieldError>}
      </Field>
      <Button type="submit" size="lg" disabled={!!error || busy || !!disabledReason}>
        <Lock aria-hidden className="size-5" /> Niêm phong thăm
      </Button>
      {disabledReason && <p className="text-muted-foreground">{disabledReason}</p>}
    </form>
  );
}

function SealedNote({ onEdit }: { onEdit?: () => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-5">
      <Seal key="s" size={104} center="Kín" ring="ĐÃ NIÊM PHONG · THĂM KÍN · " className="dau-xuong text-le-do" />
      <div className="min-w-0 flex-1">
        <p className="text-xl font-semibold">Đã niêm phong thăm của bạn.</p>
        <p className="text-muted-foreground">Không ai thấy được con số này cho đến giờ mở thăm. Bạn vẫn sửa được trước khi hết giờ nộp.</p>
        {onEdit && (
          <Button type="button" variant="outline" size="lg" className="mt-3" onClick={onEdit}>
            Sửa thăm
          </Button>
        )}
      </div>
    </div>
  );
}

function SampleCard({ phase, round, maxBid, revealBond, commitSeconds }: Required<Omit<Props, 'c'>>) {
  const [sealed, setSealed] = useState<bigint | undefined>();
  const [opened, setOpened] = useState(false);
  const [text, setText] = useState('2');
  return (
    <section aria-labelledby="bid-title" className="to-giay p-6">
      <h3 id="bid-title" className="font-display text-h3 font-bold">
        Thăm của bạn, kỳ {round}
      </h3>

      {phase === 'commit' && !sealed && <BidForm maxBid={maxBid} revealBond={revealBond} onSeal={setSealed} text={text} setText={setText} />}
      {phase === 'commit' && sealed !== undefined && <SealedNote onEdit={() => setSealed(undefined)} />}

      {phase === 'reveal' && (
        <div className="mt-4">
          <p className="text-xl">Đến giờ mở thăm. Bấm để mở thăm đã niêm phong của bạn và nhận lại cọc {formatUsdc(revealBond)}.</p>
          {opened && sealed !== undefined ? (
            <p role="status" className="so-ke mt-3 rounded-xl border-2 border-ngoc bg-ngoc/10 p-4 text-xl font-semibold text-ngoc">
              Đã mở thăm của bạn: {formatUsdc(sealed)} mỗi phần. Cọc {formatUsdc(revealBond)} đã được trả lại (mẫu).
            </p>
          ) : opened ? (
            <p role="status" className="mt-3 rounded-xl border-2 border-destructive bg-card p-4 text-xl font-semibold text-destructive">
              Bạn chưa niêm phong thăm ở giai đoạn nộp, nên không có thăm để mở. Quên nộp thì không mất gì; quên mở thăm đã nộp thì mất cọc.
            </p>
          ) : (
            <Button type="button" size="lg" className="mt-3" onClick={() => setOpened(true)}>Mở thăm của tôi</Button>
          )}
          <p className="mt-2 text-muted-foreground">Quên mở thì mất cọc vào quỹ dự phòng.</p>
        </div>
      )}

      {phase === 'settle' && (
        <div className="mt-4">
          <p className="text-xl">Đã mở xong. Chờ chốt kỳ: ai cũng bấm được, không cần chờ chủ hụi.</p>
          <SoonButton size="lg" className="mt-3" message={`Chốt kỳ ${round} cần nối mạng để trích phần góp của mọi người. Hiện là màn hình mẫu, chưa chốt gì.`}>
            Chốt kỳ {round}
          </SoonButton>
        </div>
      )}

      <p className="mt-5 border-t border-border pt-3 text-muted-foreground">
        {phase === 'commit' && <>Hết giờ nộp thăm sau <Countdown seconds={commitSeconds} className="font-semibold text-foreground" />.</>}
        {phase === 'reveal' && <>Hết giờ mở thăm sau <Countdown seconds={48} className="font-semibold text-foreground" />.</>}
        {phase === 'settle' && <>Kỳ {round} chốt được từ bây giờ.</>}
        {' '}Dữ liệu mẫu.
      </p>
    </section>
  );
}

function LiveCard({ c, phase, round, maxBid, revealBond }: { c: SampleCircleData; phase: Phase; round: number; maxBid: bigint; revealBond: bigint }) {
  const live = c.live!;
  const view = live.view;
  const rv = view.rounds.find((r) => r.k === round);
  const nowSec = Math.floor(live.nowMs / 1000);
  const me = live.viewerAddress;
  const commit = useMyCommit(live.address, round, me);
  const tx = useTx();
  const [text, setText] = useState('2');
  const mine = commit.data;

  const ineligible = eligibilityBlocker(view, me);
  const cannotCommit = commitBlocker(view, me);

  const onSeal = (bid: bigint) => void tx.run((a) => a.commitBid(live.address, round, bid));
  const until = phase === 'commit' ? rv?.commitEndsAt : phase === 'reveal' ? rv?.revealEndsAt : rv?.deadline;
  const left = until !== undefined ? Math.max(0, until - nowSec) : 0;
  const settleOpen = rv !== undefined && nowSec >= rv.deadline;

  return (
    <section aria-labelledby="bid-title" className="to-giay p-6">
      <h3 id="bid-title" className="font-display text-h3 font-bold">
        Thăm của bạn, kỳ {round}
      </h3>

      {phase === 'commit' &&
        (mine?.committed ? (
          <>
            <SealedNote />
            {!mine.saltOnDevice && (
              <p role="alert" className="mt-3 text-state-bad">
                Máy này không còn mã bí mật của thăm. Nếu bạn nộp từ máy khác, nạp file sao lưu ở mục Cài đặt, nếu không sẽ không mở thăm được và mất cọc.
              </p>
            )}
            <p className="mt-3 text-muted-foreground">Muốn đổi số, nộp lại thăm mới trước khi hết giờ nộp (cọc giữ nguyên).</p>
            <BidForm maxBid={maxBid} revealBond={revealBond} onSeal={onSeal} busy={tx.pending} disabledReason={cannotCommit} text={text} setText={setText} />
          </>
        ) : (
          <BidForm maxBid={maxBid} revealBond={revealBond} onSeal={onSeal} busy={tx.pending} disabledReason={cannotCommit} text={text} setText={setText} />
        ))}

      {phase === 'reveal' && (
        <div className="mt-4">
          <p className="text-xl">Đến giờ mở thăm. Bấm để mở thăm đã niêm phong của bạn và nhận lại cọc {formatUsdc(revealBond)}.</p>
          {mine?.revealed ? (
            <p role="status" className="so-ke mt-3 rounded-xl border-2 border-ngoc bg-ngoc/10 p-4 text-xl font-semibold text-ngoc">
              Đã mở thăm của bạn: {formatUsdc(mine.bid)} mỗi phần. Cọc {formatUsdc(revealBond)} đã được trả lại.
            </p>
          ) : mine && !mine.committed ? (
            <p role="status" className="mt-3 rounded-xl border-2 border-destructive bg-card p-4 text-xl font-semibold text-destructive">
              Bạn chưa niêm phong thăm ở giai đoạn nộp, nên không có thăm để mở. Quên nộp thì không mất gì; quên mở thăm đã nộp thì mất cọc.
            </p>
          ) : (
            <Button type="button" size="lg" className="mt-3" disabled={tx.pending || !!ineligible} onClick={() => void tx.run((a) => a.revealBid(live.address, round))}>
              {tx.pending ? 'Đang gửi…' : 'Mở thăm của tôi'}
            </Button>
          )}
          {ineligible && !mine?.committed && <p className="mt-2 text-muted-foreground">{ineligible}</p>}
          <p className="mt-2 text-muted-foreground">Quên mở thì mất cọc vào quỹ dự phòng.</p>
        </div>
      )}

      {phase === 'settle' && (
        <div className="mt-4">
          <p className="text-xl">Đã mở xong. Chờ chốt kỳ: ai cũng bấm được, không cần chờ chủ hụi.</p>
          {settleOpen ? (
            <ActionButton size="lg" className="mt-3" run={(a) => a.settleRound(live.address)} success={`Đã chốt kỳ ${round}.`}>
              Chốt kỳ {round}
            </ActionButton>
          ) : (
            <p className="mt-3 text-muted-foreground">Chốt kỳ bấm được sau giờ chốt, còn <Countdown seconds={left} className="font-semibold text-foreground" />.</p>
          )}
        </div>
      )}

      <TxNotice state={tx} chainId={tx.chainId} success={phase === 'commit' ? 'Đã niêm phong thăm.' : 'Đã mở thăm.'} />

      <p className="mt-5 border-t border-border pt-3 text-muted-foreground">
        {phase === 'commit' && <>Hết giờ nộp thăm sau <Countdown seconds={left} className="font-semibold text-foreground" />.</>}
        {phase === 'reveal' && <>Hết giờ mở thăm sau <Countdown seconds={left} className="font-semibold text-foreground" />.</>}
        {phase === 'settle' && <>Giờ chốt kỳ {round} {settleOpen ? 'đã tới' : 'chưa tới'}.</>}
      </p>
    </section>
  );
}

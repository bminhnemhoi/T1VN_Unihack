'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { formatUsdc, parseUsdc } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { Seal } from '@/components/brand/Seal';
import type { Phase } from '@/components/circle/RoundTimeline';
import { SoonButton } from '@/components/shell/SoonButton';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface Props {
  phase: Phase;
  round: number;
  /** Ceiling for this round in USDC base units (docs/03 section 2.4). */
  maxBid: bigint;
  revealBond: bigint;
}

/** Mock of the bid room. State is local; nothing is sent anywhere. */
export function SealedBidCard({ phase, round, maxBid, revealBond }: Props) {
  const [text, setText] = useState('2');
  const [sealed, setSealed] = useState<bigint | undefined>();
  const [opened, setOpened] = useState(false);
  const bid = parseUsdc(text);
  const error = bid === undefined ? 'Nhập thăm bằng số, ví dụ 2 hoặc 1,5.' : bid > maxBid ? `Thăm tối đa kỳ này là ${formatUsdc(maxBid)}.` : undefined;

  return (
    <section aria-labelledby="bid-title" className="to-giay p-6">
      <h2 id="bid-title" className="font-display text-3xl font-bold">
        Thăm của bạn, kỳ {round}
      </h2>

      {phase === 'commit' && !sealed && (
        <form onSubmit={(e) => { e.preventDefault(); if (bid !== undefined && !error) setSealed(bid); }} noValidate className="mt-4 space-y-4">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="bid">Tiền thăm mỗi phần hụi trả bớt</FieldLabel>
            <div className="flex items-center gap-2">
              <Input id="bid" inputMode="decimal" autoComplete="off" className="so-ke max-w-40 text-right text-lg" value={text} aria-invalid={error ? true : undefined} aria-describedby={`bid-hint ${error ? 'bid-err' : ''}`} onChange={(e) => setText(e.target.value)} />
              <span className="text-lg">USDC</span>
            </div>
            <FieldDescription id="bid-hint">Thăm cao nhất được hốt. Tối đa {formatUsdc(maxBid)} (trần lãi 20%/năm). Cọc mở thăm {formatUsdc(revealBond)}, trả lại khi mở thăm.</FieldDescription>
            {error && <FieldError id="bid-err">{error}</FieldError>}
          </Field>
          <Button type="submit" size="lg" disabled={!!error}>
            <Lock aria-hidden className="size-5" /> Niêm phong thăm
          </Button>
        </form>
      )}

      {phase === 'commit' && sealed !== undefined && (
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <Seal key="s" size={104} center="Kín" ring="ĐÃ NIÊM PHONG · THĂM KÍN · " className="dau-xuong text-le-do" />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold">Đã niêm phong thăm của bạn.</p>
            <p className="text-muted-foreground">Không ai thấy được con số này cho đến giờ mở thăm. Bạn vẫn sửa được trước khi hết giờ nộp.</p>
            <Button type="button" variant="outline" size="lg" className="mt-3" onClick={() => setSealed(undefined)}>
              Sửa thăm
            </Button>
          </div>
        </div>
      )}

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
        {phase === 'commit' && <>Hết giờ nộp thăm sau <Countdown seconds={74} className="font-semibold text-foreground" />.</>}
        {phase === 'reveal' && <>Hết giờ mở thăm sau <Countdown seconds={48} className="font-semibold text-foreground" />.</>}
        {phase === 'settle' && <>Kỳ {round} chốt được từ bây giờ.</>}
        {' '}Dữ liệu mẫu.
      </p>
    </section>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { formatBps, formatUsdc, previewCircle } from 'sdk';
import { Countdown } from '@/components/brand/Countdown';
import { RepBadge, RepDisclaimer } from '@/components/circle/RepBadge';
import { RiskTable } from '@/components/circle/RiskTable';
import { LedgerList } from '@/components/LedgerList';
import { useToast } from '@/components/shell/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { agreementClauses, agreementHash } from '@/lib/agreement';
import { capOf } from '@/lib/hui-calc';
import { getSampleCircle } from '@/lib/sample-circles';

const C = getSampleCircle('dang-gom');
const REVEAL_BOND_BPS = 100n;

/**
 * S05: the page a person opens from an invite link. It answers four questions before asking for anything: what is this
 * circle, who runs it, what is the worst that can happen to me, and what exactly am I agreeing to (text + its hash).
 */
export function InviteView() {
  const router = useRouter();
  const { show } = useToast();
  const [agreed, setAgreed] = useState(false);
  const box = useRef<HTMLButtonElement>(null);
  const t = C.terms;
  const n = Number(t.n);
  const joined = C.seats.filter((s) => s.joined);
  const left = n - joined.length;
  const mySeat = joined.length + 1;
  const preview = previewCircle({ n: t.n, c: t.c, periodDays: t.periodDays, alphaBps: t.alphaBps, bond: C.bond, capBps: t.capBps });
  const allowance = (t.n - 1n) * (t.c + (t.c * REVEAL_BOND_BPS) / 10_000n);

  const join = () => {
    if (!agreed) {
      show('Hãy tích ô xác nhận đủ 18 tuổi và đồng ý luật dây trước khi vào dây.', 'error');
      box.current?.scrollIntoView({ block: 'center' });
      box.current?.focus();
      return;
    }
    router.push('/dang-nhap?tiep=/moi/dang-gom');
  };

  return (
    <main id="noi-dung" className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-h1 font-bold">Lời mời vào dây {C.label}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Còn {left} chỗ</Badge>
        <Badge variant="secondary">{t.mode === 'fixed' ? 'Cố định' : 'Bỏ thăm'}</Badge>
        <Badge variant="secondary">Dữ liệu mẫu</Badge>
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

      <RiskTable terms={t} bond={C.bond} highlight={mySeat <= n ? mySeat : undefined} className="mt-10" />
      <p className="mt-2 text-muted-foreground">Chỗ của bạn trong bảng là chỗ đang trống kế tiếp (kỳ {mySeat}); kiểu bỏ thăm thì kỳ hốt của bạn do thăm quyết định.</p>

      <section aria-labelledby="thoa-thuan" className="mt-10">
        <h2 id="thoa-thuan" className="font-display text-h2 font-bold">
          Thỏa thuận bạn đồng ý
        </h2>
        <details className="o-phang mt-3 p-5">
          <summary className="min-h-12 cursor-pointer py-2 font-semibold">Đọc toàn văn thỏa thuận ({agreementClauses(C).length} điều)</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-6">
            {agreementClauses(C).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        </details>
        <p className="mt-3 text-muted-foreground">Mã băm của đúng văn bản trên (sẽ được ghi lên mạng khi tạo dây thật, để không ai sửa lén được):</p>
        <p className="so-ke mt-1 rounded-lg bg-secondary p-3 break-all" data-testid="agreement-hash">
          {agreementHash(C)}
        </p>
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
        <Button type="button" size="lg" className="mt-3" onClick={join}>
          Vào dây
        </Button>
        <p className="mt-2 text-muted-foreground">Bạn sẽ đăng nhập ở bước sau. Hiện là màn hình mẫu, chưa có gì được gửi đi.</p>
      </section>
    </main>
  );
}

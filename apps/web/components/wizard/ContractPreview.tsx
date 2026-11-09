import { formatBps, formatUsdc, type Preview } from 'sdk';
import { Seal } from '@/components/brand/Seal';
import { LedgerList } from '@/components/LedgerList';
import type { FormState, Valid } from '@/lib/circleForm';

/** Faint guilloché-style line pattern (direction B borrowed lightly): concentric sine bands, 6% ink. */
const GUILLOCHE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'><path d='M0 20 Q15 0 30 20 T60 20 T90 20 T120 20' fill='none' stroke='%2311203f' stroke-opacity='.07' stroke-width='1'/><path d='M0 20 Q15 40 30 20 T60 20 T90 20 T120 20' fill='none' stroke='%2311203f' stroke-opacity='.07' stroke-width='1'/></svg>\")";

/** Step-3 summary: what the circle will be, in a paper "hợp đồng" with a seal once coverage is enough. */
export function ContractPreview({ form, value, preview }: { form: FormState; value: Valid; preview: Preview }) {
  const bidding = form.mode === 'bidding';
  return (
    <article aria-labelledby="hd-title" className="to-giay to-giay-nang relative overflow-hidden p-6 md:p-8" style={{ backgroundImage: GUILLOCHE }}>
      <header className="flex items-start justify-between gap-4 border-b-2 border-double border-foreground pb-4">
        <div>
          <p className="text-muted-foreground">Bản xem trước, chưa tạo dây</p>
          <h2 id="hd-title" className="font-display text-3xl font-bold">
            Giao kèo dây hụi
          </h2>
        </div>
        {preview.canActivate ? (
          <Seal key="dau" size={84} center="Đủ" ring="ĐỦ BẢO CHỨNG · BẮT ĐẦU DÂY · " className="dau-xuong shrink-0 text-ngoc" />
        ) : (
          <p className="max-w-32 shrink-0 -rotate-3 rounded border-2 border-dashed border-nghe-fg px-2 py-1 text-center font-semibold text-nghe-fg">Chưa đủ bảo chứng</p>
        )}
      </header>
      <LedgerList
        className="mt-2"
        items={[
          { label: 'Kiểu chia', value: bidding ? 'Bỏ thăm' : 'Cố định (hốt lần lượt)' },
          { label: 'Số phần hụi', value: `${value.n} phần` },
          { label: 'Mức góp mỗi kỳ', value: formatUsdc(value.c) },
          { label: 'Chu kỳ', value: `${value.periodDays === 7n ? 'Tuần, ' : value.periodDays === 30n ? 'Tháng, ' : ''}${value.periodDays} ngày` },
          { label: 'Tiền giữ lại của người hốt', value: formatBps(value.alphaBps) },
          { label: 'Ký quỹ của chủ hụi', value: formatUsdc(value.bond) },
          { label: 'Quỹ dự phòng', value: formatBps(value.reserveBps) },
          { label: 'Tiền công chủ hụi', value: form.commission ? formatBps(value.feeBps) : 'Không có' },
          { label: 'Chỉ số bảo chứng', value: formatBps(preview.coverageBps) },
        ]}
      />
      <p className="mt-4 font-hand text-2xl text-primary">Sau khi tạo, không số nào đổi được.</p>
    </article>
  );
}

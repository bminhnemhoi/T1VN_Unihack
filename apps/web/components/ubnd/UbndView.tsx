'use client';

import { Copy, Printer } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import { useToast } from '@/components/shell/Toast';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { UBND_PLACEHOLDERS, ubndNoticeMarkdown } from '@/lib/copilot/rules/ubnd';

const CIRCLE_SLOT = '[ĐỊA CHỈ HỢP ĐỒNG CỦA DÂY]';
const LABEL: Record<(typeof UBND_PLACEHOLDERS)[number], string> = {
  '[HỌ TÊN]': 'Họ và tên',
  '[SỐ GIẤY TỜ]': 'Số giấy tờ tùy thân',
  '[NGÀY SINH]': 'Ngày sinh',
  '[NƠI CƯ TRÚ]': 'Nơi cư trú',
};

/** Fills the template with what the person typed. Empty fields keep their bracket, shown highlighted so nothing is missed. */
function fill(markdown: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [slot, v]) => (v.trim() ? text.split(slot).join(v.trim()) : text), markdown);
}

function mark(line: string): ReactNode {
  return line.split(/(\[[^\]]+\])/).map((part, i) =>
    /^\[[^\]]+\]$/.test(part) ? (
      <mark key={i} className="rounded bg-state-warn-bg px-1 text-state-warn">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** S15: nothing typed here leaves the device. The text is deterministic (no AI), the same one the assistant's `draft_ubnd_notice` tool returns. */
export function UbndView() {
  const { show } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const slots = [...UBND_PLACEHOLDERS, CIRCLE_SLOT];
  const md = fill(ubndNoticeMarkdown(CIRCLE_SLOT), values);
  const lines = md.split('\n');
  const missing = slots.filter((s) => md.includes(s));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(md);
      show(missing.length ? `Đã sao chép bản nháp. Còn ${missing.length} ô chưa điền.` : 'Đã sao chép bản nháp.');
    } catch {
      show('Máy không cho sao chép tự động. Hãy bôi đen và chép tay.', 'error');
    }
  };

  return (
    <main id="noi-dung" className="pg">
      <h1 className="font-display text-h1 font-bold">Thông báo gửi UBND</h1>
      <p className="mt-2 max-w-prose text-lead text-muted-foreground">
        Nghị định 19 Điều 14 yêu cầu chủ hụi thông báo bằng văn bản cho UBND cấp xã khi đã có dây khác đang chạy, hoặc khi giá trị một kỳ từ 100.000.000 đ trở lên. Đây là mẫu tham khảo, cần luật sư xác nhận trước khi nộp.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_3fr] lg:items-start [&>*]:min-w-0">
        <section aria-labelledby="dien" className="to-giay p-6">
          <h2 id="dien" className="font-display text-h3 font-bold">
            Điền thông tin của bạn
          </h2>
          <p className="mt-1 text-muted-foreground">Bạn gõ ở đây thì chỉ nằm trên máy này. Không gửi lên máy chủ, không đưa cho trợ lý AI.</p>
          <div className="mt-4 space-y-4">
            {slots.map((slot) => (
              <Field key={slot}>
                <FieldLabel htmlFor={`o-${slot}`}>{slot === CIRCLE_SLOT ? 'Địa chỉ hợp đồng của dây' : LABEL[slot as keyof typeof LABEL]}</FieldLabel>
                <Input id={`o-${slot}`} autoComplete="off" value={values[slot] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [slot]: e.target.value }))} />
              </Field>
            ))}
          </div>
        </section>

        <section aria-labelledby="ban-nhap" className="o-phang p-6">
          <h2 id="ban-nhap" className="font-display text-h3 font-bold">
            Bản nháp
          </h2>
          <p role="status" className="mt-1 text-muted-foreground">
            {missing.length ? `Còn ${missing.length} ô chưa điền (tô vàng).` : 'Đã điền đủ các ô.'}
          </p>
          <div className="mt-3 space-y-2 rounded-lg bg-background p-4 print:bg-white" data-testid="ubnd-draft">
            {lines.map((l, i) =>
              l === '' ? null : l.startsWith('# ') ? (
                <h3 key={i} className="font-display text-h3 font-bold">{mark(l.slice(2))}</h3>
              ) : l.startsWith('## ') ? (
                <h4 key={i} className="mt-3 font-semibold">{mark(l.slice(3))}</h4>
              ) : l.startsWith('- ') ? (
                <p key={i} className="pl-4">• {mark(l.slice(2))}</p>
              ) : l.startsWith('> ') ? (
                <p key={i} className="text-muted-foreground italic">{mark(l.slice(2))}</p>
              ) : (
                <p key={i}>{mark(l)}</p>
              ),
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" size="lg" onClick={copy}>
              <Copy aria-hidden className="size-5" /> Sao chép bản nháp
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden className="size-5" /> In
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

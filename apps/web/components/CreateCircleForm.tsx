'use client';

import { useMemo, useState } from 'react';
import { formatUsdc, previewCircle } from 'sdk';
import { BidTable } from '@/components/BidTable';
import { CoverageMeter } from '@/components/CoverageMeter';
import { Nd19Panel } from '@/components/Nd19Panel';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DEFAULTS, validateForm, type FieldName, type FormState } from '@/lib/circleForm';
import { vi } from '@/lib/vi';

interface NumberFieldProps {
  id: FieldName;
  label: string;
  hint?: string;
  unit: string;
  value: string;
  error?: string;
  disabled?: boolean;
  decimal?: boolean;
  onChange: (v: string) => void;
}

/** One labelled number input with a unit suffix and an error line. */
function NumberField({ id, label, hint, unit, value, error, disabled, decimal, onChange }: NumberFieldProps) {
  const described = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <Field data-invalid={error ? true : undefined} data-disabled={disabled ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode={decimal ? 'decimal' : 'numeric'}
          autoComplete="off"
          className="so-ke max-w-40 text-right text-lg"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-lg">{unit}</span>
      </div>
      {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </Field>
  );
}

/** S03 body: CircleParams form on the left, live numbers on the right (docs/02 US-01). No chain calls. */
export function CreateCircleForm() {
  const [f, setF] = useState<FormState>(DEFAULTS);
  const [over18, setOver18] = useState(false);
  const [hasActive, setHasActive] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const { value, errors } = useMemo(() => validateForm(f), [f]);
  const preview = useMemo(
    () =>
      value
        ? previewCircle({ n: value.n, c: value.c, periodDays: value.periodDays, alphaBps: value.alphaBps, bond: value.bond, capBps: 2000n })
        : undefined,
    [value],
  );
  const bidding = f.mode === 'bidding';

  return (
    <div className="grid grid-cols-1 gap-8 pb-28 lg:grid-cols-[3fr_2fr] lg:gap-12 lg:pb-0 [&>*]:min-w-0">
      <form className="le-vo" onSubmit={(e) => e.preventDefault()} noValidate aria-label="Thông tin dây hụi">
        <FieldGroup className="gap-8">
          <FieldSet>
            <FieldLegend className="data-[variant=legend]:text-2xl font-bold">Dây hụi</FieldLegend>
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel id="mode-label">Kiểu họ</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={f.mode}
                  onValueChange={(v) => v && set('mode', v as FormState['mode'])}
                  aria-labelledby="mode-label"
                  className="flex-wrap"
                >
                  <ToggleGroupItem value="bidding">Bỏ thăm (họ có lãi)</ToggleGroupItem>
                  <ToggleGroupItem value="fixed">Hốt lần lượt (họ không lãi)</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <NumberField id="n" label="Số phần hụi" hint="Mỗi người một phần, từ 3 đến 30." unit="phần" value={f.n} error={errors.n} onChange={(v) => set('n', v)} />
              <NumberField id="c" label="Mức góp mỗi kỳ" unit="USDC" value={f.c} error={errors.c} decimal onChange={(v) => set('c', v)} />
              <NumberField id="periodDays" label="Độ dài một kỳ" hint="Dùng để tính trần lãi và lãi chậm góp." unit="ngày" value={f.periodDays} error={errors.periodDays} onChange={(v) => set('periodDays', v)} />
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend className="data-[variant=legend]:text-2xl font-bold">Bảo chứng</FieldLegend>
            <FieldGroup className="gap-5">
              <NumberField id="alpha" label="Tiền giữ lại của người hốt" hint={vi.help.holdback} unit="%" value={f.alpha} error={errors.alpha} decimal onChange={(v) => set('alpha', v)} />
              <NumberField id="bond" label="Ký quỹ của chủ hụi" hint={vi.help.bond} unit="USDC" value={f.bond} error={errors.bond} decimal onChange={(v) => set('bond', v)} />
              <NumberField id="reserve" label="Quỹ dự phòng" hint={vi.help.reserve} unit="%" value={f.reserve} error={errors.reserve} decimal onChange={(v) => set('reserve', v)} />
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend className="data-[variant=legend]:text-2xl font-bold">Tiền công chủ hụi</FieldLegend>
            <FieldGroup className="gap-5">
              <Field orientation="horizontal">
                <Switch id="commission" checked={f.commission} onCheckedChange={(v) => set('commission', v)} />
                <FieldLabel htmlFor="commission" className="min-h-12 flex-1 items-center font-normal">
                  Họ hưởng hoa hồng (NĐ 19 Điều 4 khoản 8)
                </FieldLabel>
              </Field>
              <NumberField id="fee" label="Tiền công trên mỗi kỳ" hint={vi.help.fee} unit="%" value={f.commission ? f.fee : '0'} error={errors.fee} disabled={!f.commission} decimal onChange={(v) => set('fee', v)} />
            </FieldGroup>
          </FieldSet>

          <Button type="button" size="lg" disabled className="w-full sm:w-fit">
            Tạo dây (sẽ có sau)
          </Button>
        </FieldGroup>
      </form>

      <aside id="bang-bao-chung" aria-label="Chỉ số bảo chứng" className="self-start rounded-xl border border-border bg-card p-5 lg:sticky lg:top-4">
        {preview && value ? (
          <CoverageMeter preview={preview} bond={value.bond} alphaBps={value.alphaBps} onFillBond={() => set('bond', (Number(preview.bondFor100) / 1_000_000).toString())} />
        ) : (
          <div>
            <h2 className="text-2xl font-bold">Chỉ số bảo chứng</h2>
            <p className="mt-2 font-semibold text-destructive">Sửa các ô báo lỗi bên trái để xem chỉ số.</p>
          </div>
        )}
      </aside>

      {preview && value && (
        <div className="grid gap-8 border-t border-border pt-8 lg:col-span-2 lg:grid-cols-2 lg:gap-12">
          <section aria-label="Trần thăm">
            {bidding ? (
              <BidTable rows={preview.bidRows} />
            ) : (
              <div>
                <h2 className="text-2xl font-bold">Trần thăm từng kỳ</h2>
                <p className="mt-1 text-muted-foreground">Họ hốt lần lượt không bỏ thăm, nên không có trần thăm.</p>
              </div>
            )}
          </section>
          <section aria-label="Nghị định 19">
            <Nd19Panel perRoundUsdc={value.n * value.c} hasActiveCircle={hasActive} onHasActiveCircle={setHasActive} over18={over18} onOver18={setOver18} />
          </section>
        </div>
      )}

      {preview && value && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card px-4 py-2 lg:hidden">
          <a href="#bang-bao-chung" className="flex min-h-12 items-center justify-between gap-3">
            <span className="so-ke text-2xl font-bold">{(Number(preview.coverageBps) / 100).toLocaleString('vi-VN')}%</span>
            <span className="text-base">
              {preview.canActivate ? 'Đủ để bắt đầu dây' : `Cần thêm ${formatUsdc(preview.bondMissing)} ký quỹ`}
            </span>
            <span className="font-semibold text-primary underline">Xem bảng</span>
          </a>
        </div>
      )}
    </div>
  );
}

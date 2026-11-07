'use client';

import { ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatBps, formatUsdc, previewCircle } from 'sdk';
import { BidTable } from '@/components/BidTable';
import { CoverageMeter } from '@/components/CoverageMeter';
import { Nd19Panel } from '@/components/Nd19Panel';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ContractPreview } from '@/components/wizard/ContractPreview';
import { NumberField } from '@/components/wizard/NumberField';
import { Stepper } from '@/components/wizard/Stepper';
import { DEFAULTS, validateForm, type FieldName, type FormState } from '@/lib/circleForm';
import { TOGGLE_ON } from '@/lib/utils';
import { vi } from '@/lib/vi';

const STEPS = ['Dây hụi', 'Bảo chứng', 'Xem lại'];
const STEP_FIELDS: FieldName[][] = [['n', 'c', 'periodDays'], ['alpha', 'bond', 'reserve', 'fee'], []];

/** S03 as a 3-step wizard. The coverage panel stays visible: right column on desktop, bottom bar + sheet on mobile. */
export function CreateWizard() {
  const [f, setF] = useState<FormState>(DEFAULTS);
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [over18, setOver18] = useState(false);
  const [hasActive, setHasActive] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const { value, errors } = useMemo(() => validateForm(f), [f]);
  const preview = useMemo(
    () => (value ? previewCircle({ n: value.n, c: value.c, periodDays: value.periodDays, alphaBps: value.alphaBps, bond: value.bond, capBps: 2000n }) : undefined),
    [value],
  );
  const stepBad = STEP_FIELDS[step]!.some((k) => errors[k]);
  const bidding = f.mode === 'bidding';
  const fillBond = () => preview && set('bond', (Number(preview.bondFor100) / 1_000_000).toString());

  const panel =
    preview && value ? (
      <CoverageMeter preview={preview} bond={value.bond} alphaBps={value.alphaBps} onFillBond={fillBond} />
    ) : (
      <div>
        <h2 className="font-display text-2xl font-bold">Chỉ số bảo chứng</h2>
        <p className="mt-2 font-semibold text-destructive">Sửa các ô báo lỗi để xem chỉ số.</p>
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-8 pb-40 lg:grid-cols-[3fr_2fr] lg:gap-12 lg:pb-0 [&>*]:min-w-0">
      <div>
        <p className="mb-3 text-xl font-semibold">
          Bước {step + 1} trên {STEPS.length}: {STEPS[step]}
        </p>
        <Stepper steps={STEPS} current={step} />

        <form className="to-giay mt-6 p-5 md:p-7" onSubmit={(e) => e.preventDefault()} noValidate aria-label={`Bước ${step + 1}: ${STEPS[step]}`}>
          {step === 0 && (
            <FieldSet>
              <FieldLegend className="font-display data-[variant=legend]:text-3xl font-bold">Dây hụi</FieldLegend>
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel id="mode-label">Kiểu họ</FieldLabel>
                  <ToggleGroup type="single" variant="outline" value={f.mode} onValueChange={(v) => v && set('mode', v as FormState['mode'])} aria-labelledby="mode-label" className="flex-wrap">
                    <ToggleGroupItem value="bidding" className={TOGGLE_ON}>Bỏ thăm (họ có lãi)</ToggleGroupItem>
                    <ToggleGroupItem value="fixed" className={TOGGLE_ON}>Hốt lần lượt (họ không lãi)</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <NumberField id="n" label="Số phần hụi" hint="Mỗi người một phần, từ 3 đến 30." unit="phần" value={f.n} error={errors.n} onChange={(v) => set('n', v)} />
                <NumberField id="c" label="Mức góp mỗi kỳ" unit="USDC" value={f.c} error={errors.c} decimal onChange={(v) => set('c', v)} />
                <NumberField id="periodDays" label="Độ dài một kỳ" hint="Dùng để tính trần lãi và lãi chậm góp." unit="ngày" value={f.periodDays} error={errors.periodDays} onChange={(v) => set('periodDays', v)} />
              </FieldGroup>
            </FieldSet>
          )}

          {step === 1 && (
            <FieldSet>
              <FieldLegend className="font-display data-[variant=legend]:text-3xl font-bold">Bảo chứng</FieldLegend>
              <FieldGroup className="gap-5">
                <NumberField id="alpha" label="Tiền giữ lại của người hốt" hint={vi.help.holdback} unit="%" value={f.alpha} error={errors.alpha} decimal onChange={(v) => set('alpha', v)} />
                <NumberField id="bond" label="Ký quỹ của chủ hụi" hint={vi.help.bond} unit="USDC" value={f.bond} error={errors.bond} decimal onChange={(v) => set('bond', v)} />
                <NumberField id="reserve" label="Quỹ dự phòng" hint={vi.help.reserve} unit="%" value={f.reserve} error={errors.reserve} decimal onChange={(v) => set('reserve', v)} />
                <Field orientation="horizontal">
                  <Switch id="commission" checked={f.commission} onCheckedChange={(v) => set('commission', v)} />
                  <FieldLabel htmlFor="commission" className="min-h-12 flex-1 items-center font-normal">
                    Họ hưởng hoa hồng (NĐ 19 Điều 4 khoản 8)
                  </FieldLabel>
                </Field>
                <NumberField id="fee" label="Tiền công trên mỗi kỳ" hint={vi.help.fee} unit="%" value={f.commission ? f.fee : '0'} error={errors.fee} disabled={!f.commission} decimal onChange={(v) => set('fee', v)} />
              </FieldGroup>
            </FieldSet>
          )}

          {step === 2 && (
            <div className="space-y-8">
              {preview && value ? (
                <>
                  <ContractPreview form={f} value={value} preview={preview} />
                  {bidding ? <BidTable rows={preview.bidRows} /> : <p className="text-muted-foreground">Họ hốt lần lượt không bỏ thăm, nên không có trần thăm.</p>}
                  <Nd19Panel perRoundUsdc={value.n * value.c} hasActiveCircle={hasActive} onHasActiveCircle={setHasActive} over18={over18} onOver18={setOver18} />
                </>
              ) : (
                <p className="font-semibold text-destructive">Quay lại sửa các ô báo lỗi trước khi xem lại.</p>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)}>
                Quay lại
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" size="lg" disabled={stepBad} onClick={() => setStep(step + 1)}>
                Tiếp tục
              </Button>
            ) : (
              <>
                <Button type="button" size="lg" disabled aria-describedby="tao-ghi-chu">
                  Tạo dây (sẽ có sau)
                </Button>
                <p id="tao-ghi-chu" className="w-full text-muted-foreground">
                  Chưa nối với mạng, nút này chưa tạo dây thật.
                </p>
              </>
            )}
            {stepBad && <p className="w-full font-semibold text-destructive">Sửa các ô báo lỗi để tiếp tục.</p>}
          </div>
        </form>
      </div>

      <aside id="bang-bao-chung" aria-label="Chỉ số bảo chứng" className="to-giay hidden self-start p-5 lg:sticky lg:top-24 lg:block">
        {panel}
      </aside>

      {/* Mobile: coverage always visible as a bar above the bottom nav; tap to open the full panel. */}
      <div className="lg:hidden">
        {sheet && (
          <div className="to-giay to-giay-nang fixed inset-x-3 bottom-36 z-30 max-h-[65vh] overflow-y-auto p-5" role="region" aria-label="Bảng bảo chứng">
            {panel}
          </div>
        )}
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card px-4 py-1">
          <button type="button" aria-expanded={sheet} aria-controls="bang-bao-chung" onClick={() => setSheet((s) => !s)} className="flex min-h-14 w-full items-center justify-between gap-3 text-left">
            <span className="so-ke font-display text-3xl font-bold">{preview ? formatBps(preview.coverageBps) : '--'}</span>
            <span className="flex-1 text-base leading-tight">
              {!preview ? 'Sửa ô báo lỗi' : preview.canActivate ? 'Đủ để bắt đầu dây' : `Cần thêm ${formatUsdc(preview.bondMissing)} ký quỹ`}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              {sheet ? 'Ẩn bảng' : 'Xem bảng'}
              <ChevronUp aria-hidden className={`size-5 transition-transform duration-200 ${sheet ? 'rotate-180' : ''}`} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

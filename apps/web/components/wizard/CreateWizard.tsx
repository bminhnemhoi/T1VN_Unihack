'use client';

import { ChevronUp, RotateCcw } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { formatBps, formatUsdc, formatUsdcNumber, parseUsdc, previewCircle } from 'sdk';
import { BidTable } from '@/components/BidTable';
import { CoverageMeter } from '@/components/CoverageMeter';
import { Nd19Panel } from '@/components/Nd19Panel';
import { useToast } from '@/components/shell/Toast';
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
const STORAGE = 'huisafe.wizard.v1';
const LAST = STEPS.length - 1;

/** First step (0..2) whose fields are not valid yet; 2 when the whole form is fine. */
function firstBadStep(f: FormState): number {
  const { errors } = validateForm(f);
  const i = STEP_FIELDS.findIndex((fields) => fields.some((k) => errors[k]));
  return i === -1 ? LAST : i;
}

function readSaved(): { f: FormState; over18: boolean; hasActive: boolean } | undefined {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null');
    if (raw?.v !== 1 || typeof raw.f !== 'object' || raw.f === null) return undefined;
    const f = { ...DEFAULTS } as Record<string, unknown>;
    for (const k of Object.keys(DEFAULTS) as (keyof FormState)[]) {
      if (typeof raw.f[k] === typeof DEFAULTS[k]) f[k] = raw.f[k];
    }
    return { f: f as unknown as FormState, over18: raw.over18 === true, hasActive: raw.hasActive === true };
  } catch {
    return undefined; // private mode or blocked storage: the wizard just works without memory
  }
}

const stepFromUrl = (): number => {
  const want = Number(new URLSearchParams(window.location.search).get('buoc')) - 1;
  return Number.isInteger(want) && want > 0 ? want : 0;
};

const echoOf = (text: string): string | undefined => {
  const u = parseUsdc(text);
  return u !== undefined && formatUsdcNumber(u) !== text.trim() ? formatUsdc(u) : undefined;
};

/**
 * S03 as a 3-step wizard. The coverage panel stays visible: right column on desktop, bottom bar + sheet on mobile.
 * Keeps what the user typed (sessionStorage), gives every step its own history entry (`?buoc=2`) so Back and deep links work,
 * and never leaves a button dead: an invalid step explains itself and focuses the first bad field.
 */
export function CreateWizard() {
  const { show } = useToast();
  const [f, setF] = useState<FormState>(DEFAULTS);
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [over18, setOver18] = useState(false);
  const [hasActive, setHasActive] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldName, true>>>({});
  const [tried, setTried] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const stepRef = useRef(0);
  const fRef = useRef(f);
  const depth = useRef(0); // history entries this page pushed, so "Quay lại" can use history.back()
  const moved = useRef(false);
  const heading = useRef<HTMLParagraphElement>(null);
  fRef.current = f;

  const touch = useCallback((id: FieldName) => setTouched((t) => (t[id] ? t : { ...t, [id]: true })), []);
  const onChange = useCallback(
    (id: FieldName, v: string) => {
      setF((s) => ({ ...s, [id]: v }));
      touch(id);
    },
    [touch],
  );
  const setMode = useCallback((v: FormState['mode']) => setF((s) => ({ ...s, mode: v })), []);
  const setCommission = useCallback((v: boolean) => setF((s) => ({ ...s, commission: v })), []);

  // Restore saved input and the step from the URL (deep link), but never past the first step that is still invalid.
  useEffect(() => {
    const saved = readSaved();
    const form = saved?.f ?? DEFAULTS;
    if (saved) {
      setF(form);
      setOver18(saved.over18);
      setHasActive(saved.hasActive);
    }
    const want = stepFromUrl();
    const target = Math.min(want, firstBadStep(form), LAST);
    stepRef.current = target;
    setStep(target);
    if (target !== want) window.history.replaceState(null, '', target === 0 ? window.location.pathname : `?buoc=${target + 1}`);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify({ v: 1, f, over18, hasActive }));
    } catch {
      /* storage unavailable: ignore */
    }
  }, [f, over18, hasActive, hydrated]);

  // Browser Back / Forward between steps.
  useEffect(() => {
    const onPop = () => {
      const target = Math.min(stepFromUrl(), firstBadStep(fRef.current), LAST);
      depth.current = Math.max(0, depth.current + (target - stepRef.current));
      stepRef.current = target;
      moved.current = true;
      setTried(false);
      setStep(target);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // After a step change the user lands on the step title (screen readers announce it) and the page scrolls to it.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    setSheet(false);
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  useEffect(() => {
    if (!sheet) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheet(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sheet]);

  const { value, errors } = useMemo(() => validateForm(f), [f]);
  // Typing stays instant; the heavy side (tables, ruler) may trail one frame behind.
  const slowValue = useDeferredValue(value);
  const preview = useMemo(
    () =>
      slowValue
        ? previewCircle({ n: slowValue.n, c: slowValue.c, periodDays: slowValue.periodDays, alphaBps: slowValue.alphaBps, bond: slowValue.bond, capBps: 2000n })
        : undefined,
    [slowValue],
  );
  const bad = STEP_FIELDS[step]!.filter((k) => errors[k]);
  const stepBad = bad.length > 0;
  const showStepError = stepBad && (tried || bad.some((k) => touched[k]));
  const bidding = f.mode === 'bidding';
  const shown = (k: FieldName) => (tried || touched[k] ? errors[k] : undefined);

  const fillBond = useCallback(() => preview && setF((s) => ({ ...s, bond: (Number(preview.bondFor100) / 1_000_000).toString() })), [preview]);

  const goForward = () => {
    if (stepBad) {
      setTried(true);
      document.getElementById(bad[0]!)?.focus();
      return;
    }
    if (step >= LAST) return;
    const to = step + 1;
    depth.current += 1;
    stepRef.current = to;
    moved.current = true;
    setTried(false);
    window.history.pushState(null, '', `?buoc=${to + 1}`);
    setStep(to);
  };
  const goBack = () => {
    if (step === 0) return;
    if (depth.current > 0) {
      window.history.back(); // the popstate handler does the rest
      return;
    }
    const to = step - 1;
    stepRef.current = to;
    moved.current = true;
    setTried(false);
    window.history.replaceState(null, '', to === 0 ? window.location.pathname : `?buoc=${to + 1}`);
    setStep(to);
  };
  const reset = () => {
    setF(DEFAULTS);
    setOver18(false);
    setHasActive(false);
    setTouched({});
    setTried(false);
    show('Đã xóa các ô đã nhập và đặt lại giá trị mẫu.');
  };
  const create = () => {
    if (!over18) {
      show('Hãy tích ô xác nhận đủ 18 tuổi ở phần Nghị định 19 trước khi tạo dây.', 'error');
      const box = document.getElementById('over18');
      box?.scrollIntoView({ block: 'center' });
      box?.focus();
      return;
    }
    show('Tạo dây thật cần đăng nhập và nối mạng, sắp có. Hiện là màn hình mẫu, chưa có dây nào được tạo. Những gì bạn nhập vẫn được giữ trên máy này.');
  };

  const panel = (idPrefix: string) =>
    preview && value ? (
      <CoverageMeter idPrefix={idPrefix} preview={preview} bond={value.bond} alphaBps={value.alphaBps} onFillBond={fillBond} />
    ) : (
      <div>
        <h2 className="font-display text-2xl font-bold">Chỉ số bảo chứng</h2>
        <p className="mt-2 font-semibold text-destructive">Sửa các ô báo lỗi để xem chỉ số.</p>
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-8 pb-40 lg:grid-cols-[3fr_2fr] lg:gap-12 lg:pb-0 [&>*]:min-w-0">
      <div>
        <p ref={heading} tabIndex={-1} className="mb-3 text-xl font-semibold outline-none" aria-live="polite">
          Bước {step + 1} trên {STEPS.length}: {STEPS[step]}
        </p>
        <Stepper steps={STEPS} current={step} />

        <form
          className="to-giay mt-6 p-5 md:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (step < LAST) goForward();
            else create();
          }}
          noValidate
          aria-label={`Bước ${step + 1}: ${STEPS[step]}`}
        >
          {step === 0 && (
            <FieldSet>
              <FieldLegend className="font-display data-[variant=legend]:text-3xl font-bold">Dây hụi</FieldLegend>
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel id="mode-label">Kiểu họ</FieldLabel>
                  <ToggleGroup type="single" variant="outline" value={f.mode} onValueChange={(v) => v && setMode(v as FormState['mode'])} aria-labelledby="mode-label" className="flex-wrap">
                    <ToggleGroupItem value="bidding" className={TOGGLE_ON}>Bỏ thăm (họ có lãi)</ToggleGroupItem>
                    <ToggleGroupItem value="fixed" className={TOGGLE_ON}>Hốt lần lượt (họ không lãi)</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <NumberField id="n" label="Số phần hụi" hint="Mỗi người một phần, từ 3 đến 30." unit="phần" value={f.n} error={shown('n')} onChange={onChange} onBlur={touch} />
                <NumberField id="c" label="Mức góp mỗi kỳ" unit="USDC" value={f.c} error={shown('c')} echo={echoOf(f.c)} decimal onChange={onChange} onBlur={touch} />
                <NumberField id="periodDays" label="Độ dài một kỳ" hint="Dùng để tính trần lãi và lãi chậm góp." unit="ngày" value={f.periodDays} error={shown('periodDays')} last onChange={onChange} onBlur={touch} />
              </FieldGroup>
            </FieldSet>
          )}

          {step === 1 && (
            <FieldSet>
              <FieldLegend className="font-display data-[variant=legend]:text-3xl font-bold">Bảo chứng</FieldLegend>
              <FieldGroup className="gap-5">
                <NumberField id="alpha" label="Tiền giữ lại của người hốt" hint={vi.help.holdback} unit="%" value={f.alpha} error={shown('alpha')} decimal onChange={onChange} onBlur={touch} />
                <NumberField id="bond" label="Ký quỹ của chủ hụi" hint={vi.help.bond} unit="USDC" value={f.bond} error={shown('bond')} echo={echoOf(f.bond)} decimal onChange={onChange} onBlur={touch} />
                <NumberField id="reserve" label="Quỹ dự phòng" hint={vi.help.reserve} unit="%" value={f.reserve} error={shown('reserve')} decimal onChange={onChange} onBlur={touch} />
                <Field orientation="horizontal">
                  <Switch id="commission" checked={f.commission} onCheckedChange={setCommission} />
                  <FieldLabel htmlFor="commission" className="min-h-12 flex-1 items-center font-normal">
                    Họ hưởng hoa hồng (NĐ 19 Điều 4 khoản 8)
                  </FieldLabel>
                </Field>
                <NumberField id="fee" label="Tiền công trên mỗi kỳ" hint={vi.help.fee} unit="%" value={f.commission ? f.fee : '0'} error={shown('fee')} disabled={!f.commission} decimal last onChange={onChange} onBlur={touch} />
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
              <Button type="button" variant="outline" size="lg" onClick={goBack}>
                Quay lại
              </Button>
            )}
            {step < LAST ? (
              <Button type="submit" size="lg" aria-describedby={showStepError ? 'buoc-loi' : undefined}>
                Tiếp tục
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={!value} aria-describedby="tao-ghi-chu">
                Tạo dây
              </Button>
            )}
            {step === 0 && (
              <Button type="button" variant="ghost" size="lg" onClick={reset}>
                <RotateCcw aria-hidden className="size-5" /> Nhập lại từ đầu
              </Button>
            )}
            {step === LAST && (
              <p id="tao-ghi-chu" className="w-full text-muted-foreground">
                {value ? 'Chưa nối với mạng: bấm nút sẽ cho bạn biết cần gì, chưa tạo dây thật.' : 'Nút tạo dây tắt vì còn ô báo lỗi ở các bước trước.'}
              </p>
            )}
            {showStepError && (
              <p id="buoc-loi" className="w-full font-semibold text-destructive">
                Sửa các ô báo lỗi để tiếp tục.
              </p>
            )}
          </div>
        </form>
      </div>

      <aside id="bang-bao-chung" aria-label="Chỉ số bảo chứng" className="to-giay hidden self-start p-5 lg:sticky lg:top-24 lg:block">
        {panel('cov-d')}
      </aside>

      {/* Mobile: coverage always visible as a bar above the bottom nav; tap to open the full panel. */}
      <div className="lg:hidden">
        {sheet && (
          <div id="bang-bao-chung-m" className="to-giay to-giay-nang fixed inset-x-3 bottom-36 z-30 max-h-[65vh] overflow-y-auto p-5 animate-in fade-in slide-in-from-bottom-2 duration-150" role="region" aria-label="Bảng bảo chứng">
            {panel('cov-m')}
          </div>
        )}
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card px-4 py-1">
          <button type="button" aria-expanded={sheet} aria-controls="bang-bao-chung-m" onClick={() => setSheet((s) => !s)} className="flex min-h-14 w-full items-center justify-between gap-3 text-left">
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

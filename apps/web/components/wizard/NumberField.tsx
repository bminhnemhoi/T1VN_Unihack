import { memo } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { FieldName } from '@/lib/circleForm';

interface Props {
  id: FieldName;
  label: string;
  hint?: string;
  unit: string;
  value: string;
  error?: string;
  /** What the app understood, in vi-VN format ("1.200 USDC"), shown only when it differs from what was typed. */
  echo?: string;
  disabled?: boolean;
  decimal?: boolean;
  last?: boolean;
  onChange: (id: FieldName, v: string) => void;
  onBlur: (id: FieldName) => void;
}

/** One labelled number input with a unit suffix, a hint, an echo of the parsed value and an error line. Memoised: typing in one field does not re-render the others. */
export const NumberField = memo(function NumberField({ id, label, hint, unit, value, error, echo, disabled, decimal, last, onChange, onBlur }: Props) {
  const described = [hint ? `${id}-hint` : '', echo ? `${id}-echo` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <Field data-invalid={error ? true : undefined} data-disabled={disabled ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          name={id}
          inputMode={decimal ? 'decimal' : 'numeric'}
          enterKeyHint={last ? 'done' : 'next'}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="so-ke max-w-40 text-right text-lg"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onChange={(e) => onChange(id, e.target.value)}
          onBlur={() => onBlur(id)}
        />
        <span className="text-lg">{unit}</span>
      </div>
      {echo && !error && (
        <p id={`${id}-echo`} className="so-ke text-base text-muted-foreground">
          = {echo}
        </p>
      )}
      {disabled && <FieldDescription>Đang tắt vì họ này không hưởng hoa hồng.</FieldDescription>}
      {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </Field>
  );
});

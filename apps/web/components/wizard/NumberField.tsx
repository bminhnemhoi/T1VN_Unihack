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
  disabled?: boolean;
  decimal?: boolean;
  onChange: (v: string) => void;
}

/** One labelled number input with a unit suffix, a hint and an error line. */
export function NumberField({ id, label, hint, unit, value, error, disabled, decimal, onChange }: Props) {
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

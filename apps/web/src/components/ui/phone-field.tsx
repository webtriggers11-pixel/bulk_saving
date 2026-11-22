import { forwardRef, type ComponentProps } from 'react';
import { normalisePhone } from '@bulk/shared';
import { cn } from '../../lib/utils';
import { Input } from './input';

/** The only country the web signs people in from (ADR-0042; ADR-0036's India default). */
export const PHONE_COUNTRY_CODE = '+91';
const LOCAL_DIGITS = 10;

/**
 * What is left for the field after a keystroke or a paste (FEAT-031): digits only, at most 10.
 * A pasted `+91 98765 43210`, `91 9876543210` or `098765 43210` loses its prefix first, so a
 * number copied from a contact card lands whole instead of being cut to `9198765432`.
 */
export function toLocalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > LOCAL_DIGITS) {
    if (digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.slice(1);
  }
  return digits.slice(0, LOCAL_DIGITS);
}

/** The canonical number for 10 local digits (`+91…`), or null until it is a valid Indian mobile. */
export function indianPhone(localDigits: string): string | null {
  return localDigits.length === LOCAL_DIGITS ? normalisePhone(`${PHONE_COUNTRY_CODE}${localDigits}`) : null;
}

type PhoneFieldProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'inputMode' | 'inset'> & {
  /** The local digits only — never the prefix. */
  value: string;
  onValueChange: (localDigits: string) => void;
};

/**
 * A phone field whose `+91` is fixed (FEAT-031, ADR-0042): the prefix is a label drawn over
 * the field's left edge, not part of the input's value, so it cannot be selected, deleted or
 * typed over. Screen readers hear it through `aria-describedby`. No `maxLength`: a browser
 * truncates a paste to it BEFORE onChange, which would cut `+91 98765 43210` to `+91 98765 `;
 * {@link toLocalDigits} caps the digits instead.
 */
export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(function PhoneField(
  { value, onValueChange, id, className, 'aria-describedby': describedBy, ...props },
  ref,
) {
  const prefixId = `${id ?? 'phone'}-country`;
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        data-testid="phone-prefix"
        className="num pointer-events-none absolute inset-y-0 left-0 flex select-none items-center gap-2.5 pl-[15px] text-[19px] font-extrabold text-ink-muted"
      >
        {PHONE_COUNTRY_CODE}
        <span className="h-6 w-px bg-line/20" />
      </span>
      <span id={prefixId} className="sr-only">
        Country code {PHONE_COUNTRY_CODE}
      </span>
      <Input
        ref={ref}
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        inset="prefix"
        value={value}
        onChange={(e) => onValueChange(toLocalDigits(e.target.value))}
        className={cn('num', className)}
        aria-describedby={[prefixId, describedBy].filter(Boolean).join(' ')}
        {...props}
      />
    </div>
  );
});

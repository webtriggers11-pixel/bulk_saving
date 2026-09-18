import { cn } from '../../lib/utils';

/** The only allowed scores (FEAT-007: integer 1–5, validated server-side too). */
export const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export type StarValue = (typeof STAR_VALUES)[number];

interface StarRatingProps {
  /** Currently selected score, or null for "not rated yet". */
  value: StarValue | null;
  /** Omit to render read-only (the admin surfaces and a saved resident rating). */
  onChange?: (value: StarValue) => void;
  /** Disables input while a write is in flight. */
  disabled?: boolean;
  /** Accessible group label, e.g. "Rate AC Servicing". */
  label: string;
  /** `id` prefix so several groups can coexist on one page. */
  idPrefix: string;
  /** Optional test hook; read-only mode keeps FEAT-008's `my-rating` contract. */
  testId?: string;
}

/**
 * Five stars as a real `radiogroup` of five radios (ADR-0018), not click handlers
 * on spans. That is what makes it operable by keyboard — arrow keys move between
 * radios natively — and announced properly ("2 stars, radio, 2 of 5") rather than
 * as five unlabelled images. The stars are the radios' visible labels; the inputs
 * themselves are visually hidden but focusable, so focus rings still land.
 *
 * Read-only mode (no `onChange`) renders plain text plus stars, with no form
 * controls at all — a saved rating is not an input.
 */
export function StarRating({ value, onChange, disabled, label, idPrefix, testId }: StarRatingProps) {
  if (!onChange) {
    return (
      <span
        className="inline-flex items-center gap-1"
        // role="img" + aria-label: an aria-label on a bare span (role=generic) is
        // ARIA-prohibited and real assistive tech often drops it (V2 P2).
        role="img"
        aria-label={`${value ?? 0} out of 5`}
        {...(testId ? { 'data-testid': testId } : {})}
      >
        <span aria-hidden="true" className="text-amber-500">
          {STAR_VALUES.map((star) => (star <= (value ?? 0) ? '★' : '☆')).join('')}
        </span>
        <span className="text-sm text-slate-600">{value ?? 0} / 5</span>
      </span>
    );
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {STAR_VALUES.map((star) => {
        const id = `${idPrefix}-star-${star}`;
        const selected = value === star;
        return (
          <span key={star} className="relative">
            <input
              type="radio"
              id={id}
              name={`${idPrefix}-stars`}
              value={star}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(star)}
              // Visually hidden, NOT display:none — it must stay focusable. `peer`
              // lets the visible label carry the focus ring (V2 P1-6): without it the
              // ring lands on a 1px transparent element and a keyboard user cannot
              // see which star they are on (WCAG 2.4.7).
              className="peer absolute h-px w-px overflow-hidden opacity-0"
            />
            <label
              htmlFor={id}
              aria-label={star === 1 ? '1 star' : `${star} stars`}
              className={cn(
                // min-h/w 44px: this is a phone-first product and every Button is
                // h-11; a 26px star was below the touch target everything else meets.
                'flex h-11 w-9 cursor-pointer items-center justify-center rounded text-2xl leading-none transition-colors',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 peer-focus-visible:ring-offset-1',
                (value ?? 0) >= star ? 'text-amber-500' : 'text-slate-300',
                disabled ? 'cursor-not-allowed opacity-60' : 'hover:text-amber-400',
              )}
            >
              <span aria-hidden="true">{(value ?? 0) >= star ? '★' : '☆'}</span>
            </label>
          </span>
        );
      })}
    </div>
  );
}

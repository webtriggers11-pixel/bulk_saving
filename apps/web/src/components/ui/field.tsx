import { useId, type ReactNode } from 'react';
import { Label } from './label';
import { Icon } from './icon';
import { cn } from '../../lib/utils';

interface FieldProps {
  label: string;
  /**
   * An explicit id, when the screen's own contract names it (the vendor forms use
   * `edit-<vendorId>-name` so an inline edit form can be targeted). Omitted, the
   * field generates one — which is the common case and the safer default.
   */
  id?: string;
  /** Rendered next to the label in sentence case, e.g. "(optional)". */
  hint?: string;
  /** Shown under the control, in the error tone, and wired to the control via aria. */
  error?: string | null;
  /** `(id) => control`, so the field owns the id/label/error wiring rather than the screen. */
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
}

/**
 * A label, a control, and the one thing that goes wrong (CHORE-008, ADR-0022).
 *
 * The control comes in as a render prop so the field can generate the id and hand
 * back the aria wiring — which is exactly the part every screen was previously
 * doing by hand, and the part that quietly stops matching when a form is edited.
 * `.field` gives the label its focus-within lift (theme.css).
 */
export function Field({ label, id: givenId, hint, error, children, className }: FieldProps) {
  const generated = useId();
  const id = givenId ?? generated;
  const errorId = `${id}-error`;
  return (
    <div className={cn('field', className)}>
      <Label htmlFor={id}>
        {label}
        {hint && (
          <span className="ml-1 font-semibold normal-case tracking-normal text-ink-soft">{hint}</span>
        )}
      </Label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}),
      })}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 flex items-center gap-2 text-meta font-bold text-danger-ink"
        >
          <Icon name="alert" size={15} strokeWidth={2} />
          {error}
        </p>
      )}
    </div>
  );
}

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * 50px tall, 16px radius, a white-gradient fill over the ground, and the system's
 * one focus ring (FEAT-011). Error state is driven by `aria-invalid` rather than a
 * prop, so it also lights up when a form library sets it.
 */
/**
 * The type sizes an input can take — a code field is deliberately bigger than a name
 * field. A prop for the same reason as CardTitle's: passed as a className it lost to
 * the base `text-lead` every time, so the invite, phone and OTP fields have all been
 * rendering at 15px (BUG-007).
 */
const INPUT_TEXT = {
  default: 'text-lead',
  numeric: 'text-[17px]',
  lg: 'text-[19px]',
  xl: 'text-[21px]',
  code: 'text-[27px]',
} as const;

/**
 * How hard the field's edge works.
 *
 * `normal` used to be `border-white/70` — a white border on the white sheet, which is
 * to say no border at all: the fields on the app's front door read as gaps rather than
 * as things you type in. It is now a soft ink hairline, visible on every surface the
 * system has.
 *
 * `primary` is the screen's main field — the one a resident is there to fill. It takes
 * the brand edge and the focus ring at rest, which the OTP field used to hand-roll in a
 * className (and which BUG-007 is the standing reminder not to do).
 */
const INPUT_EMPHASIS = {
  normal: 'border-shade/15 shadow-field',
  primary: 'border-brand/45 shadow-ring',
} as const;

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  textSize?: keyof typeof INPUT_TEXT;
  emphasis?: keyof typeof INPUT_EMPHASIS;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ textSize = 'default', emphasis = 'normal', className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-control w-full rounded-control border bg-transparent paint-glass',
          // The shadow belongs to `emphasis`, not the base: with `shadow-field` here as
          // well, `primary` emitted two box-shadow classes and the inset field shadow
          // was dropped by emission order rather than by intent (V2 P2-7).
          'px-[15px] font-semibold tracking-[-0.01em] text-ink t',
          INPUT_TEXT[textSize],
          INPUT_EMPHASIS[emphasis],
          'placeholder:font-medium placeholder:text-ink-soft',
          'focus-visible:outline-none focus:outline-none focus:border-brand/60 focus:shadow-ring',
          'aria-[invalid=true]:border-danger-ink/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);

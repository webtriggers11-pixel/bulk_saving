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

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  textSize?: keyof typeof INPUT_TEXT;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ textSize = 'default', className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-control w-full rounded-control border border-white/70 bg-transparent paint-glass',
          'px-[15px] font-semibold tracking-[-0.01em] text-ink shadow-field t',
          INPUT_TEXT[textSize],
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

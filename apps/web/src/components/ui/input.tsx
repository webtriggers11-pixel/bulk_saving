import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * 50px tall, 16px radius, a white-gradient fill over the ground, and the system's
 * one focus ring (FEAT-011). Error state is driven by `aria-invalid` rather than a
 * prop, so it also lights up when a form library sets it.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-control w-full rounded-control border border-white/70 bg-transparent fill-glass',
          'px-[15px] text-lead font-semibold tracking-[-0.01em] text-ink shadow-field t',
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

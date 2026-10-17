import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** shadcn/ui-style native select, styled to match {@link Input}. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          // FEAT-011: on the token layer like every other primitive, so the admin
        // surfaces it serves inherit the palette rather than a frozen teal.
        'flex h-control w-full rounded-control border border-line/15 paint-glass px-[15px] text-lead font-semibold text-ink shadow-field t',
        'focus:border-brand/60 focus:shadow-ring focus:outline-none focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);

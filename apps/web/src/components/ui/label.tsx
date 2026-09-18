import { type LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * Uppercase, tracked, 800 — a label reads as a label without a colour of its own.
 * Inside a `.field` wrapper it shifts up and inks to brand as focus lands (theme.css).
 */
export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'field-label mb-2 block text-label uppercase text-ink-muted transition-colors',
        className,
      )}
      {...props}
    />
  );
}

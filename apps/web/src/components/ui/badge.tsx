import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type BadgeTone = 'slate' | 'teal' | 'amber' | 'blue' | 'green' | 'red';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONES: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  teal: 'bg-teal-50 text-teal-800',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-50 text-blue-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-50 text-red-700',
};

/** shadcn/ui-style pill badge for short status labels. */
export function Badge({ tone = 'slate', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

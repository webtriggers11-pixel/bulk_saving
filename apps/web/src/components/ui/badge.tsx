import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type BadgeTone = 'slate' | 'teal' | 'amber' | 'blue' | 'green' | 'red';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Optional leading glyph — an <Icon /> at 13px, never an emoji. */
  icon?: ReactNode;
}

/**
 * Status pills. Tone names are kept from FEAT-009 so every caller keeps working;
 * `teal` now means "the brand tone", whatever the palette is.
 */
const TONES: Record<BadgeTone, string> = {
  slate: 'bg-line/10 border-paper/60 text-ink-muted',
  teal: 'bg-brand-light/25 border-paper/70 text-brand-ink',
  amber: 'bg-amber-ink/15 border-paper/60 text-amber-ink',
  blue: 'bg-info-ink/10 border-paper/60 text-info-ink',
  green: 'bg-success-ink/15 border-paper/60 text-success-ink',
  red: 'bg-danger-ink/10 border-paper/60 text-danger-ink',
};

export function Badge({ tone = 'slate', icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[11px] py-1.5',
        'text-micro font-extrabold shadow-hairline t',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

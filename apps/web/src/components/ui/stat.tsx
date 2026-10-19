import type { ReactNode } from 'react';
import { Card } from './card';
import { Icon, type IconName } from './icon';
import { cn } from '../../lib/utils';

interface StatCardProps {
  /** What is being counted, e.g. "Open rounds". */
  label: string;
  /** Already formatted — this card does not know rupees from units. */
  value: string;
  /** Omitted for a dense row of tiles, where seven glyphs would be noise. */
  icon?: IconName;
  /** A qualifier under the number, e.g. "across 3 societies". */
  note?: string;
  /**
   * How loudly this figure reads:
   * `lead` the headline number (accent), `normal` a supporting one (tint),
   * `quiet` one of many in a row (solid), `alert` one that needs the operator to act.
   */
  emphasis?: 'lead' | 'normal' | 'quiet' | 'alert';
  action?: ReactNode;
  /** `dense` is a row of many tiles (the admin status row); `normal` stands alone. */
  density?: 'normal' | 'dense';
  className?: string;
  'data-testid'?: string;
}

/**
 * One number, with what it counts (CHORE-008, ADR-0022). The admin dashboard's
 * headline figures, and the shape the resident app will want the day it shows a
 * resident their own savings.
 *
 * Formatting is the caller's: a stat card that knows about currency is a stat card
 * that has to be told about every other unit too.
 */
const SURFACE = {
  lead: 'accent',
  normal: 'tint',
  quiet: 'solid',
  alert: 'solid',
} as const;

export function StatCard({
  label,
  value,
  icon,
  note,
  emphasis = 'normal',
  density = 'normal',
  action,
  className,
  'data-testid': testId,
}: StatCardProps) {
  const lead = emphasis === 'lead';
  const alert = emphasis === 'alert';
  return (
    <Card
      surface={SURFACE[emphasis]}
      padding={density === 'dense' ? 'tight' : 'snug'}
      className={cn(
        'flex flex-col',
        density === 'dense' ? 'gap-0' : 'gap-3',
        lead && 'sheen overflow-hidden',
        // An "act on me" tile is amber, and only when it actually holds something:
        // a highlighted zero is noise, and noise is how a dashboard stops being read.
        alert && 'border-paper/60 bg-gradient-to-br from-amber-ink/20 to-amber-ink/5 shadow-lift',
        className,
      )}
      data-testid={testId}
    >
      {icon && (
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-control border',
            lead
              ? 'border-on-fill/40 bg-on-fill/20 text-on-fill'
              : 'border-paper/90 bg-gradient-to-br from-paper/95 to-paper/55 text-brand-ink shadow-lift',
          )}
        >
          <Icon name={icon} size={21} strokeWidth={1.8} />
        </span>
      )}
      {/* BUG-016: label at the top, number pushed to the bottom — tiles in one row line
          their numbers up even when a label ("Awaiting delivery") wraps to two lines. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <p
          className={cn(
            'text-eyebrow uppercase',
            lead ? 'text-on-fill' : alert ? 'text-amber-ink' : 'text-brand-ink',
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            'num mt-auto pt-1.5 text-[26px] font-extrabold leading-none tracking-[-0.045em]',
            lead ? 'text-on-fill' : 'text-ink',
          )}
        >
          {value}
        </p>
        {note && (
          <p className={cn('mt-1.5 text-meta', lead ? 'text-on-fill' : 'text-ink-muted')}>{note}</p>
        )}
      </div>
      {action}
    </Card>
  );
}

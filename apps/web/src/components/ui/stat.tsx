import type { ReactNode } from 'react';
import { Card } from './card';
import { Icon, type IconName } from './icon';
import { cn } from '../../lib/utils';

interface StatCardProps {
  /** What is being counted, e.g. "Open rounds". */
  label: string;
  /** Already formatted — this card does not know rupees from units. */
  value: string;
  icon: IconName;
  /** A qualifier under the number, e.g. "across 3 societies". */
  note?: string;
  /** The lead figure on a screen gets the accent surface; the rest are tint. */
  emphasis?: 'lead' | 'normal';
  action?: ReactNode;
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
export function StatCard({
  label,
  value,
  icon,
  note,
  emphasis = 'normal',
  action,
  className,
  'data-testid': testId,
}: StatCardProps) {
  const lead = emphasis === 'lead';
  return (
    <Card
      surface={lead ? 'accent' : 'tint'}
      className={cn('flex flex-col gap-3 p-5', lead && 'sheen overflow-hidden', className)}
      data-testid={testId}
    >
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-control border',
          lead
            ? 'border-white/40 bg-white/20 text-white'
            : 'border-white/90 bg-gradient-to-br from-white/95 to-white/55 text-brand-ink shadow-lift',
        )}
      >
        <Icon name={icon} size={21} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            'text-eyebrow uppercase',
            lead ? 'text-white/75' : 'text-brand-ink',
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            'num mt-1.5 text-[26px] font-extrabold leading-none tracking-[-0.045em]',
            lead ? 'text-white' : 'text-ink',
          )}
        >
          {value}
        </p>
        {note && (
          <p className={cn('mt-1.5 text-meta', lead ? 'text-white/75' : 'text-ink-muted')}>{note}</p>
        )}
      </div>
      {action}
    </Card>
  );
}

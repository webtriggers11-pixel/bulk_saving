import type { ReactNode } from 'react';
import { Card } from './card';
import { Icon, type IconName } from './icon';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  /** The glyph in the halo — one of the system's icons, never an illustration. */
  icon: IconName;
  title: string;
  description: string;
  /** An optional way out: "See open rounds", "Add a vendor". */
  action?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/**
 * Nothing here yet (CHORE-008, ADR-0022). Four screens had their own copy of this
 * card; they agreed on the words and disagreed on the padding.
 *
 * It says what is missing and, where there is one, offers the way out. It never
 * explains WHY the list is empty — that sentence belongs to the screen, which is
 * the only thing that knows.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  'data-testid': testId,
}: EmptyStateProps) {
  return (
    <Card className={cn('p-7 text-center', className)} data-testid={testId}>
      <span className="animate-breathe mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-inset border border-white/80 bg-gradient-to-br from-brand-light/20 to-brand/5 text-brand-ink shadow-lift">
        <Icon name={icon} size={26} strokeWidth={1.7} />
      </span>
      <h2 className="mt-4 text-title font-extrabold text-ink">{title}</h2>
      <p className="mt-2 text-caption text-ink-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

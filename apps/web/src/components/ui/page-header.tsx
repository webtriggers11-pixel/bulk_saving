import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  /** One line under the title. Omitted on screens whose title is self-evident. */
  subtitle?: string;
  /** A back control, a primary action — placed opposite the title. */
  action?: ReactNode;
  /** Something that sits left of the title, e.g. the brand mark on Home. */
  lead?: ReactNode;
  className?: string;
}

/**
 * The top of a screen (CHORE-008, ADR-0022). Five screens had written this out
 * separately; the fifth had already drifted a size.
 *
 * It places a title, an optional line and an optional action. It does not know
 * about routes — a back button is an `action` the screen passes in, because the
 * header has no business deciding where "back" goes.
 */
export function PageHeader({ title, subtitle, action, lead, className }: PageHeaderProps) {
  return (
    <header className={cn('animate-rise flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {lead}
        <div className="min-w-0">
          <h1 className="text-display font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-caption text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

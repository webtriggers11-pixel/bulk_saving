import { cn } from '../../lib/utils';

interface FactProps {
  /** The label, e.g. "Your pledge". Rendered uppercase; pass it in sentence case. */
  term: string;
  /** The value. Pass `children` instead when it is markup rather than a string. */
  value?: React.ReactNode;
  children?: React.ReactNode;
  /**
   * How the fact is set: a `tile` in a pair, a `row` in a dense list, or `plain`
   * in a summary grid that supplies its own surface. One component with a closed
   * variant rather than three near-identical ones (ADR-0022) — three copies is how
   * the admin round detail ended up one step out of sync with the resident cards.
   */
  variant?: 'tile' | 'row' | 'plain';
  /**
   * The id goes on the VALUE, not the wrapper, because that is what a screen's
   * contract points at ("my-units" is the number, not the tile). Named `testId`
   * rather than `data-testid` for exactly that reason — it is not this element's id.
   */
  testId?: string;
  className?: string;
}

const TERM = 'term-label';

/**
 * One labelled fact (CHORE-008, ADR-0022). Pairs on My Requests, tiles on Profile,
 * a summary grid on the admin round detail.
 *
 * Renders `<dt>/<dd>`, so the CALLER must place it inside a `<dl>` — every current
 * one does, and a bare pair outside a list is invalid markup.
 */
export function Fact({ term, value, children, variant = 'tile', testId, className }: FactProps) {
  const rendered = value ?? children;
  if (variant === 'row') {
    return (
      <div
        className={cn(
          'row-hover t -mx-2.5 flex items-center justify-between gap-3 rounded-chip border-t border-shade/10 px-2.5 py-3',
          className,
        )}
      >
        <dt className="text-caption font-semibold text-ink-muted">{term}</dt>
        <dd className="num text-body font-extrabold text-ink" data-testid={testId}>
          {rendered}
        </dd>
      </div>
    );
  }

  if (variant === 'plain') {
    return (
      <div className={cn('min-w-0', className)}>
        <dt className={TERM}>{term}</dt>
        <dd className="num mt-1 text-body font-extrabold text-ink" data-testid={testId}>
          {rendered}
        </dd>
      </div>
    );
  }

  return (
    <div className={cn('surface-inset min-w-0 flex-1 rounded-inset px-3.5 py-3', className)}>
      <dt className={TERM}>{term}</dt>
      <dd className="num mt-1.5 text-[15.5px] font-extrabold text-ink" data-testid={testId}>
        {rendered}
      </dd>
    </div>
  );
}

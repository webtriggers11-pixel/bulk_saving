import { cn } from '../../lib/utils';
import { Icon } from './icon';

interface ResultSummaryProps {
  /** Rows in the current result; undefined while the first load is in flight. */
  count: number | undefined;
  /** e.g. ['service', 'services'] — stored, never derived by appending "s" (ADR-0019). */
  noun: readonly [string, string];
  /** How many filters are set. "Clear filters" appears only when there is one to clear. */
  activeCount: number;
  onClear: () => void;
  /** A newer result is on its way — the count says so instead of going blank. */
  busy?: boolean;
  className?: string;
}

/**
 * The line above a filtered list (FEAT-015): how many rows the filters left, with the
 * number ticking into place when it changes (`.animate-tick`, keyed by value), and the
 * way back to the unfiltered list. It is a live region, so a screen-reader user hears
 * the new count without having to go looking for it.
 */
export function ResultSummary({ count, noun, activeCount, onClear, busy, className }: ResultSummaryProps) {
  return (
    <div className={cn('flex min-h-touch items-center justify-between gap-3', className)}>
      <p role="status" aria-live="polite" className="text-meta font-bold text-ink-muted">
        {count === undefined ? (
          'Loading…'
        ) : (
          <>
            <span key={count} className="num animate-tick text-ink">
              {count}
            </span>{' '}
            {count === 1 ? noun[0] : noun[1]}
            {activeCount > 0 ? (count === 1 ? ' matches' : ' match') : ''}
            {busy && <span className="sr-only"> — updating</span>}
          </>
        )}
      </p>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="press animate-pop inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 text-meta font-bold text-brand-ink t hover:bg-brand/10 focus-visible:shadow-focus focus-visible:outline-none"
        >
          <Icon name="close" size={14} strokeWidth={2.4} />
          Clear filters
        </button>
      )}
    </div>
  );
}

import { PAGE_LIMIT_DEFAULT } from '@bulk/shared';
import { Button } from './button';
import { Icon } from './icon';

interface ShowMoreProps {
  /** Whether a next page exists. Renders nothing when false. */
  hasMore: boolean;
  /** How many items are loaded, and how many there are in all — for "N more". */
  loaded: number;
  total?: number;
  busy?: boolean;
  onMore: () => void;
  /** The things being counted, e.g. ['round', 'rounds']. */
  noun: [string, string];
  /** How many the next page brings (FEAT-044: it said 50 while lists load 20). Default: the API default. */
  pageSize?: number;
  'data-testid'?: string;
}

/**
 * The explicit next page (FEAT-025, ADR-0035): not infinite scroll. A control the thumb
 * finds, that pauses honestly offline and that a test can press. Says how much is left,
 * because "Show more" alone is a promise of unknown size.
 */
export function ShowMore({ hasMore, loaded, total, busy = false, onMore, noun, pageSize = PAGE_LIMIT_DEFAULT, 'data-testid': testId = 'show-more' }: ShowMoreProps) {
  if (!hasMore) return null;
  const left = total !== undefined ? Math.max(0, total - loaded) : undefined;
  const label =
    left === undefined ? 'Show more' : `Show ${Math.min(left, pageSize)} more${left > pageSize ? ` of ${left}` : ''} ${left === 1 ? noun[0] : noun[1]}`;
  return (
    <div className="flex justify-center pt-1">
      <Button variant="secondary" size="sm" disabled={busy} onClick={onMore} data-testid={testId}>
        {busy ? 'Loading…' : label}
        {!busy && <Icon name="forward" size={15} strokeWidth={2.3} className="rotate-90" />}
      </Button>
    </div>
  );
}

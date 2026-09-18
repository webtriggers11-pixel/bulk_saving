import { Button } from './ui/button';
import { useOnlineStatus } from '../features/shell/useOnlineStatus';

interface QueryErrorStateProps {
  /** What failed to load, lower case, e.g. "rounds" — used in the copy. */
  subject: string;
  /** True when the view already has data from an earlier successful fetch. */
  hasData: boolean;
  onRetry: () => void;
}

/**
 * The one place FEAT-008 states a failed read (AC7). Two axes, because they mean
 * different things to a resident:
 *
 * - **offline vs. a server error** — "check your connection" is useless advice
 *   when the connection is fine.
 * - **empty vs. stale** — with data already on screen a failed refetch is a
 *   staleness notice, not an error; replacing a populated list with an error
 *   block is how "my round disappeared" panic starts (spec AC7).
 *
 * Deliberately not a full-page state: it renders above whatever the page has.
 */
export function QueryErrorState({ subject, hasData, onRetry }: QueryErrorStateProps) {
  const online = useOnlineStatus();

  const message = online
    ? hasData
      ? `We couldn't refresh the ${subject}. Showing what we loaded earlier.`
      : `We couldn't load the ${subject}. Please try again.`
    : hasData
      ? `You're offline. Showing the ${subject} we loaded earlier — they may have changed.`
      : `You're offline, so we couldn't load the ${subject}. Reconnect and try again.`;

  return (
    <div
      role="alert"
      data-testid="query-error"
      data-mode={online ? (hasData ? 'stale' : 'error') : hasData ? 'offline-stale' : 'offline-empty'}
      className={[
        'flex flex-col items-start gap-3 rounded-md px-3 py-2',
        hasData ? 'bg-amber-50 text-amber-900' : 'text-red-600',
      ].join(' ')}
    >
      <p>{message}</p>
      <Button variant="primary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

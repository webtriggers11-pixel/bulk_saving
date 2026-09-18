import { useOnlineStatus } from './useOnlineStatus';

/**
 * Persistent "you are offline" strip (FEAT-008 AC6). Read-only offline is a
 * deliberate decision (ADR-0015), so the copy promises nothing about queuing.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) {
    return null;
  }
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900"
    >
      You're offline — showing the last thing we loaded. Rounds may have changed.
    </div>
  );
}

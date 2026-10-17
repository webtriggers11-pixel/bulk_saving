import { Icon } from '../../components/ui/icon';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

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
      className="animate-rise flex items-center gap-2.5 rounded-inset border border-paper/60 bg-amber-ink/15 px-4 py-3 text-meta font-bold leading-snug text-amber-ink shadow-hairline backdrop-blur-soft"
    >
      <Icon name="offline" size={18} strokeWidth={2} />
      <span>You&apos;re offline — showing the last thing we loaded. Rounds may have changed.</span>
    </div>
  );
}

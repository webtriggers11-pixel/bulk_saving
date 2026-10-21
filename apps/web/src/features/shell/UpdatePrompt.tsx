import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { useServiceWorker } from './ServiceWorkerProvider';

/**
 * Offers the waiting service worker (FEAT-008 AC9). `registerType: 'autoUpdate'`
 * installs a new build in the background; this makes the switch a deliberate tap
 * so a resident is never refreshed out from under a half-filled pledge form.
 * FEAT-029: the registration itself lives in ServiceWorkerProvider, at the root.
 */
export function UpdatePrompt() {
  const sw = useServiceWorker();
  if (!sw?.needRefresh) {
    return null;
  }
  const { updateServiceWorker } = sw;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-prompt"
      className="sheen animate-rise relative flex items-center justify-between gap-3 overflow-hidden rounded-inset surface-accent px-4 py-2.5 text-meta font-bold"
    >
      <span className="relative flex items-center gap-2.5">
        <Icon name="spark" size={17} strokeWidth={2} className="animate-breathe" />
        A new version is ready.
      </span>
      <Button
        variant="ghost"
        tone="onAccent"
        size="sm"
        className="relative"
        onClick={() => void updateServiceWorker(true)}
      >
        Reload
      </Button>
    </div>
  );
}

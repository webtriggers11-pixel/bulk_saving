import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../../components/ui/button';

/**
 * Offers the waiting service worker (FEAT-008 AC9). `registerType: 'autoUpdate'`
 * installs a new build in the background; this makes the switch a deliberate tap
 * so a resident is never refreshed out from under a half-filled pledge form.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-prompt"
      className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-teal-700 px-4 py-2 text-sm text-white"
    >
      <span>A new version is ready.</span>
      <Button variant="ghost" className="text-white underline" onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
    </div>
  );
}

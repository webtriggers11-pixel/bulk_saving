import { useCallback, useEffect, useState } from 'react';

/**
 * The `beforeinstallprompt` event, which is not in the DOM lib types because it
 * is not a standard — Chromium-only. Declared minimally rather than cast to any
 * (ARCHITECTURE.md: never `any`).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Install affordance state (FEAT-008 AC5). The browser fires
 * `beforeinstallprompt` only when the app is actually installable — not already
 * installed, manifest + SW in place — so `canInstall` is the honest signal for
 * showing the control. iOS Safari never fires it, which is why the Profile page
 * falls back to the Share-sheet hint rather than a dead button.
 */
export function useInstallPrompt(): { canInstall: boolean; promptInstall: () => Promise<void> } {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const capture = (e: Event): void => {
      // Keep the browser's own mini-infobar from appearing; we offer the control.
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const installed = (): void => setEvent(null);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!event) {
      return;
    }
    await event.prompt();
    // The event is single-use: whatever the resident chose, it cannot fire again.
    setEvent(null);
  }, [event]);

  return { canInstall: event !== null, promptInstall };
}

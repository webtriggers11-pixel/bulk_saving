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
 * MODULE-SCOPE capture, installed when this module is first imported.
 *
 * Chromium fires `beforeinstallprompt` ONCE, shortly after load, on whatever
 * route the resident landed on — and never again on an SPA route change. A
 * listener that only exists while the Profile tab is mounted therefore misses it
 * every time in production (V2 P1-1: the original hook was mounted only by
 * ProfilePage, so `canInstall` was false by the time anyone opened that tab, and
 * an Android user was shown the iOS fallback hint).
 *
 * So the event is captured here and held, and the hook subscribes to the held
 * value. `main.tsx` imports this module for its side effect so the listener is
 * attached at startup, not at first render of a tab nobody has opened yet.
 */
let heldEvent: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<(event: BeforeInstallPromptEvent | null) => void>();

function publish(event: BeforeInstallPromptEvent | null): void {
  heldEvent = event;
  for (const notify of subscribers) {
    notify(event);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Suppress Chromium's own mini-infobar; the Profile tab offers the control.
    e.preventDefault();
    publish(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => publish(null));
}

/** True when the app is already running as an installed PWA. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(display-mode: standalone)').matches;
}

/** Test seam: forget any captured event (module state outlives a render). */
export function resetInstallPrompt(): void {
  publish(null);
}

/**
 * Install affordance state (FEAT-008 AC5). `canInstall` is true only while the
 * browser has told us the app is genuinely installable — not already installed,
 * manifest + service worker in place. iOS Safari never fires the event, which is
 * why the Profile page falls back to the Share-sheet hint rather than a dead
 * button.
 */
export function useInstallPrompt(): { canInstall: boolean; promptInstall: () => Promise<void> } {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(heldEvent);

  useEffect(() => {
    // Re-read on mount: the event may have fired before this component existed —
    // which is the normal case, since it fires on load and this tab is opened later.
    setEvent(heldEvent);
    subscribers.add(setEvent);
    return () => {
      subscribers.delete(setEvent);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!event) {
      return;
    }
    try {
      await event.prompt();
      // `userChoice` is the accurate "the resident has decided" signal; awaiting
      // it keeps the control on screen until the browser's dialog is answered.
      await event.userChoice;
    } catch {
      // A rejected prompt() must not leave an unhandled rejection or a stuck
      // control — the event is single-use either way.
    } finally {
      publish(null);
    }
  }, [event]);

  return { canInstall: event !== null, promptInstall };
}

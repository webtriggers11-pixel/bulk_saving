import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Sheet } from '../../components/ui/sheet';
import { Toast } from '../../components/ui/toast';
import { installPlatform, type InstallPlatform } from './install-platform';
import { useInstallPrompt } from './useInstallPrompt';

/** Per-visit snooze: sessionStorage, so the NEXT time the app is opened it asks again (AC4). */
export const INSTALL_SNOOZE_KEY = 'bulk:install-snoozed';
/** Let the first screen paint before asking. */
export const INSTALL_TOAST_DELAY_MS = 2_000;

function snoozed(): boolean {
  try {
    return window.sessionStorage.getItem(INSTALL_SNOOZE_KEY) === '1';
  } catch {
    return false;
  }
}

function snooze(): void {
  try {
    window.sessionStorage.setItem(INSTALL_SNOOZE_KEY, '1');
  } catch {
    // Private mode / blocked storage: it may ask again this visit; never throw.
  }
}

type ManualPlatform = Exclude<InstallPlatform, 'prompt' | 'none'>;

const STEPS: Record<ManualPlatform, { description: string; steps: string[] }> = {
  'ios-safari': {
    description: 'Safari adds it to your home screen in three taps.',
    steps: [
      'Tap the Share button (the square with an arrow). On newer iPhones it is under "⋯" next to the address bar.',
      'Scroll down and tap "Add to Home Screen".',
      'Tap "Add". Bulk Saving now opens from your home screen like any other app.',
      // V2 P2-1: WhatsApp, Gmail and X open links in a Safari view that looks identical but has no "Add to Home Screen".
      'Don\'t see "Add to Home Screen"? You are in an app\'s browser: tap the compass icon (or "Open in Safari") first.',
    ],
  },
  'ios-other': {
    description: 'Your browser can add it to your home screen.',
    steps: [
      'Tap the Share button in the address bar.',
      'Tap "Add to Home Screen", then "Add".',
      "Don't see it? Open this page in Safari and add it from there.",
    ],
  },
  'ios-inapp': {
    description: "This app's built-in browser can't install apps.",
    steps: [
      'Tap "⋯" or the compass icon and choose "Open in Safari" (or copy the link into Safari).',
      'In Safari, tap Share, then "Add to Home Screen".',
    ],
  },
  'android-inapp': {
    description: "This app's built-in browser can't install apps.",
    steps: [
      'Tap ⋮ at the top right and choose "Open in Chrome" (or "Open in browser").',
      'In Chrome, tap ⋮ again, then "Install app" or "Add to Home screen".',
    ],
  },
  'android-manual': {
    description: 'Your browser can install it from its menu.',
    steps: [
      'Tap the browser menu (⋮ at the top right, or ≡ at the bottom in Samsung Internet).',
      'Tap "Install app" or "Add to Home screen".',
      "Don't see it? Open this page in Chrome and try again.",
    ],
  },
};

/**
 * FEAT-042 (ADR-0049): the install ask, every time the app is opened, on every route (it is
 * mounted at the root, so sign-in, onboarding and admin get it too). Chromium: one tap opens
 * its own dialog. Everywhere else (iOS has no install API) Install opens the steps for that
 * browser. Close snoozes it for this visit only.
 */
export function InstallToast() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(snoozed);
  const [installed, setInstalled] = useState(false);
  // Frozen when the sheet opens (V2 P3-1): a prompt arriving mid-read must not unmount it.
  const [sheetFor, setSheetFor] = useState<ManualPlatform | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), INSTALL_TOAST_DELAY_MS);
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Re-read on every render: a prompt that arrives after the toast is up turns it into one-tap install (AC5).
  const platform = installPlatform(canInstall);
  const manual: ManualPlatform | null = platform === 'prompt' || platform === 'none' ? null : platform;

  function dismiss() {
    snooze();
    setHidden(true);
  }

  function install() {
    if (platform === 'prompt') {
      // The browser's dialog takes over; whatever they choose, don't ask again this visit.
      dismiss();
      void promptInstall();
    } else if (manual) {
      setSheetFor(manual);
    }
  }

  const showToast = ready && !hidden && !installed && platform !== 'none';
  const guide = sheetFor ? STEPS[sheetFor] : null;

  return (
    <>
      <Toast
        placement="top"
        yieldTop
        duration={null}
        onDismiss={dismiss}
        action={
          <Button size="sm" variant="secondary" onClick={install} className="shrink-0 self-center" data-testid="install-toast-install">
            Install
          </Button>
        }
      >
        {showToast ? (
          <span data-testid="install-toast" data-platform={platform}>
            <span className="block font-extrabold">Install Bulk Saving</span>
            <span className="block font-medium opacity-75">
              Opens from your home screen like an app: full screen, faster, with notifications.
            </span>
          </span>
        ) : null}
      </Toast>
      {guide && (
        <Sheet
          open
          // Closing returns to the toast and its Install button (V2 P3-2); the toast's own close snoozes.
          onClose={() => setSheetFor(null)}
          title="Add Bulk Saving to your home screen"
          description={guide.description}
        >
          <ol className="flex flex-col gap-3" data-testid="install-steps">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-body text-ink">
                <span
                  aria-hidden="true"
                  className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-meta font-extrabold text-brand-ink"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Sheet>
      )}
    </>
  );
}

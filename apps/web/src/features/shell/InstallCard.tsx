import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { isStandalone, useInstallPrompt } from './useInstallPrompt';

export const INSTALL_CARD_KEY = 'bulk:install-dismissed';

function dismissedBefore(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_CARD_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Safari on iPhone/iPad — the one browser with no install prompt, where the steps are the
 * Share sheet. Other iOS browsers (CriOS, FxiOS, EdgiOS) can't add to the home screen the same
 * way, so they get nothing rather than wrong steps. iPadOS reports a Mac UA with touch.
 */
export function isIosSafari(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent;
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** iOS sets `navigator.standalone` when launched from the home screen. */
function launchedFromHomeScreen(): boolean {
  return isStandalone() || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * FEAT-029 (ADR-0041): the install ask, on Home where a resident lands, not only under
 * Profile. Shown while the app runs in a browser tab AND can actually be installed: Chromium
 * has handed us its prompt, or this is iOS Safari (Share-sheet steps). "Not now" is
 * remembered per device; Profile keeps its row either way.
 */
export function InstallCard() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(dismissedBefore);
  const ios = isIosSafari();
  if (dismissed || launchedFromHomeScreen() || (!canInstall && !ios)) return null;

  function notNow() {
    setDismissed(true);
    try {
      window.localStorage.setItem(INSTALL_CARD_KEY, '1');
    } catch {
      // Private mode: it shows again next visit, which is fine.
    }
  }

  return (
    <Card
      surface="tint"
      interactive={false}
      padding="none"
      className="col-span-2 flex items-center gap-3.5 p-[18px]"
      data-testid="install-card"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-paper/70 text-brand-ink">
        <Icon name="install" size={20} strokeWidth={1.8} />
      </span>
      <p className="min-w-0 flex-1 text-meta text-ink-muted">
        <span className="block font-extrabold text-ink">Install the app</span>
        {canInstall ? (
          'One tap from your home screen, full screen, with notifications.'
        ) : (
          <span data-testid="install-card-ios">Tap Share, then &quot;Add to Home Screen&quot;.</span>
        )}
      </p>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {canInstall && (
          <Button size="sm" onClick={() => void promptInstall()}>
            Install
          </Button>
        )}
        <Button variant="link" onClick={notNow}>
          {canInstall ? 'Not now' : 'Got it'}
        </Button>
      </div>
    </Card>
  );
}

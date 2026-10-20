import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Notice } from '../../components/ui/notice';
import { OFFLINE_QUEUED_TEXT } from '../../lib/offline';
import { authErrorMessage, messageFromError } from './error-messages';
import type { useWhatsAppLogin } from './useWhatsAppLogin';
import { devWhatsAppPanelEnabled } from './useDevWhatsApp';
import { DevWhatsAppPanel } from './DevWhatsAppPanel';

type Login = ReturnType<typeof useWhatsAppLogin>;

/** A phone opens the `wa.me` link in WhatsApp itself; everything else gets a QR to scan. */
export function isPhoneLike(userAgent = navigator.userAgent): boolean {
  return /Android|iPhone|iPod|iPad|Mobile/i.test(userAgent);
}

/** The QR of the same link, for a laptop. `qrcode` is loaded only here, only then. */
function useQrDataUrl(link: string | null, wanted: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!link || !wanted) {
      setUrl(null);
      return;
    }
    let live = true;
    void import('qrcode')
      .then((qr) => qr.toDataURL(link, { margin: 2, width: 224, errorCorrectionLevel: 'M' }))
      .then((dataUrl) => {
        if (live) setUrl(dataUrl);
      })
      .catch(() => {
        if (live) setUrl(null);
      });
    return () => {
      live = false;
    };
  }, [link, wanted]);
  return url;
}

interface WhatsAppSignInProps {
  login: Login;
  /** Back to the SMS code. */
  onUseSms: () => void;
  /** The WhatsApp side, in DEV: a phone to pretend with. */
  phoneLike?: boolean;
}

/**
 * The "Tap to verify" step (FEAT-027, ADR-0038 §8): the number to match, large; what to do,
 * short; and a live line that follows the server — waiting, received, done. On a phone the
 * button opens WhatsApp with the message ready; on a laptop a QR code carries the same link.
 */
export function WhatsAppSignIn({ login, onUseSms, phoneLike = isPhoneLike() }: WhatsAppSignInProps) {
  const { view, start, reset, startError, queuedOffline, stalled } = login;
  const session = 'session' in view ? view.session : null;
  const qr = useQrDataUrl(session?.waLink ?? null, !phoneLike);

  // Start once on mount. A ref, because StrictMode runs effects twice in development and
  // a second start would spend a second request (and a second code) for nothing.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (view.phase === 'idle') start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = view.phase === 'denied' || view.phase === 'expired';

  return (
    <div className="field" data-testid="whatsapp-sign-in" data-phase={view.phase}>
      <h2 className="text-title font-extrabold text-ink">Confirm it's you on WhatsApp</h2>
      <p className="mb-6 mt-2 text-caption text-ink-muted">
        {phoneLike ? 'Send the ready-made message, then tap the number below in our reply.' : 'Scan with your phone, send the ready-made message, then tap the number below in our reply.'}
      </p>

      {startError && <Notice tone="error">{messageFromError(startError)}</Notice>}
      {queuedOffline && (
        <Notice tone="warn" data-testid="whatsapp-offline">
          {OFFLINE_QUEUED_TEXT}
        </Notice>
      )}

      {session && (
        <>
          <div className="surface-tint flex items-center gap-4 rounded-tile border border-paper/70 px-5 py-4" data-testid="whatsapp-match">
            <span className="text-eyebrow uppercase text-ink-muted">Your number</span>
            <span className="num ml-auto text-hero font-extrabold leading-none text-brand-ink" data-testid="whatsapp-match-number">
              {session.matchNumber}
            </span>
          </div>

          {!phoneLike && (
            <div className="mt-4 flex flex-col items-center gap-3" data-testid="whatsapp-qr">
              {qr ? (
                // The image carries its own white quiet zone (the scanner needs it in dark mode too), so no
                // surface colour here — white belongs to accent fills only (FEAT-016 AC3).
                <img src={qr} width={224} height={224} alt="QR code — scan it with your phone's camera to open WhatsApp with the message ready" className="rounded-tile border border-paper/70" />
              ) : (
                <span className="block h-[224px] w-[224px] animate-breathe rounded-tile bg-line/10" aria-hidden="true" />
              )}
              <a href={session.waLink} target="_blank" rel="noopener noreferrer" className="text-caption font-semibold text-brand-ink underline underline-offset-4">
                Using WhatsApp on this computer? Open the chat
              </a>
            </div>
          )}

          <ol className="mt-5 flex flex-col gap-2 text-caption text-ink-muted" aria-label="Steps">
            <li className="flex gap-2"><span className="num font-extrabold text-ink">1</span>{phoneLike ? 'Open WhatsApp — the message is ready. Tap Send.' : 'Scan the code, then tap Send in WhatsApp.'}</li>
            <li className="flex gap-2"><span className="num font-extrabold text-ink">2</span><span>We reply at once. Tap <strong className="num text-ink">{session.matchNumber}</strong>.</span></li>
            <li className="flex gap-2"><span className="num font-extrabold text-ink">3</span>Come back here — you're in.</li>
          </ol>

          {!failed && (
            <p role="status" aria-live="polite" className="mt-5 flex items-center gap-2 text-caption font-semibold text-ink-muted" data-testid="whatsapp-status">
              {stalled ? (
                <>
                  <Icon name="offline" size={15} strokeWidth={2.2} />
                  Waiting for a connection…
                </>
              ) : view.phase === 'awaiting_confirm' ? (
                <>
                  <Icon name="check" size={15} strokeWidth={2.2} className="text-brand-ink" />
                  Message received. Now tap <strong className="num text-ink">{session.matchNumber}</strong> in WhatsApp.
                </>
              ) : (
                <>
                  <Icon name="refresh" size={15} strokeWidth={2.2} className="animate-spin-slow" />
                  Waiting for your message…
                </>
              )}
            </p>
          )}

          {view.phase === 'denied' && (
            <Notice tone="error" data-testid="whatsapp-denied">
              {view.reason === 'NOT_AN_ADMIN' ? authErrorMessage('NOT_AN_ADMIN') : "That wasn't the number on this screen, so nothing happened."}
            </Notice>
          )}
          {view.phase === 'expired' && (
            <Notice tone="error" data-testid="whatsapp-expired">
              This sign-in expired. Start again when you're ready.
            </Notice>
          )}

          {failed ? (
            <Button className="mt-[22px] w-full" onClick={() => { reset(); start(); }}>
              Start again
              <Icon name="refresh" size={18} strokeWidth={2.2} />
            </Button>
          ) : phoneLike ? (
            <Button className="mt-[22px] w-full" onClick={() => window.open(session.waLink, '_blank', 'noopener')} data-testid="whatsapp-open">
              <Icon name="chat" size={18} strokeWidth={2.2} />
              Open WhatsApp
            </Button>
          ) : null}

          {devWhatsAppPanelEnabled() && !failed && <DevWhatsAppPanel code={session.code} />}
        </>
      )}

      {view.phase === 'starting' && (
        <p role="status" className="mt-4 text-caption font-semibold text-ink-muted">Setting up…</p>
      )}

      <p className="mt-4 text-center text-caption font-medium text-ink-muted">
        No WhatsApp on this number?{' '}
        <Button variant="link" onClick={onUseSms}>
          Use an SMS code instead
        </Button>
      </p>
    </div>
  );
}

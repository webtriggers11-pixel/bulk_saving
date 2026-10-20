import { useCallback, useEffect, useRef, useState } from 'react';
import { normalisePhone, whatsAppLoginMessage } from '@bulk/shared';

/** What the business "replied" (the stub sender's stash). */
export interface DevWaPrompt {
  body: string;
  buttons: Array<{ id: string; title: string }>;
  at: string;
}

/**
 * DEV ONLY (FEAT-027; ADR-0037's gates): the same build-time constant as the dev OTP toast,
 * so the production bundle never contains the simulator — asserted by `check-dev-only.mjs`.
 */
export function devWhatsAppPanelEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.MODE !== 'test';
}

/**
 * Plays the WhatsApp side of a sign-in against the dev-only routes: "send the message as
 * this number", then "tap this button". Reads back what the stub sender replied.
 */
export function useDevWhatsApp(code: string) {
  const [prompt, setPrompt] = useState<DevWaPrompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async (phone: string, after: string | null) => {
    const mine = ++generation.current;
    const { fetchDevWhatsAppPrompt } = await import('./dev-whatsapp.api');
    const found = await fetchDevWhatsAppPrompt(phone, after);
    if (generation.current === mine) setPrompt(found);
  }, []);

  const sendMessage = useCallback(
    async (rawPhone: string) => {
      const phone = normalisePhone(rawPhone);
      if (!phone || !devWhatsAppPanelEnabled()) return;
      setBusy(true);
      setError(null);
      try {
        const { devWhatsAppInbound } = await import('./dev-whatsapp.api');
        await devWhatsAppInbound({ from: phone, text: whatsAppLoginMessage(code), name: 'Dev Tester' });
        await refresh(phone, prompt?.at ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The dev route did not answer.');
      } finally {
        setBusy(false);
      }
    },
    [code, prompt?.at, refresh],
  );

  const tap = useCallback(
    async (rawPhone: string, buttonId: string) => {
      const phone = normalisePhone(rawPhone);
      if (!phone || !devWhatsAppPanelEnabled()) return;
      setBusy(true);
      setError(null);
      try {
        const { devWhatsAppTap } = await import('./dev-whatsapp.api');
        await devWhatsAppTap({ from: phone, buttonId });
        await refresh(phone, prompt?.at ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The dev route did not answer.');
      } finally {
        setBusy(false);
      }
    },
    [prompt?.at, refresh],
  );

  useEffect(() => () => {
    generation.current += 1;
  }, []);

  return { prompt, error, busy, sendMessage, tap };
}

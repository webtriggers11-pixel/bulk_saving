import { useCallback, useState } from 'react';
import { normalisePhone } from '@bulk/shared';
import { apiRequest } from '../../lib/api';

/** How long the admin door's QUEUED send is given to land in the stash (ms, total). */
const ATTEMPTS = [0, 400, 800, 1600];

/**
 * DEV ONLY (FEAT-026, ADR-0037): the code the stub SMS channel just "sent", for a toast.
 *
 * The production bundle contains none of this: `import.meta.env.DEV` is a build-time constant,
 * so the whole branch is dropped. In a dev build the backend route exists only under
 * `OTP_DEV_LOG=true`; a 404 (or any failure) simply means no toast. Vitest runs with DEV true
 * and MODE "test": the hook stays silent there unless a test opts in, so the page suites do
 * not see an extra request they never asked for (V1).
 */
export function devOtpToastEnabled(): boolean {
  return Boolean(import.meta.env.DEV) && import.meta.env.MODE !== 'test';
}

export function useDevOtp(): { code: string | null; fetchFor: (phone: string) => void; clear: () => void } {
  const [code, setCode] = useState<string | null>(null);
  const fetchFor = useCallback((phone: string) => {
    if (!devOtpToastEnabled()) return;
    const canonical = normalisePhone(phone);
    if (!canonical) return;
    void (async () => {
      for (const wait of ATTEMPTS) {
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        try {
          const found = await apiRequest<{ code: string }>(`/dev/otp?phone=${encodeURIComponent(canonical)}`, { auth: false });
          setCode(found.code);
          return;
        } catch {
          // Not stashed yet (queued send), or no dev route at all: try again, then give up quietly.
        }
      }
    })();
  }, []);
  const clear = useCallback(() => setCode(null), []);
  return { code, fetchFor, clear };
}

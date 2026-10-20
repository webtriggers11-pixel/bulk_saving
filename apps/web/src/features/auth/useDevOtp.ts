import { useCallback, useState } from 'react';
import { normalisePhone } from '@bulk/shared';

/**
 * DEV ONLY (FEAT-026, ADR-0037): the code the stub SMS channel just "sent", for a toast.
 *
 * `import.meta.env.DEV` and `MODE` are build-time constants: in a production bundle the
 * condition folds to `false`, the dynamic `import()` below is never emitted, and
 * `dev-otp.api.ts` is not in the bundle at all (asserted by `scripts/check-dev-only.mjs`
 * reading the built assets). Vitest runs with DEV true and MODE "test": the hook stays silent
 * there unless a test opts in, so the page suites never see a request they did not ask for.
 */
export function devOtpToastEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.MODE !== 'test';
}

export function useDevOtp(): { code: string | null; fetchFor: (phone: string) => void; clear: () => void } {
  const [code, setCode] = useState<string | null>(null);
  const fetchFor = useCallback((phone: string) => {
    if (!devOtpToastEnabled()) return;
    const canonical = normalisePhone(phone);
    if (!canonical) return;
    void import('./dev-otp.api').then(({ fetchDevOtp }) => fetchDevOtp(canonical)).then((found) => {
      if (found) setCode(found);
    });
  }, []);
  const clear = useCallback(() => setCode(null), []);
  return { code, fetchFor, clear };
}

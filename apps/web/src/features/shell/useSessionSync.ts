import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '../auth/auth.api';
import { useAuthStore } from '../auth/auth.store';

/**
 * Keeps the persisted session in step with what the API knows (CHORE-009).
 *
 * `POST /auth/otp/verify` returns tokens and a resident, and no society — so after a
 * real sign-in the store held `society: null` and the Profile tab rendered "—" where
 * the design shows the society's name. Profile reads the store rather than the
 * network on purpose (ADR-0015: it is the one screen that must work offline), so the
 * fix is to teach the store, not to make Profile fetch.
 *
 * Uses the SAME query key as HomePage, so TanStack serves both from one request
 * rather than adding a second.
 */
export function useSessionSync(): void {
  const setSociety = useAuthStore((state) => state.setSociety);
  const signedIn = useAuthStore((state) => state.accessToken !== null);
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: signedIn,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (data?.society) {
      setSociety(data.society);
    }
  }, [data, setSociety]);
}

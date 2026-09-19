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
 * Write-once per session, deliberately: once the society is known the query is
 * disabled, so a society RENAMED mid-session keeps its old name here until the next
 * sign-in, while Home (which has its own always-enabled `me` query) shows the new
 * one. That is the price of not adding a request to four screens that never had one;
 * it is a rename, and a sign-in fixes it (V2 round 2).
 */
export function useSessionSync(): void {
  const setSociety = useAuthStore((state) => state.setSociety);
  const residentId = useAuthStore((state) => state.resident?.id);
  const society = useAuthStore((state) => state.society);

  // Only asks when there is something to learn. Without this the shell issued a
  // `me` request on four screens that never had one — a behavioural change inside a
  // parity pass (V2 P2-3). Once the society is known, this costs nothing.
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: residentId !== undefined && society == null,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    // Only write a society we can prove belongs to the resident in the session. A
    // cached `me` from the PREVIOUS resident on a shared phone is exactly the thing
    // ADR-0015 exists to prevent, and this store is persisted, so the mistake would
    // outlive the cache (V2 P1-2).
    if (data?.society && data.resident.id === residentId && data.society.id !== society?.id) {
      setSociety(data.society);
    }
  }, [data, residentId, society, setSociety]);
}

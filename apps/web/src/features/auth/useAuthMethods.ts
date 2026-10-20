import { useQuery } from '@tanstack/react-query';
import type { AuthMethods } from '@bulk/shared';
import { fetchAuthMethods } from './wa.api';

const NONE: AuthMethods = { whatsapp: false };

/**
 * Which sign-in methods to offer (FEAT-027, ADR-0038 §8). Until the server has answered —
 * or if it cannot be asked (offline, down) — only the SMS code is offered: a door that
 * might not open is worse than one that is not shown.
 */
export function useAuthMethods(): AuthMethods {
  const query = useQuery({
    queryKey: ['auth', 'methods'],
    queryFn: fetchAuthMethods,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return query.data ?? NONE;
}

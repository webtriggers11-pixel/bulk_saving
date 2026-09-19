import { QueryClient } from '@tanstack/react-query';

/**
 * The app's one QueryClient (CHORE-009, V2 P1-2).
 *
 * It used to be constructed inside `main.tsx`, which meant the FORCED logout path in
 * `api.ts` — the one that fires when a refresh is refused — could not reach it. Both
 * explicit logouts clear the cache (ADR-0015: "the next resident on this phone must
 * not see the previous one's rounds"); the forced one could not, so one resident's
 * cached `me` could still be served to the next person to sign in on that phone.
 *
 * Exported as a module singleton so every logout, however it is triggered, can empty it.
 */
export const queryClient = new QueryClient();

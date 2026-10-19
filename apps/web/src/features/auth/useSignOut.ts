import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { releasePushOnSignOut } from '../../lib/push';
import { endSession } from './auth.api';
import { useAuthStore } from './auth.store';

/** How long the server is given to end the session before this phone forgets it anyway. */
const SERVER_CAP_MS = 3_000;

/**
 * The one explicit sign-out (Home and Profile both offer it). In order:
 *  1. release this phone from push, telling the server (FEAT-020) — bounded;
 *  2. end THIS device's session on the server (BUG-017, ADR-0034) — bounded, best effort:
 *     offline, the handle stays and still honours a token this phone has now forgotten,
 *     which is the same residual a lost phone has, and the kill switch covers it;
 *  3. forget the session here, drop every cached server row (ADR-0015), go to onboarding.
 *
 * Steps 1 and 2 run while the access token still works; step 3 never waits on them past
 * their caps, so a dead network cannot keep someone signed in.
 */
export function useSignOut(): () => Promise<void> {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);

  return useCallback(async () => {
    await releasePushOnSignOut({ server: true });
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      let timer = 0;
      try {
        await Promise.race([
          endSession({ refreshToken }).catch(() => undefined),
          new Promise((resolve) => (timer = window.setTimeout(resolve, SERVER_CAP_MS))),
        ]);
      } finally {
        window.clearTimeout(timer);
      }
    }
    logout();
    queryClient.clear();
    navigate('/onboard', { replace: true });
  }, [logout, navigate, queryClient]);
}

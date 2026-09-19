import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { queryClient } from '../../lib/query-client';
import { provideSession } from '../../lib/session-port';
import type { AuthTokens, ResidentDto, SocietyDto } from '@bulk/shared';

/**
 * Session/auth state. Holds ONLY the session identity + tokens (client state) —
 * never cached server data. The authed landing reads the live profile from
 * GET /me via TanStack Query; this store is not a server-data cache.
 *
 * SECURITY NOTE (v1): tokens are persisted to localStorage so a reload stays
 * logged in. localStorage is readable by any script on the origin, so this
 * carries an XSS risk. A future hardening step is to move refresh tokens to an
 * httpOnly, Secure, SameSite cookie issued by the API and keep only the
 * short-lived access token in memory. Tracked as a pre-launch improvement.
 */
export type AuthStatus = 'authenticated' | 'unauthenticated';

interface LoginPayload {
  accessToken: string;
  refreshToken: string;
  resident: ResidentDto;
  /** Society is optional here: /auth/otp/verify returns only the resident. */
  society?: SocietyDto | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  resident: ResidentDto | null;
  society: SocietyDto | null;
  status: AuthStatus;
  /** Establish a session after OTP verify. */
  login: (payload: LoginPayload) => void;
  /** Replace tokens after a transparent refresh rotation. */
  setTokens: (tokens: AuthTokens) => void;
  setSociety: (society: SocietyDto) => void;
  /** Clear the session (explicit logout, or refresh failure). */
  logout: () => void;
}

/**
 * localStorage-backed storage that is safe in private mode / blocked-storage
 * environments: every access is wrapped so a throw never breaks the app.
 */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* private mode / storage disabled — session is simply not persisted */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      resident: null,
      society: null,
      status: 'unauthenticated',
      login: ({ accessToken, refreshToken, resident, society }) =>
        set({
          accessToken,
          refreshToken,
          resident,
          society: society ?? null,
          status: 'authenticated',
        }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      /**
       * `POST /auth/otp/verify` returns tokens + resident and NO society, so a
       * freshly signed-in resident had `society: null` and the Profile tab — which
       * reads the store, never the network, so it works offline (ADR-0015) — showed
       * "—" where the design shows their society. `GET /me` has it; this is how the
       * store learns (CHORE-009).
       */
      setSociety: (society) => set({ society }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          resident: null,
          society: null,
          status: 'unauthenticated',
        }),
    }),
    {
      name: 'bulk-saving-auth',
      storage: createJSONStorage(() => safeStorage),
      // Persist only the session fields; never persist actions.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        resident: state.resident,
        society: state.society,
        status: state.status,
      }),
    },
  ),
);

/**
 * Fill the session port `lib/api.ts` reads (ADR-0022): the API client must not import
 * a feature, so the feature registers itself here. Runs on first import of the store,
 * which every caller of the API already does — including the tests.
 */
provideSession({
  accessToken: () => useAuthStore.getState().accessToken,
  refreshToken: () => useAuthStore.getState().refreshToken,
  setTokens: (tokens) => useAuthStore.getState().setTokens(tokens),
  logout: () => {
    useAuthStore.getState().logout();
    // A forced logout must empty the cache too, or the next resident to sign in on
    // this phone can be served the previous one's data (ADR-0015, V2 P1-2). The two
    // explicit logouts already do this; this is the path that could not reach it.
    queryClient.clear();
  },
});

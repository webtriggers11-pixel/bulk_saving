import type { AuthTokens } from '@bulk/shared';

/**
 * The session, as the API client needs it (CHORE-008, ADR-0022).
 *
 * `lib/api.ts` imported `features/auth/auth.store` directly, which is the same
 * inversion the dependency test caught in `components/` — a shared module reaching
 * into a feature. The dependency now points the other way: `lib` declares the port,
 * the auth feature fills it, and the API client knows only this interface.
 *
 * Unregistered, it behaves like a logged-out session rather than throwing: a request
 * made before the app has mounted should be anonymous, not fatal.
 */
export interface SessionPort {
  accessToken: () => string | null;
  refreshToken: () => string | null;
  setTokens: (tokens: AuthTokens) => void;
  logout: () => void;
}

const ANONYMOUS: SessionPort = {
  accessToken: () => null,
  refreshToken: () => null,
  setTokens: () => undefined,
  logout: () => undefined,
};

let current: SessionPort = ANONYMOUS;

/** Called once by the auth feature, which owns the session. */
export function provideSession(port: SessionPort): void {
  current = port;
}

export function session(): SessionPort {
  return current;
}

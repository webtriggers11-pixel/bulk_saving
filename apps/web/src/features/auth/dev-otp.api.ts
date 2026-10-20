import { apiRequest } from '../../lib/api';

/** How long the admin door's QUEUED send is given to land in the stash (ms, cumulative waits). */
const ATTEMPTS = [0, 400, 800, 1600];

/**
 * DEV ONLY (FEAT-026, ADR-0037): the code the stub SMS channel just "sent" to a phone, from
 * the backend's dev-only route. This module is reached ONLY through a dynamic `import()`
 * behind a build-time constant in `useDevOtp`, so a production bundle does not contain it
 * at all — not as dead code, not as a chunk. Resolves null when there is no code (404, no
 * route, offline) after a few short retries.
 */
export async function fetchDevOtp(canonicalPhone: string): Promise<string | null> {
  for (const wait of ATTEMPTS) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const found = await apiRequest<{ code: string }>(`/dev/otp?phone=${encodeURIComponent(canonicalPhone)}`, { auth: false });
      return found.code;
    } catch {
      // Not stashed yet (queued send), or no dev route: try again, then give up quietly.
    }
  }
  return null;
}

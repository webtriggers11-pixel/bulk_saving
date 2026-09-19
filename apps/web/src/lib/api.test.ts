import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse, ResidentDto } from '@bulk/shared';
import { apiRequest, ApiError } from './api';
import { useAuthStore } from '../features/auth/auth.store';
import { queryClient } from './query-client';

const resident: ResidentDto = {
  id: 'res_1',
  societyId: 'soc_1',
  phone: '+919876543210',
  name: 'Priya',
  role: 'RESIDENT',
  verifiedAt: '2026-09-16T00:00:00.000Z',
  createdAt: '2026-09-16T00:00:00.000Z',
};

const me: MeResponse = { resident, society: { id: 'soc_1', name: 'Green Acres', city: 'Pune' } };

function bearer(init?: RequestInit): string | undefined {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.Authorization;
}

function ok(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}
function unauthorized() {
  return {
    ok: false,
    status: 401,
    json: () =>
      Promise.resolve({ success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } }),
  };
}

describe('apiRequest transparent refresh', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    useAuthStore.getState().logout();
    useAuthStore.getState().login({ accessToken: 'old', refreshToken: 'r1', resident });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes once on a 401 and retries the original request with the new token', async () => {
    const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(ok({ success: true, data: { accessToken: 'new', refreshToken: 'r2' } }));
      }
      if (url.endsWith('/me')) {
        return Promise.resolve(bearer(init) === 'Bearer new' ? ok({ success: true, data: me }) : unauthorized());
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    vi.stubGlobal('fetch', mock);

    const result = await apiRequest<MeResponse>('/me');
    expect(result.society.name).toBe('Green Acres');
    expect(useAuthStore.getState().accessToken).toBe('new');
    const refreshCalls = mock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('collapses concurrent 401s into a single refresh (no stampede)', async () => {
    const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(ok({ success: true, data: { accessToken: 'new', refreshToken: 'r2' } }));
      }
      if (url.endsWith('/me')) {
        return Promise.resolve(bearer(init) === 'Bearer new' ? ok({ success: true, data: me }) : unauthorized());
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    vi.stubGlobal('fetch', mock);

    await Promise.all([apiRequest<MeResponse>('/me'), apiRequest<MeResponse>('/me')]);
    const refreshCalls = mock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('clears the session and surfaces the error when refresh fails', async () => {
    const mock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () =>
            Promise.resolve({ success: false, error: { code: 'TOKEN_REVOKED', message: 'gone' } }),
        });
      }
      if (url.endsWith('/me')) {
        return Promise.resolve(unauthorized());
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    vi.stubGlobal('fetch', mock);

    await expect(apiRequest<MeResponse>('/me')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

/**
 * BUG-008 — the two ways a refresh can fail are not the same failure.
 *
 * Found in a browser, not by a test: with the API stopped, reloading the app cleared
 * the session and bounced to /onboard instead of showing the error state. A resident
 * on Indian mobile data would then need an SMS OTP to get back in, over the network
 * that just failed.
 */
describe('a refresh that fails', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    useAuthStore.getState().logout();
    useAuthStore.getState().login({ accessToken: 'old', refreshToken: 'r1', resident });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A refresh that answers with `status`, over a request that 401s. */
  function refreshRespondsWith(status: number, body: string, contentType = 'application/json') {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/refresh')) {
        return new Response(body, { status, headers: { 'content-type': contentType } });
      }
      return new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'no' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
  }

  const ENVELOPE = JSON.stringify({ success: false, error: { code: 'INTERNAL', message: 'no' } });

  it.each([
    ['500 — a Redis or database blip inside the refresh', 500, ENVELOPE, 'application/json'],
    ['429 — the global throttler, which a reconnect stampede can trip', 429, ENVELOPE, 'application/json'],
    ['502 — a proxy error page, which is HTML and does not parse', 502, '<html>bad gateway</html>', 'text/html'],
  ])('keeps the session on %s', async (_label, status, body, contentType) => {
    // The bug's own title is "a server hiccup signs the resident out". A body-based
    // check left that literally true for 500 and 429, and accidentally right for 502
    // only because the HTML failed to parse (V2 P1-1).
    refreshRespondsWith(status as number, body as string, contentType as string);
    await expect(apiRequest('/rounds')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().refreshToken).toBe('r1');
  });

  it('keeps the session when nothing answered (network error)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/refresh')) {
        throw new TypeError('Failed to fetch');
      }
      return new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'no' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    // The spec promises the ORIGINAL error surfaces, so assert which one.
    await expect(apiRequest('/rounds')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().refreshToken).toBe('r1');
  });

  it('still clears the session when the server refuses the refresh token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_TOKEN', message: 'no' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'no' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/rounds')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});

/**
 * A 200 that carries `success: false` is a malformed body, not a token refusal — it
 * used to clear the session through the same branch as a real 401 (V2 round 2).
 */
describe('a refresh that answers 200 with a failure envelope', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().login({ accessToken: 'old', refreshToken: 'r1', resident });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const body = String(input).endsWith('/auth/refresh')
          ? { success: false, error: { code: 'WEIRD', message: 'no' } }
          : { success: false, error: { code: 'UNAUTHORIZED', message: 'no' } };
        return new Response(JSON.stringify(body), {
          status: String(input).endsWith('/auth/refresh') ? 200 : 401,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    await expect(apiRequest('/rounds')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });
});

/**
 * P1-2's other half. The identity guard protects `society`; THIS protects rounds,
 * requests and the catalog — ADR-0015's actual sentence is "the next resident on this
 * phone must not see the previous one's rounds". Delete the `queryClient.clear()` in
 * the session port and only this test notices (V2 round 2, P2-B).
 */
describe('a forced logout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it('empties the query cache, not just the session', async () => {
    useAuthStore.getState().logout();
    useAuthStore.getState().login({ accessToken: 'old', refreshToken: 'r1', resident });
    queryClient.setQueryData(['rounds'], [{ id: 'round-of-the-previous-resident' }]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ success: false, error: { code: 'INVALID_TOKEN', message: 'no' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(apiRequest('/rounds')).rejects.toBeInstanceOf(ApiError);

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(queryClient.getQueryData(['rounds'])).toBeUndefined();
  });
});

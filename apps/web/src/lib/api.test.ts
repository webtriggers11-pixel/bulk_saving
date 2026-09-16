import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse, ResidentDto } from '@bulk/shared';
import { apiRequest, ApiError } from './api';
import { useAuthStore } from '../features/auth/auth.store';

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

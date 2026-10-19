import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { endSession } from './auth.api';
import { useAuthStore } from './auth.store';
import { useSignOut } from './useSignOut';
import { signIn, signOutAfterTest } from '../../test/session';

vi.mock('./auth.api', () => ({ endSession: vi.fn() }));
const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const endSessionMock = vi.mocked(endSession);

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['rounds'], [{ id: 'round-1' }]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return { client, ...renderHook(() => useSignOut(), { wrapper }) };
}

describe('useSignOut (BUG-017)', () => {
  beforeEach(() => {
    navigate.mockClear();
    endSessionMock.mockReset();
    signIn();
  });

  afterEach(() => {
    signOutAfterTest();
  });

  it('ends this device\'s session on the server with the token it held, THEN forgets it here', async () => {
    let tokenAtCall: string | null = null;
    endSessionMock.mockImplementation(async () => {
      tokenAtCall = useAuthStore.getState().accessToken;
      return { signedOut: true };
    });
    const { result, client } = setup();

    await act(() => result.current());

    expect(endSessionMock).toHaveBeenCalledWith({ refreshToken: 'test-refresh-token' });
    // The access token was still there when the server was told — the call is authed.
    expect(tokenAtCall).toBe('test-access-token');
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(client.getQueryData(['rounds'])).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/onboard', { replace: true });
  });

  it('still signs out here when the server cannot be reached', async () => {
    endSessionMock.mockRejectedValue(new Error('offline'));
    const { result } = setup();

    await act(() => result.current());

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(navigate).toHaveBeenCalledWith('/onboard', { replace: true });
  });

  it('does not wait on a server that never answers', async () => {
    vi.useFakeTimers();
    try {
      endSessionMock.mockImplementation(() => new Promise(() => undefined));
      const { result } = setup();

      let done = false;
      const run = result.current().then(() => {
        done = true;
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_900);
      });
      expect(done).toBe(false);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      await run;
      expect(done).toBe(true);
      expect(useAuthStore.getState().status).toBe('unauthenticated');
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips the server when there is no session to end', async () => {
    useAuthStore.getState().logout();
    const { result } = setup();
    await act(() => result.current());
    expect(endSessionMock).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/onboard', { replace: true });
  });
});

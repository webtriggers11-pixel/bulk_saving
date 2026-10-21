import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AuthResult, WaStartResponse, WaStatusResponse } from '@bulk/shared';
import { fetchWhatsAppStatus } from './wa.api';
import { useWhatsAppLogin } from './useWhatsAppLogin';

vi.mock('./wa.api', () => ({ fetchWhatsAppStatus: vi.fn() }));
const statusMock = vi.mocked(fetchWhatsAppStatus);

const session: WaStartResponse = {
  requestId: 'r'.repeat(43),
  code: 'BS-7KQ2MX',
  waLink: 'https://wa.me/919876543210?text=My%20Bulk%20Saving%20login%20code%20is%20BS-7KQ2MX',
  matchNumber: 47,
  expiresAt: new Date(Date.now() + 180_000).toISOString(),
};
const confirmed: WaStatusResponse = {
  status: 'confirmed',
  accessToken: 'access-wa',
  refreshToken: 'refresh-wa',
  resident: { id: 'res_1', societyId: 'soc_1', phone: '+919999900201', name: 'Asha', role: 'RESIDENT', verifiedAt: '2026-10-20T00:00:00.000Z', createdAt: '2026-10-20T00:00:00.000Z' },
};

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, Wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}

/** FEAT-027 (ADR-0038 §8): start, poll until decided, hand the tokens over exactly once. */
describe('useWhatsAppLogin', () => {
  afterEach(() => {
    statusMock.mockReset();
  });

  it('polls pending → awaiting_confirm → confirmed, signs in once and drops the request from the cache', async () => {
    // BUG-022: the test advances the server's answer only after it has SEEN the previous
    // phase, so no transition can slip between two waitFor checks whatever the machine load.
    let answer: WaStatusResponse = { status: 'pending' };
    statusMock.mockImplementation(async () => answer);
    const onSignedIn = vi.fn<(r: AuthResult) => void>();
    const { client, Wrapper } = wrapper();
    const { result } = renderHook(() => useWhatsAppLogin(async () => session, onSignedIn, 20), { wrapper: Wrapper });
    expect(result.current.view.phase).toBe('idle');
    act(() => result.current.start());
    await waitFor(() => expect(result.current.view.phase).toBe('pending'), { timeout: 15_000 });
    await waitFor(() => expect(statusMock).toHaveBeenCalled(), { timeout: 15_000 });
    answer = { status: 'awaiting_confirm' };
    await waitFor(() => expect(result.current.view.phase).toBe('awaiting_confirm'), { timeout: 15_000 });
    answer = confirmed;
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1), { timeout: 15_000 });
    expect(result.current.view.phase).toBe('confirmed');
    expect(onSignedIn.mock.calls[0][0]).toEqual({ accessToken: 'access-wa', refreshToken: 'refresh-wa', resident: confirmed.resident });
    expect(client.getQueryData(['auth', 'wa', 'status', session.requestId])).toBeUndefined();
    expect(statusMock).toHaveBeenCalledWith(session.requestId);
    // Settled: no more polling after a terminal answer.
    const calls = statusMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(statusMock.mock.calls.length).toBe(calls);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('shows denied with its reason, and expired; reset returns to idle', async () => {
    statusMock.mockResolvedValue({ status: 'denied', reason: 'NOT_AN_ADMIN' });
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useWhatsAppLogin(async () => session, vi.fn(), 20), { wrapper: Wrapper });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.view.phase).toBe('denied'), { timeout: 15_000 });
    expect(result.current.view).toMatchObject({ phase: 'denied', reason: 'NOT_AN_ADMIN', session });
    act(() => result.current.reset());
    await waitFor(() => expect(result.current.view.phase).toBe('idle'));

    statusMock.mockReset().mockResolvedValue({ status: 'expired' });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.view.phase).toBe('expired'), { timeout: 15_000 });
  });

  it('treats a request past its own expiry as expired even if the server still says pending', async () => {
    statusMock.mockResolvedValue({ status: 'pending' });
    const { Wrapper } = wrapper();
    const stale = { ...session, expiresAt: new Date(Date.now() - 1_000).toISOString() };
    const { result } = renderHook(() => useWhatsAppLogin(async () => stale, vi.fn(), 20), { wrapper: Wrapper });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.view.phase).toBe('expired'));
  });

  it('surfaces a start failure', async () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useWhatsAppLogin(async () => { throw new Error('nope'); }, vi.fn(), 20), { wrapper: Wrapper });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.startError).toBeInstanceOf(Error));
    expect(result.current.view.phase).toBe('idle');
    expect(statusMock).not.toHaveBeenCalled();
  });
});

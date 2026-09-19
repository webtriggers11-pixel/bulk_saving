import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSessionSync } from './useSessionSync';
import { useAuthStore } from '../auth/auth.store';
import * as authApi from '../auth/auth.api';

const resident = {
  id: 'res-1',
  societyId: 'soc-1',
  phone: '+919812345001',
  name: 'Priya Sharma',
  role: 'RESIDENT' as const,
  verifiedAt: '2026-09-19T00:00:00.000Z',
  createdAt: '2026-09-19T00:00:00.000Z',
};
const society = { id: 'soc-1', name: 'Green Meadows', city: 'Pune', inviteCode: 'GREEN001', createdAt: '2026-09-19T00:00:00.000Z' };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSessionSync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().logout();
  });

  it('fills in the society the sign-in response never returned', async () => {
    // This is the real shape: POST /auth/otp/verify has no society, so the store
    // starts with null and Profile would render "—" forever.
    useAuthStore.getState().login({ accessToken: 'a', refreshToken: 'r', resident });
    expect(useAuthStore.getState().society).toBeNull();

    vi.spyOn(authApi, 'fetchMe').mockResolvedValue({ resident, society });
    renderHook(() => useSessionSync(), { wrapper });

    await waitFor(() => expect(useAuthStore.getState().society).toEqual(society));
  });

  it('asks for nothing while signed out', () => {
    const fetchMe = vi.spyOn(authApi, 'fetchMe').mockResolvedValue({ resident, society });
    renderHook(() => useSessionSync(), { wrapper });
    expect(fetchMe).not.toHaveBeenCalled();
  });

  it('asks for nothing once the society is known — the shell must not add traffic', async () => {
    useAuthStore.getState().login({ accessToken: 'a', refreshToken: 'r', resident, society });
    const fetchMe = vi.spyOn(authApi, 'fetchMe').mockResolvedValue({ resident, society });
    renderHook(() => useSessionSync(), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMe).not.toHaveBeenCalled();
  });

  it('refuses a society belonging to the PREVIOUS resident on this phone', async () => {
    // The shared-phone case ADR-0015 is about: a cached `me` from resident A, served
    // to resident B because it is still fresh. The store is persisted, so writing it
    // would outlive the cache entry that caused it (V2 P1-2).
    const otherResident = { ...resident, id: 'res-A', name: 'Someone Else' };
    const otherSociety = { ...society, id: 'soc-A', name: "A's Society" };
    useAuthStore.getState().login({ accessToken: 'a', refreshToken: 'r', resident });
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue({ resident: otherResident, society: otherSociety });

    renderHook(() => useSessionSync(), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(useAuthStore.getState().society).toBeNull();
  });
});

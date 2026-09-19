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
});

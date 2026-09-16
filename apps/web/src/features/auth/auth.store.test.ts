import { beforeEach, describe, expect, it } from 'vitest';
import type { ResidentDto } from '@bulk/shared';
import { useAuthStore } from './auth.store';

const resident: ResidentDto = {
  id: 'res_1',
  societyId: 'soc_1',
  phone: '+919876543210',
  name: 'Priya',
  role: 'RESIDENT',
  verifiedAt: '2026-09-16T00:00:00.000Z',
  createdAt: '2026-09-16T00:00:00.000Z',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    useAuthStore.getState().logout();
  });

  it('login sets status authenticated and persists tokens to localStorage', () => {
    useAuthStore.getState().login({ accessToken: 'access-1', refreshToken: 'refresh-1', resident });

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.accessToken).toBe('access-1');
    expect(state.refreshToken).toBe('refresh-1');
    expect(state.resident?.id).toBe('res_1');

    const persisted = localStorage.getItem('bulk-saving-auth');
    expect(persisted).toContain('access-1');
    expect(persisted).toContain('authenticated');
  });

  it('setTokens rotates the token pair without dropping the session', () => {
    useAuthStore.getState().login({ accessToken: 'access-1', refreshToken: 'refresh-1', resident });
    useAuthStore.getState().setTokens({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-2');
    expect(state.refreshToken).toBe('refresh-2');
    expect(state.status).toBe('authenticated');
  });

  it('logout clears the session', () => {
    useAuthStore.getState().login({ accessToken: 'access-1', refreshToken: 'refresh-1', resident });
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.resident).toBeNull();
  });
});

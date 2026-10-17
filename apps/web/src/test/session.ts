import type { ResidentDto, SocietyDto } from '@bulk/shared';
import { cleanup } from '@testing-library/react';
import { useAuthStore } from '../features/auth/auth.store';

/** A signed-in resident, for tests that need to reach a protected route. */
export function signIn(overrides: { resident?: Partial<ResidentDto>; society?: Partial<SocietyDto> } = {}): void {
  useAuthStore.getState().login({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    resident: {
      id: 'res-1',
      societyId: 'soc-1',
      phone: '+919812345678',
      name: 'Asha',
      role: 'RESIDENT',
      verifiedAt: '2026-09-18T00:00:00.000Z',
      createdAt: '2026-09-18T00:00:00.000Z',
      ...overrides.resident,
    },
    society: {
      id: 'soc-1',
      name: 'Green Meadows',
      city: 'Pune',
      ...overrides.society,
    },
  });
}

/**
 * End-of-test sign-out (CHORE-013). Unmount FIRST, then clear the session.
 *
 * With `globals: true`, Testing Library's auto-cleanup is a file-level afterEach, and
 * Vitest runs a describe block's own afterEach before it — so a bare `logout()` there
 * fired while the screen was still mounted, re-rendered AppShell / AdminRoute /
 * ProfilePage outside act(), and printed ~100 warnings a run that buried real ones.
 */
export function signOutAfterTest(): void {
  cleanup();
  useAuthStore.getState().logout();
}

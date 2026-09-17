import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse, Role } from '@bulk/shared';
import { fetchMe } from '../auth/auth.api';
import { useAuthStore } from '../auth/auth.store';
import { HomePage } from './HomePage';

vi.mock('../auth/auth.api', () => ({
  fetchMe: vi.fn(),
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

const fetchMeMock = vi.mocked(fetchMe);

function me(role: Role): MeResponse {
  return {
    resident: {
      id: 'res_1',
      societyId: 'soc_1',
      phone: '+919800000001',
      name: 'Asha',
      role,
      verifiedAt: '2026-09-16T10:00:00.000Z',
      createdAt: '2026-09-16T10:00:00.000Z',
    },
    society: { id: 'soc_1', name: 'Green Park', city: 'Pune' },
  };
}

function renderAs(role: Role) {
  const profile = me(role);
  fetchMeMock.mockResolvedValue(profile);
  useAuthStore.setState({
    status: 'authenticated',
    accessToken: 'access',
    refreshToken: 'refresh',
    resident: profile.resident,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage admin link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    useAuthStore.getState().logout();
  });

  it('shows the Admin dashboard button to a super-admin', async () => {
    renderAs('SUPER_ADMIN');
    expect(await screen.findByRole('button', { name: 'Admin dashboard' })).toBeInTheDocument();
  });

  it('hides it from a resident', async () => {
    renderAs('RESIDENT');
    await screen.findByRole('button', { name: 'Browse services' });
    expect(screen.queryByRole('button', { name: 'Admin dashboard' })).not.toBeInTheDocument();
  });
});

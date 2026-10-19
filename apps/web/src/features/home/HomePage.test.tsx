import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse, Role } from '@bulk/shared';
import { fetchMe } from '../auth/auth.api';
import { fetchRounds } from '../rounds/rounds.api';
import { useAuthStore } from '../auth/auth.store';
import { HomePage } from './HomePage';
import { signOutAfterTest } from '../../test/session';

vi.mock('../auth/auth.api', () => ({
  fetchMe: vi.fn(),
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  endSession: vi.fn().mockResolvedValue({ signedOut: true }),
}));

// FEAT-023: Home now reads the rounds list for its lead card.
vi.mock('../rounds/rounds.api', () => ({
  fetchRounds: vi.fn(),
  fetchMyRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));
const fetchMeMock = vi.mocked(fetchMe);
const fetchRoundsMock = vi.mocked(fetchRounds);

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
  fetchRoundsMock.mockResolvedValue([]);
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
    signOutAfterTest();
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

  it('leads with Group buys above the society and services tiles (FEAT-023)', async () => {
    renderAs('RESIDENT');
    const lead = await screen.findByTestId('group-buys-lead');
    const society = screen.getByTestId('society-name');
    // Document order: the lead card comes before the tiles.
    expect(lead.compareDocumentPosition(society) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse services' })).toBeInTheDocument();
  });
});

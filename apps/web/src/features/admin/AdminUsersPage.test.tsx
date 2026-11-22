import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminResidentDto } from '@bulk/shared';
import { fetchSocieties, fetchUsers } from './admin.api';
import { society } from './admin.fixtures';
import { AdminUsersPage } from './AdminUsersPage';
import { useAuthStore } from '../auth/auth.store';
import { page } from '../../test/page';

vi.mock('./admin.api', () => ({
  fetchSocieties: vi.fn(),
  fetchUsers: vi.fn(),
  updateUser: vi.fn(),
  removeUser: vi.fn(),
}));

const me: AdminResidentDto = {
  id: 'res_me',
  name: 'Platform Admin',
  phone: '+919999900001',
  role: 'SUPER_ADMIN',
  active: true,
  verifiedAt: '2026-11-01T00:00:00.000Z',
  createdAt: '2026-11-01T00:00:00.000Z',
  society: { id: 'soc_1', name: 'Green Park' },
  pledgeCount: 0,
};
const asha: AdminResidentDto = { ...me, id: 'res_asha', name: 'Asha Rao', phone: '+919999900101', role: 'RESIDENT', pledgeCount: 2 };

function renderPage(path = '/admin/users') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminUsersPage (FEAT-033)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSocieties).mockResolvedValue([society]);
    vi.mocked(fetchUsers).mockResolvedValue(page([me, asha]));
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'a',
      refreshToken: 'r',
      resident: { id: 'res_me', societyId: 'soc_1', phone: me.phone, name: me.name, role: 'SUPER_ADMIN', verifiedAt: me.verifiedAt, createdAt: me.createdAt },
      society: { id: 'soc_1', name: 'Green Park', city: 'Pune' },
    });
  });
  afterEach(() => useAuthStore.setState({ status: 'unauthenticated', accessToken: null, refreshToken: null, resident: null, society: null }));

  it('lists users from every society with their phone, society and access', async () => {
    renderPage();
    const rows = await screen.findAllByTestId('user-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Platform Admin (you)');
    expect(rows[1]).toHaveTextContent('Asha Rao');
    expect(rows[1]).toHaveTextContent('+919999900101 · Green Park');
    expect(within(rows[0]).getByTestId('user-role')).toHaveTextContent('Admin');
    expect(within(rows[1]).getByTestId('user-role')).toHaveTextContent('Resident');
  });

  it('filters come from the URL and reach the server: society and access', async () => {
    renderPage('/admin/users?society=soc_1&role=SUPER_ADMIN');
    await screen.findAllByTestId('user-row');
    expect(fetchUsers).toHaveBeenCalledWith(expect.objectContaining({ societyId: 'soc_1', role: 'SUPER_ADMIN' }));
  });

  it('each row opens that user\'s page; a switched-off user is marked', async () => {
    vi.mocked(fetchUsers).mockResolvedValue(page([me, { ...asha, active: false }]));
    renderPage();
    const rows = await screen.findAllByTestId('user-row');
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/admin/users/res_asha');
    expect(within(rows[1]).getByTestId('user-inactive')).toHaveTextContent('Switched off');
    expect(within(rows[0]).queryByTestId('user-inactive')).not.toBeInTheDocument();
  });

  it('the status filter reaches the server (FEAT-035)', async () => {
    renderPage('/admin/users?status=inactive');
    await screen.findAllByTestId('user-row');
    expect(fetchUsers).toHaveBeenCalledWith(expect.objectContaining({ status: 'inactive' }));
  });
});

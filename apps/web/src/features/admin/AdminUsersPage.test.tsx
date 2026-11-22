import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminResidentDto } from '@bulk/shared';
import { fetchSocieties, fetchUsers, removeUser, updateUser } from './admin.api';
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

  it('makes a resident an admin', async () => {
    vi.mocked(updateUser).mockResolvedValue({ ...asha, role: 'SUPER_ADMIN' });
    renderPage();
    fireEvent.click(within((await screen.findAllByTestId('user-row'))[1]).getByRole('button'));
    fireEvent.click(await screen.findByRole('radio', { name: 'Admin (full access)' }));
    fireEvent.click(screen.getByTestId('save-user'));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('res_asha', { role: 'SUPER_ADMIN' }));
  });

  it('renames a user; clearing the name sends null', async () => {
    vi.mocked(updateUser).mockResolvedValue({ ...asha, name: null });
    renderPage();
    fireEvent.click(within((await screen.findAllByTestId('user-row'))[1]).getByRole('button'));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('save-user'));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('res_asha', { name: null }));
  });

  it('you cannot change your own access or remove yourself', async () => {
    renderPage();
    fireEvent.click(within((await screen.findAllByTestId('user-row'))[0]).getByRole('button'));
    expect(await screen.findByTestId('access-note')).toHaveTextContent("You can't change your own access");
    fireEvent.click(screen.getByRole('radio', { name: 'Resident' }));
    expect(screen.getByTestId('save-user')).toBeDisabled();
    expect(screen.getByTestId('remove-user')).toBeDisabled();
  });

  it('removing asks first, then removes; a server refusal is shown in the sheet', async () => {
    vi.mocked(removeUser).mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'ApiError' }));
    renderPage();
    fireEvent.click(within((await screen.findAllByTestId('user-row'))[1]).getByRole('button'));
    fireEvent.click(await screen.findByTestId('remove-user'));
    expect(removeUser).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, remove' }));
    await waitFor(() => expect(removeUser).toHaveBeenCalledWith('res_asha', expect.anything()));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

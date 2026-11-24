import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminResidentDetailDto, AdminResidentPledgeDto } from '@bulk/shared';
import { fetchUser, fetchUserPledges, removeUser, updateUser } from './admin.api';
import { page } from '../../test/page';
import { AdminUserDetailPage } from './AdminUserDetailPage';
import { useAuthStore } from '../auth/auth.store';

vi.mock('./admin.api', () => ({
  fetchUser: vi.fn(),
  fetchUserPledges: vi.fn(),
  fetchUsers: vi.fn(),
  updateUser: vi.fn(),
  removeUser: vi.fn(),
  fetchSocieties: vi.fn(),
}));

/** FEAT-044: `pledges` is test-only here; the page loads them from the paged endpoint. */
type UserFixture = AdminResidentDetailDto & { pledges: AdminResidentPledgeDto[] };
const asha: UserFixture = {
  id: 'res_asha',
  name: 'Asha Rao',
  phone: '+919999900101',
  role: 'RESIDENT',
  active: true,
  verifiedAt: '2026-11-01T10:00:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
  society: { id: 'soc_1', name: 'Green Park' },
  pledgeCount: 1,
  activePledgeCount: 1,
  pledges: [
    { roundId: 'r1', serviceName: 'AC Servicing', status: 'OPEN', units: 2, paid: false, deadline: '2026-12-01T10:00:00.000Z', joinedAt: '2026-11-02T10:00:00.000Z' },
  ],
};
const fresh: UserFixture = { ...asha, id: 'res_new', name: 'New Person', pledgeCount: 0, activePledgeCount: 0, pledges: [] };

function renderPage(id = 'res_asha') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/admin/users/${id}`]}>
        <Routes>
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin/users" element={<p>users list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminUserDetailPage (FEAT-035)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // FEAT-044: serve the pledges of whichever fixture fetchUser returns.
    vi.mocked(fetchUserPledges).mockImplementation(async (id: string) => {
      const user = (await vi.mocked(fetchUser).getMockImplementation()?.(id)) as UserFixture | undefined;
      return page(user?.pledges ?? []);
    });
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'a',
      refreshToken: 'r',
      resident: { id: 'res_me', societyId: 'soc_1', phone: '+919999900001', name: 'Me', role: 'SUPER_ADMIN', verifiedAt: null, createdAt: '2026-11-01T00:00:00.000Z' },
      society: { id: 'soc_1', name: 'Green Park', city: 'Pune' },
    });
  });
  afterEach(() => useAuthStore.setState({ status: 'unauthenticated', accessToken: null, refreshToken: null, resident: null, society: null }));

  it('shows the profile, the society link and every pledge', async () => {
    vi.mocked(fetchUser).mockResolvedValue(asha);
    renderPage();
    expect(await screen.findByTestId('user-profile')).toHaveTextContent('+919999900101');
    expect(screen.getByTestId('user-society-link')).toHaveAttribute('href', '/admin/societies/soc_1');
    // FEAT-044: the pledges load from their own paged endpoint.
    expect(await screen.findByRole('link', { name: 'AC Servicing' })).toHaveAttribute('href', '/admin/rounds/r1');
    expect(screen.getByTestId('user-pledges')).toHaveTextContent('AC Servicing');
  });

  it('makes a resident an admin', async () => {
    vi.mocked(fetchUser).mockResolvedValue(asha);
    vi.mocked(updateUser).mockResolvedValue({ ...asha, role: 'SUPER_ADMIN' });
    renderPage();
    fireEvent.click(await screen.findByRole('radio', { name: 'Admin (full access)' }));
    fireEvent.click(screen.getByTestId('save-user'));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('res_asha', { role: 'SUPER_ADMIN' }));
  });

  it('switching off asks first, then sends active:false; switching on goes straight through', async () => {
    vi.mocked(fetchUser).mockResolvedValue(asha);
    vi.mocked(updateUser).mockResolvedValue({ ...asha, active: false });
    renderPage();
    fireEvent.click(await screen.findByRole('switch', { name: 'Account active' }));
    expect(updateUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, switch off' }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('res_asha', { active: false }));
  });

  it('a switched-off user is marked, and switching back on needs no confirm', async () => {
    vi.mocked(fetchUser).mockResolvedValue({ ...asha, active: false });
    vi.mocked(updateUser).mockResolvedValue(asha);
    renderPage();
    expect(await screen.findByTestId('user-inactive')).toHaveTextContent('Switched off');
    fireEvent.click(screen.getByRole('switch', { name: 'Account active' }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('res_asha', { active: true }));
  });

  it('remove is off while they have group-buy history, and says to switch them off instead', async () => {
    vi.mocked(fetchUser).mockResolvedValue(asha);
    renderPage();
    expect(await screen.findByTestId('remove-user')).toBeDisabled();
    expect(screen.getByTestId('remove-reason')).toHaveTextContent('Switch them off instead');
  });

  it('someone with no history can be removed after confirming; we land on the list', async () => {
    vi.mocked(fetchUser).mockResolvedValue(fresh);
    vi.mocked(removeUser).mockResolvedValue({ deleted: true });
    renderPage('res_new');
    fireEvent.click(await screen.findByTestId('remove-user'));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(await screen.findByText('users list')).toBeInTheDocument();
    expect(removeUser).toHaveBeenCalledWith('res_new', expect.anything());
  });

  it('your own page: access is text, and you cannot switch yourself off or remove yourself', async () => {
    vi.mocked(fetchUser).mockResolvedValue({ ...fresh, id: 'res_me', role: 'SUPER_ADMIN' });
    renderPage('res_me');
    expect(await screen.findByTestId('self-access')).toHaveTextContent('Access: Admin');
    expect(screen.queryByRole('radio', { name: /^Resident$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Account active' })).toBeDisabled();
    expect(screen.getByTestId('remove-user')).toBeDisabled();
  });

  it('a platform admin shows "Platform admin", no society link, and no way to make them a resident (FEAT-036)', async () => {
    vi.mocked(fetchUser).mockResolvedValue({ ...fresh, role: 'SUPER_ADMIN', society: null });
    renderPage('res_new');
    expect(await screen.findByTestId('user-platform-admin')).toHaveTextContent('Platform admin');
    expect(screen.queryByTestId('user-society-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('platform-access')).toHaveTextContent("can't become a resident");
    expect(screen.queryByRole('radio', { name: 'Resident' })).not.toBeInTheDocument();
    expect(screen.getByText(/can be removed. You can add them back from Users/)).toBeInTheDocument();
  });
});

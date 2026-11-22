import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminOverviewDto } from '@bulk/shared';
import { fetchOverview } from './admin.api';
import { society } from './admin.fixtures';
import { AdminOverview } from './AdminOverview';

vi.mock('./admin.api', () => ({ fetchOverview: vi.fn() }));

const overview: AdminOverviewDto = {
  societies: 4,
  users: 27,
  admins: 2,
  openRounds: 5,
  recentSocieties: [{ ...society, inviteCode: 'AB23CD45' }],
  recentUsers: [
    {
      id: 'res_1',
      name: 'Asha Rao',
      phone: '+919999900101',
      role: 'RESIDENT',
      verifiedAt: null,
      createdAt: '2026-11-22T08:00:00.000Z',
      society: { id: society.id, name: society.name },
      pledgeCount: 0,
    },
  ],
};

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminOverview />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminOverview (FEAT-034)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leads with the platform numbers, each linking to its screen', async () => {
    vi.mocked(fetchOverview).mockResolvedValue(overview);
    renderIt();
    expect(await screen.findByTestId('overview-societies')).toHaveTextContent('4');
    expect(screen.getByTestId('overview-users')).toHaveTextContent('27');
    expect(screen.getByTestId('overview-admins')).toHaveTextContent('2');
    expect(screen.getByTestId('overview-open-rounds')).toHaveTextContent('5');
    expect(screen.getByRole('link', { name: 'Open Admins' })).toHaveAttribute('href', '/admin/users?role=SUPER_ADMIN');
  });

  it('offers the quick actions', async () => {
    vi.mocked(fetchOverview).mockResolvedValue(overview);
    renderIt();
    const actions = screen.getByRole('navigation', { name: 'Quick actions' });
    expect(within(actions).getByRole('link', { name: 'Onboard a society' })).toHaveAttribute('href', '/admin/societies');
    expect(within(actions).getByRole('link', { name: 'New round' })).toHaveAttribute('href', '/admin/rounds/new');
    expect(within(actions).getByRole('link', { name: 'Add a vendor' })).toHaveAttribute('href', '/admin/vendors');
    expect(within(actions).getByRole('link', { name: 'Manage users' })).toHaveAttribute('href', '/admin/users');
  });

  it('lists the newest societies and users, linking through', async () => {
    vi.mocked(fetchOverview).mockResolvedValue(overview);
    renderIt();
    const societies = await screen.findByTestId('recent-societies');
    expect(within(societies).getByRole('link')).toHaveAttribute('href', `/admin/societies/${society.id}`);
    expect(societies).toHaveTextContent('AB23 CD45');
    const users = screen.getByTestId('recent-users');
    expect(users).toHaveTextContent('Asha Rao');
    expect(within(users).getByRole('link')).toHaveAttribute('href', '/admin/users?q=%2B919999900101');
  });

  it('says so when the overview cannot load', async () => {
    vi.mocked(fetchOverview).mockRejectedValue(new Error('down'));
    renderIt();
    expect(await screen.findByText("Couldn't load the overview.")).toBeInTheDocument();
  });
});

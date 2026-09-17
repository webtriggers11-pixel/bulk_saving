import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboard, roundSummary, society } from './admin.fixtures';
import { fetchAdminRounds, fetchDashboard, fetchSocieties } from './admin.api';
import { AdminDashboardPage } from './AdminDashboardPage';

// Mock the whole API module so the hooks resolve against these fakes, never fetch.
vi.mock('./admin.api', () => ({
  fetchDashboard: vi.fn(),
  fetchSocieties: vi.fn(),
  fetchServices: vi.fn(),
  fetchAdminRounds: vi.fn(),
  fetchAdminRound: vi.fn(),
  createRound: vi.fn(),
  closeRound: vi.fn(),
  cancelRound: vi.fn(),
  assignRound: vi.fn(),
  deliverRound: vi.fn(),
  setPayment: vi.fn(),
  fetchVendors: vi.fn(),
  createVendor: vi.fn(),
  updateVendor: vi.fn(),
}));

const fetchDashboardMock = vi.mocked(fetchDashboard);
const fetchSocietiesMock = vi.mocked(fetchSocieties);
const fetchAdminRoundsMock = vi.mocked(fetchAdminRounds);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin']}>
        <AdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSocietiesMock.mockResolvedValue([society]);
  });

  it('renders status tiles, demand, payment totals and a linked round row', async () => {
    fetchDashboardMock.mockResolvedValue(dashboard);
    fetchAdminRoundsMock.mockResolvedValue([roundSummary]);
    renderPage();

    const needsVendor = await screen.findByTestId('status-tile-CLOSED_MET');
    expect(needsVendor).toHaveTextContent('Needs vendor');
    expect(needsVendor).toHaveTextContent('2');
    expect(screen.getByTestId('status-tile-ASSIGNED')).toHaveTextContent('Awaiting delivery4');
    expect(screen.getByTestId('payments-collected')).toHaveTextContent('₹12,000');
    expect(screen.getByTestId('payments-outstanding')).toHaveTextContent('₹4,500');
    expect(screen.getByText('42')).toBeInTheDocument();

    const link = await screen.findByRole('link', { name: 'AC Servicing' });
    expect(link).toHaveAttribute('href', '/admin/rounds/round_1');
    const row = screen.getByTestId('admin-round-row');
    expect(within(row).getByText('Open')).toBeInTheDocument();
    expect(within(row).getByText('₹900')).toBeInTheDocument();
    expect(within(row).getByText('6 / 2')).toBeInTheDocument();
  });

  it('refetches rounds with the chosen status and society filters', async () => {
    fetchDashboardMock.mockResolvedValue(dashboard);
    fetchAdminRoundsMock.mockResolvedValue([]);
    renderPage();

    await screen.findByTestId('admin-rounds-empty');
    expect(fetchAdminRoundsMock).toHaveBeenCalledWith({});

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CLOSED_MET' } });
    await waitFor(() =>
      expect(fetchAdminRoundsMock).toHaveBeenLastCalledWith({ status: 'CLOSED_MET' }),
    );

    await screen.findByRole('option', { name: 'Green Park' });
    fireEvent.change(screen.getByLabelText('Society'), { target: { value: 'soc_1' } });
    await waitFor(() =>
      expect(fetchAdminRoundsMock).toHaveBeenLastCalledWith({ status: 'CLOSED_MET', societyId: 'soc_1' }),
    );
  });

  it('shows an error state when the dashboard fails to load', async () => {
    fetchDashboardMock.mockRejectedValue(new Error('boom'));
    fetchAdminRoundsMock.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/couldn't load the dashboard/i)).toBeInTheDocument();
  });
});

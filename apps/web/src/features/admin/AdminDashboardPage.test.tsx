import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboard, roundSummary, society } from './admin.fixtures';
import { fetchAdminRounds, fetchDashboard, fetchSocieties } from './admin.api';
import { AdminDashboardPage } from './AdminDashboardPage';
import { page } from '../../test/page';

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
  createService: vi.fn(),
  updateService: vi.fn(),
  upsertOffering: vi.fn(),
}));

const fetchDashboardMock = vi.mocked(fetchDashboard);
const fetchSocietiesMock = vi.mocked(fetchSocieties);
const fetchAdminRoundsMock = vi.mocked(fetchAdminRounds);

function renderPage(url = '/admin') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
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
    fetchAdminRoundsMock.mockResolvedValue(page([roundSummary]));
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
    expect(within(row).getByText('6 AC units / 2')).toBeInTheDocument();
  });

  it('refetches rounds with the chosen status and society filters', async () => {
    fetchDashboardMock.mockResolvedValue(dashboard);
    fetchAdminRoundsMock.mockResolvedValue(page([]));
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
    fetchAdminRoundsMock.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText(/couldn't load the dashboard/i)).toBeInTheDocument();
  });

  it('filters rounds on the server from the URL — a shared link opens the same list (FEAT-015)', async () => {
    fetchDashboardMock.mockResolvedValue(dashboard);
    fetchAdminRoundsMock.mockResolvedValue(page([roundSummary]));
    renderPage(`/admin?status=CLOSED_MET&societyId=${society.id}&q=ac&category=Appliances`);

    await screen.findAllByTestId('admin-round-row');
    expect(fetchAdminRoundsMock).toHaveBeenLastCalledWith({
      status: 'CLOSED_MET',
      societyId: society.id,
      q: 'ac',
      category: 'Appliances',
    });
    expect(screen.getByRole('searchbox', { name: 'Search rounds' })).toHaveValue('ac');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('drops a status the server would refuse instead of sending it', async () => {
    fetchDashboardMock.mockResolvedValue(dashboard);
    fetchAdminRoundsMock.mockResolvedValue(page([]));
    renderPage('/admin?status=BOGUS');
    await screen.findByTestId('admin-rounds-empty');
    expect(fetchAdminRoundsMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }));
  });

  it('lists what residents are asking for, each one link away from opening a round (FEAT-022)', async () => {
    fetchDashboardMock.mockResolvedValue({
      ...dashboard,
      asks: [
        {
          society: { id: 'soc_1', name: 'Green Park' },
          service: { id: 'svc_tank', name: 'Water Tank Cleaning', slug: 'tank' },
          askCount: 12,
          since: '2026-10-10T09:00:00.000Z',
        },
      ],
    });
    fetchAdminRoundsMock.mockResolvedValue(page([]));
    renderPage();
    const row = await screen.findByTestId('ask-row-tank');
    expect(row).toHaveTextContent('Water Tank Cleaning');
    expect(row).toHaveTextContent('Green Park');
    expect(row).toHaveTextContent('12');
    expect(within(row).getByRole('link', { name: /Open a round/ })).toHaveAttribute(
      'href',
      '/admin/rounds/new?society=soc_1&service=svc_tank',
    );
  });

  it('says so when nobody is waiting', async () => {
    fetchDashboardMock.mockResolvedValue(dashboard);
    fetchAdminRoundsMock.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByTestId('asks')).toHaveTextContent('Nobody is waiting');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminNewRoundPage } from './AdminNewRoundPage';
import { AdminRoundDetailPage } from './AdminRoundDetailPage';
import { AdminVendorsPage } from './AdminVendorsPage';
import {
  fetchAdminRound,
  fetchAdminRounds,
  fetchDashboard,
  fetchServices,
  fetchSocieties,
  fetchVendors,
} from './admin.api';
import { dashboard, roundDetail } from './admin.fixtures';

vi.mock('./admin.api', () => ({
  fetchDashboard: vi.fn(),
  fetchAdminRounds: vi.fn(),
  fetchAdminRound: vi.fn(),
  fetchSocieties: vi.fn(),
  fetchServices: vi.fn(),
  fetchVendors: vi.fn(),
  createRound: vi.fn(),
  closeRound: vi.fn(),
  cancelRound: vi.fn(),
  assignRound: vi.fn(),
  deliverRound: vi.fn(),
  setPayment: vi.fn(),
  createVendor: vi.fn(),
  updateVendor: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  upsertOffering: vi.fn(),
}));

/**
 * BUG-004 on the READ side, at every admin call site (V2 P0-1 / P1-2).
 *
 * The mutation half of BUG-004 shipped with tests; the read half shipped with only
 * a unit test of the `queryStalled` helper, and that gap is precisely how a live P0
 * survived: `/admin/rounds/:id` still gated on `isError`, so an offline admin got a
 * bare page — and on a CLOSED_MET round, the false claim "No active vendors", whose
 * obvious remedy is to create a duplicate vendor.
 *
 * Every test here drives the real offline path through `onlineManager`. A rejected
 * promise does NOT reproduce it: that is the server-error path, and it is what let
 * the original tests stay green.
 */
describe('admin surfaces when the browser is offline', () => {
  beforeEach(() => {
    vi.mocked(fetchDashboard).mockResolvedValue(dashboard);
    vi.mocked(fetchAdminRounds).mockResolvedValue([]);
    vi.mocked(fetchVendors).mockResolvedValue([]);
    vi.mocked(fetchSocieties).mockResolvedValue([]);
    vi.mocked(fetchServices).mockResolvedValue([]);
    vi.mocked(fetchAdminRound).mockResolvedValue(roundDetail({ status: 'CLOSED_MET' }));
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    vi.clearAllMocks();
  });

  function renderOffline(ui: React.ReactNode, path = '/admin') {
    onlineManager.setOnline(false);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/admin" element={ui} />
            <Route path="/admin/rounds/new" element={ui} />
            <Route path="/admin/rounds/:id" element={ui} />
            <Route path="/admin/vendors" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('the dashboard says something, rather than rendering an empty shell', async () => {
    renderOffline(<AdminDashboardPage />);
    // Two independent reads on this page (summary + rounds table), so two alerts —
    // the point is that neither renders as an empty section.
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(fetchDashboard).not.toHaveBeenCalled(); // paused, never attempted
  });

  it('the vendors list says something, and recovers on reconnect', async () => {
    renderOffline(<AdminVendorsPage />, '/admin/vendors');
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    onlineManager.setOnline(true);
    await waitFor(() => expect(fetchVendors).toHaveBeenCalled());
  });

  it('the new-round form does not present itself as loadable', async () => {
    renderOffline(<AdminNewRoundPage />, '/admin/rounds/new');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open round' })).not.toBeInTheDocument();
  });

  it('the round detail says something instead of rendering just the back link', async () => {
    renderOffline(<AdminRoundDetailPage />, '/admin/rounds/round_1');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/offline/i);
    // The bug: only "← All rounds" rendered, with no error and no Retry.
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('NEVER claims "No active vendors" when it simply could not load them', async () => {
    // The most damaging form of this bug: a false statement whose obvious remedy is
    // to create a vendor that already exists.
    vi.mocked(fetchAdminRound).mockResolvedValue(roundDetail({ status: 'CLOSED_MET' }));
    renderOffline(<AdminRoundDetailPage />, '/admin/rounds/round_1');

    await screen.findByRole('alert');
    expect(screen.queryByTestId('no-active-vendors')).not.toBeInTheDocument();
  });
});

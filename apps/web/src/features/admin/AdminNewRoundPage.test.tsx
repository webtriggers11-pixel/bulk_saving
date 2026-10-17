import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminServiceDto, RoundDto } from '@bulk/shared';
import { ApiError } from '../../lib/api';
import { society } from './admin.fixtures';
import { createRound, fetchServices, fetchSocieties } from './admin.api';
import { AdminNewRoundPage } from './AdminNewRoundPage';

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

const fetchSocietiesMock = vi.mocked(fetchSocieties);
const fetchServicesMock = vi.mocked(fetchServices);
const createRoundMock = vi.mocked(createRound);

const service: AdminServiceDto = {
  id: 'svc_1',
  name: 'AC Servicing',
  slug: 'ac-servicing',
  description: 'Split and window AC service',
  category: 'Appliances',
  imageUrl: null,
  unitLabel: 'AC unit',
  unitLabelPlural: 'AC units',
  unitDescription: null,
  active: true,
  createdAt: '2026-09-16T10:00:00.000Z',
  updatedAt: '2026-09-16T10:00:00.000Z',
  offerings: [],
};

const createdRound: RoundDto = {
  id: 'round_new',
  service: { id: 'svc_1', name: 'AC Servicing', slug: 'ac-servicing', category: 'Appliances', unitLabel: 'AC unit', unitLabelPlural: 'AC units', unitDescription: null },
  status: 'OPEN',
  unitsCount: 0,
  currentPrice: 900,
  nextTier: { threshold: 5, price: 900 },
  deadline: '2026-10-01T12:30:00.000Z',
  tiers: [
    { threshold: 5, price: 900 },
    { threshold: 10, price: 700 },
  ],
  myUnits: 0,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/rounds/new']}>
        <Routes>
          <Route path="/admin/rounds/new" element={<AdminNewRoundPage />} />
          <Route path="/admin/rounds/:id" element={<p>Round detail page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Fill society, service, deadline and two tiers (threshold/price pairs). */
async function fillForm(tiers: Array<[string, string]>) {
  await screen.findByRole('option', { name: /Green Park/ });
  fireEvent.change(screen.getByLabelText('Society'), { target: { value: 'soc_1' } });
  fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'svc_1' } });
  fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '2026-10-01T18:00' } });
  for (let i = 1; i < tiers.length; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: 'Add tier' }));
  }
  tiers.forEach(([threshold, price], index) => {
    fireEvent.change(screen.getByLabelText(`Tier ${index + 1} threshold (AC units)`), {
      target: { value: threshold },
    });
    fireEvent.change(screen.getByLabelText(`Tier ${index + 1} price (₹)`), {
      target: { value: price },
    });
  });
}

describe('AdminNewRoundPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSocietiesMock.mockResolvedValue([society]);
    fetchServicesMock.mockResolvedValue([
      service,
      { ...service, id: 'svc_off', name: 'Retired Service', active: false },
    ]);
  });

  it('offers only active services', async () => {
    renderPage();
    expect(await screen.findByRole('option', { name: 'AC Servicing' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Retired Service' })).not.toBeInTheDocument();
  });

  it('submits an ISO deadline and parsed tiers, then opens the new round', async () => {
    createRoundMock.mockResolvedValue(createdRound);
    renderPage();
    await fillForm([
      ['5', '900'],
      ['10', '700'],
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Open round' }));

    await waitFor(() =>
      expect(createRoundMock).toHaveBeenCalledWith({
        societyId: 'soc_1',
        serviceId: 'svc_1',
        deadline: new Date('2026-10-01T18:00').toISOString(),
        tiers: [
          { threshold: 5, price: 900 },
          { threshold: 10, price: 700 },
        ],
      }),
    );
    expect(await screen.findByText('Round detail page')).toBeInTheDocument();
  });

  it('rejects non-ascending thresholds without calling the API', async () => {
    renderPage();
    await fillForm([
      ['10', '900'],
      ['10', '700'],
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Open round' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('strictly ascending');
    expect(createRoundMock).not.toHaveBeenCalled();
  });

  it('shows the server error inline', async () => {
    createRoundMock.mockRejectedValue(
      new ApiError('ROUND_ALREADY_OPEN', 'A round is already open for this service.', 409),
    );
    renderPage();
    await fillForm([['5', '900']]);
    fireEvent.click(screen.getByRole('button', { name: 'Open round' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A round is already open for this service.');
    expect(screen.queryByText('Round detail page')).not.toBeInTheDocument();
  });
});

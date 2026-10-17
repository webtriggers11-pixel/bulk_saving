import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { AdminServiceDto } from '@bulk/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { society } from './admin.fixtures';
import { createService, fetchServices, fetchSocieties, updateService, upsertOffering } from './admin.api';
import { AdminServicesPage } from './AdminServicesPage';

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

const fetchServicesMock = vi.mocked(fetchServices);
const fetchSocietiesMock = vi.mocked(fetchSocieties);
const createServiceMock = vi.mocked(createService);
const updateServiceMock = vi.mocked(updateService);
const upsertOfferingMock = vi.mocked(upsertOffering);

const blue = { id: 'soc_2', name: 'Blue Waters', city: 'Mumbai', inviteCode: 'BLUE0002' };

const tank: AdminServiceDto = {
  id: 'svc_tank',
  name: 'Water Tank Cleaning',
  slug: 'water-tank-cleaning',
  description: 'Drain, scrub and disinfect the overhead tank.',
  category: 'Utilities',
  imageUrl: null,
  unitLabel: 'tank',
  unitLabelPlural: 'tanks',
  unitDescription: 'One overhead tank up to 1000 L.',
  active: true,
  createdAt: '2026-10-17T10:00:00.000Z',
  updatedAt: '2026-10-17T10:00:00.000Z',
  offerings: [{ id: 'off_1', societyId: society.id, serviceId: 'svc_tank', enabled: true, indicativePrice: 799 }],
};

const rice: AdminServiceDto = {
  ...tank,
  id: 'svc_rice',
  name: 'Basmati Rice — 25 kg',
  slug: 'basmati-rice-25-kg',
  category: 'Bulk Staples',
  unitLabel: 'bag',
  unitLabelPlural: 'bags',
  unitDescription: null,
  offerings: [],
};

const legacy: AdminServiceDto = { ...tank, id: 'svc_old', name: 'Old Thing', slug: 'old-thing', category: 'Home', offerings: [] };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/services']}>
        <AdminServicesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Open a service's society controls (closed by default) and return them. */
async function openSocieties(): Promise<HTMLElement[]> {
  fireEvent.click(await screen.findByRole('button', { name: 'Manage societies' }));
  return screen.getAllByTestId('offering-control');
}

function fill(form: HTMLElement, label: RegExp, value: string) {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}

describe('AdminServicesPage', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSocietiesMock.mockResolvedValue([society, blue]);
  });

  it('groups services under their category, in catalog order, with legacy categories last', async () => {
    fetchServicesMock.mockResolvedValue([legacy, rice, tank]);
    renderPage();

    await screen.findByText('Water Tank Cleaning');
    const headings = screen.getAllByTestId('service-category').map((card) => within(card).getAllByText(/./)[0].textContent);
    expect(headings).toEqual(['Utilities', 'Bulk Staples', 'Home']);
  });

  it('shows where a service is offered, and at what price per unit', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    renderPage();

    const row = await screen.findByTestId('service-row');
    expect(within(row).getByText(/offered in 1 of 2 societies/)).toBeInTheDocument();
    // Closed until asked for — the summary line carries the count.
    expect(within(row).queryByTestId('offering-control')).not.toBeInTheDocument();
    const toggle = within(row).getByRole('button', { name: 'Manage societies' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const [green, other] = await openSocieties();
    expect(within(row).getByRole('button', { name: 'Hide societies' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(green).getByText('Offered')).toBeInTheDocument();
    expect(within(green).getByText('From ₹799 / tank')).toBeInTheDocument();
    expect(within(other).getByText('Not offered')).toBeInTheDocument();
  });

  it('creates a service with a slug derived from the name and a category from the list', async () => {
    fetchServicesMock.mockResolvedValue([]);
    createServiceMock.mockResolvedValue(rice);
    renderPage();
    await screen.findByTestId('services-empty');

    const form = screen.getByRole('form', { name: 'Add service' });
    fill(form, /^Name/, '  Basmati Rice — 25 kg ');
    expect(within(form).getByLabelText(/^Slug/)).toHaveValue('basmati-rice-25-kg');
    fireEvent.change(within(form).getByLabelText(/^Category/), { target: { value: 'Bulk Staples' } });
    fill(form, /^Description/, 'Aged basmati, sealed 25 kg bag.');
    fill(form, /^One unit is a/, 'bag');
    fill(form, /^Plural/, 'bags');
    fireEvent.click(within(form).getByRole('button', { name: 'Add service' }));

    await waitFor(() => expect(createServiceMock).toHaveBeenCalledTimes(1));
    expect(createServiceMock.mock.calls[0][0]).toEqual({
      name: 'Basmati Rice — 25 kg',
      slug: 'basmati-rice-25-kg',
      description: 'Aged basmati, sealed 25 kg bag.',
      category: 'Bulk Staples',
      unitLabel: 'bag',
      unitLabelPlural: 'bags',
    });
    // The form resets once the server accepts it.
    await waitFor(() => expect(within(form).getByLabelText(/^Name/)).toHaveValue(''));
  });

  it('stops following the name once the admin edits the slug themselves', async () => {
    fetchServicesMock.mockResolvedValue([]);
    renderPage();
    await screen.findByTestId('services-empty');

    const form = screen.getByRole('form', { name: 'Add service' });
    fill(form, /^Name/, 'Car Wash');
    fill(form, /^Slug/, 'car-wash-weekly');
    fill(form, /^Name/, 'Car Wash Subscription');
    expect(within(form).getByLabelText(/^Slug/)).toHaveValue('car-wash-weekly');
  });

  it('refuses to send a service with no category, or half a unit-label pair', async () => {
    fetchServicesMock.mockResolvedValue([]);
    renderPage();
    await screen.findByTestId('services-empty');

    const form = screen.getByRole('form', { name: 'Add service' });
    fill(form, /^Name/, 'Geyser Service');
    fill(form, /^Description/, 'Descale and check.');
    fill(form, /^One unit is a/, 'geyser');
    fireEvent.click(within(form).getByRole('button', { name: 'Add service' }));

    expect(await within(form).findByText('Choose a category.')).toBeInTheDocument();
    expect(within(form).getByText(/Give the plural too/)).toBeInTheDocument();
    expect(createServiceMock).not.toHaveBeenCalled();
  });

  it('the category is a select over the closed list — there is no free-text box to typo into', async () => {
    fetchServicesMock.mockResolvedValue([]);
    renderPage();
    await screen.findByTestId('services-empty');

    const select = within(screen.getByRole('form', { name: 'Add service' })).getByLabelText(/^Category/);
    expect(select.tagName).toBe('SELECT');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Choose a category', 'Appliances', 'Home Care', 'Renovation', 'Utilities', 'Vehicle', 'Bulk Staples']);
  });

  it('edits a legacy service without resending the category the server would now refuse', async () => {
    fetchServicesMock.mockResolvedValue([legacy]);
    updateServiceMock.mockResolvedValue({ ...legacy, name: 'Renamed' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Old Thing' }));
    const form = screen.getByRole('form', { name: 'Edit Old Thing' });
    // Opens on the truth, flagged, rather than silently on the first listed category.
    expect(within(form).getByLabelText(/^Category/)).toHaveValue('Home');
    fill(form, /^Name/, 'Renamed');
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateServiceMock).toHaveBeenCalledTimes(1));
    const [id, body] = updateServiceMock.mock.calls[0];
    expect(id).toBe('svc_old');
    expect(body).toMatchObject({ name: 'Renamed' });
    expect(body).not.toHaveProperty('category');
  });

  it('deactivates a service', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    updateServiceMock.mockResolvedValue({ ...tank, active: false });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate Water Tank Cleaning' }));
    await waitFor(() => expect(updateServiceMock).toHaveBeenCalledWith('svc_tank', { active: false }));
  });

  it('offers a service in a society with its indicative price', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    upsertOfferingMock.mockResolvedValue({ id: 'off_2', societyId: blue.id, serviceId: tank.id, enabled: true, indicativePrice: 899 });
    renderPage();

    const [, other] = await openSocieties();
    fireEvent.change(within(other).getByLabelText(/^Price per unit/), { target: { value: '₹899' } });
    fireEvent.click(within(other).getByRole('button', { name: 'Offer Water Tank Cleaning in Blue Waters' }));

    await waitFor(() =>
      expect(upsertOfferingMock).toHaveBeenCalledWith(blue.id, tank.id, { enabled: true, indicativePrice: 899 }),
    );
  });

  it('stops offering a service, keeping its stored price', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    upsertOfferingMock.mockResolvedValue({ ...tank.offerings[0], enabled: false });
    renderPage();

    const [green] = await openSocieties();
    expect(within(green).getByLabelText(/^Price per unit/)).toHaveValue('799');
    fireEvent.click(within(green).getByRole('button', { name: `Stop offering Water Tank Cleaning in ${society.name}` }));

    await waitFor(() =>
      expect(upsertOfferingMock).toHaveBeenCalledWith(society.id, tank.id, { enabled: false, indicativePrice: 799 }),
    );
  });

  it('refuses a price that is not whole rupees, and sends nothing', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    renderPage();

    const [, other] = await openSocieties();
    fireEvent.change(within(other).getByLabelText(/^Price per unit/), { target: { value: '12.50' } });
    fireEvent.click(within(other).getByRole('button', { name: 'Offer Water Tank Cleaning in Blue Waters' }));

    expect(await within(other).findByText('Whole rupees only, or leave it empty.')).toBeInTheDocument();
    expect(upsertOfferingMock).not.toHaveBeenCalled();
  });

  it('cannot newly offer an inactive service — residents would never see it', async () => {
    fetchServicesMock.mockResolvedValue([{ ...tank, active: false }]);
    renderPage();

    const [green, other] = await openSocieties();
    expect(within(other).getByRole('button', { name: /^Offer / })).toBeDisabled();
    // ...but an existing offering can still be switched off.
    expect(within(green).getByRole('button', { name: /^Stop offering / })).toBeEnabled();
  });

  it('shows the server’s message when a create is refused', async () => {
    fetchServicesMock.mockResolvedValue([]);
    createServiceMock.mockRejectedValue(new ApiError('SERVICE_SLUG_TAKEN', 'A service with slug "x" already exists.', 409));
    renderPage();
    await screen.findByTestId('services-empty');

    const form = screen.getByRole('form', { name: 'Add service' });
    fill(form, /^Name/, 'X');
    fireEvent.change(within(form).getByLabelText(/^Category/), { target: { value: 'Vehicle' } });
    fill(form, /^Description/, 'x');
    fireEvent.click(within(form).getByRole('button', { name: 'Add service' }));

    expect(await within(form).findByText('A service with slug "x" already exists.')).toBeInTheDocument();
  });
});

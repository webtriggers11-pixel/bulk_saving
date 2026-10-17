import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { AdminServiceDto, ServiceOfferingDto } from '@bulk/shared';
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

function UrlProbe() {
  return <output data-testid="url">{useLocation().search}</output>;
}

function renderPage(url = '/admin/services') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <AdminServicesPage />
        <UrlProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The add form is closed behind "New service" (FEAT-015). */
function openAddForm(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'New service' }));
  return screen.getByRole('form', { name: 'Add service' });
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
    expect(within(green).getByRole('switch', { name: `Offer Water Tank Cleaning in ${society.name}` })).toHaveAttribute('aria-checked', 'true');
    expect(within(green).getByText('From ₹799 / tank')).toBeInTheDocument();
    expect(within(other).getByRole('switch', { name: 'Offer Water Tank Cleaning in Blue Waters' })).toHaveAttribute('aria-checked', 'false');
  });

  it('creates a service with a slug derived from the name and a category from the list', async () => {
    fetchServicesMock.mockResolvedValue([]);
    createServiceMock.mockResolvedValue(rice);
    renderPage();
    await screen.findByTestId('services-empty');

    const form = openAddForm();
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

    const form = openAddForm();
    fill(form, /^Name/, 'Car Wash');
    fill(form, /^Slug/, 'car-wash-weekly');
    fill(form, /^Name/, 'Car Wash Subscription');
    expect(within(form).getByLabelText(/^Slug/)).toHaveValue('car-wash-weekly');
  });

  it('refuses to send a service with no category, or half a unit-label pair', async () => {
    fetchServicesMock.mockResolvedValue([]);
    renderPage();
    await screen.findByTestId('services-empty');

    const form = openAddForm();
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

    const select = within(openAddForm()).getByLabelText(/^Category/);
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

  it('deactivates a service with its switch, which moves at once and says "Saved" when the server agrees', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    let resolve: (value: AdminServiceDto) => void = () => {};
    updateServiceMock.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();

    const toggle = await screen.findByRole('switch', { name: 'Water Tank Cleaning active' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    // Optimistic: off before the server has answered (the request is still unresolved).
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(updateServiceMock).toHaveBeenCalledWith('svc_tank', { active: false });

    await act(async () => resolve({ ...tank, active: false }));
    expect(await within(screen.getByTestId('service-row')).findByText('Saved')).toBeInTheDocument();
  });

  it('holds the new position until the refreshed list lands — no on → off → on flicker (V2 P1-2)', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    updateServiceMock.mockResolvedValue({ ...tank, active: false });
    renderPage();
    const toggle = await screen.findByRole('switch', { name: 'Water Tank Cleaning active' });

    // The save succeeds; the refetch that follows it hangs. The cache still says active.
    fetchServicesMock.mockReturnValue(new Promise(() => {}));
    fireEvent.click(toggle);
    await waitFor(() => expect(updateServiceMock).toHaveBeenCalled());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('a category or status the URL invents is ignored: not sent, and no "Clear filters" (V2 P2-2)', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    renderPage('/admin/services?category=Foo&status=maybe');
    await screen.findByText('Water Tank Cleaning');
    expect(fetchServicesMock).toHaveBeenLastCalledWith(expect.objectContaining({ category: undefined, status: undefined }));
    expect(within(screen.getByRole('radiogroup', { name: 'Category' })).getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('puts the switch back when the server refuses, and says why', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    updateServiceMock.mockRejectedValue(new ApiError('CONFLICT', 'Service is in use.', 409));
    renderPage();

    const toggle = await screen.findByRole('switch', { name: 'Water Tank Cleaning active' });
    fireEvent.click(toggle);
    expect(await screen.findByText('Service is in use.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('offers a service in a society with its indicative price', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    upsertOfferingMock.mockResolvedValue({ id: 'off_2', societyId: blue.id, serviceId: tank.id, enabled: true, indicativePrice: 899 });
    renderPage();

    const [, other] = await openSocieties();
    fireEvent.change(within(other).getByLabelText(/^Price per unit/), { target: { value: '₹899' } });
    fireEvent.click(within(other).getByRole('switch', { name: 'Offer Water Tank Cleaning in Blue Waters' }));

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
    fireEvent.click(within(green).getByRole('switch', { name: `Offer Water Tank Cleaning in ${society.name}` }));

    await waitFor(() =>
      expect(upsertOfferingMock).toHaveBeenCalledWith(society.id, tank.id, { enabled: false, indicativePrice: 799 }),
    );
  });

  it('a price typed while an earlier save is in flight stays unsaved — a later refresh does not wipe it (CHORE-020 V2 P2-b)', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    let land: (value: ServiceOfferingDto) => void = () => {};
    upsertOfferingMock.mockReturnValue(new Promise((r) => (land = r)));
    renderPage();

    const [green] = await openSocieties();
    const box = within(green).getByLabelText(/^Price per unit/);
    fireEvent.change(box, { target: { value: '600' } });
    fireEvent.click(within(green).getByRole('button', { name: `Save price for Water Tank Cleaning in ${society.name}` }));
    // While "600" is saving, the admin types on.
    fireEvent.change(box, { target: { value: '700' } });

    fetchServicesMock.mockResolvedValue([{ ...tank, offerings: [{ ...tank.offerings[0], indicativePrice: 600 }] }]);
    await act(async () => land({ ...tank.offerings[0], indicativePrice: 600 }));
    await waitFor(() => expect(within(green).getByText('From ₹600 / tank')).toBeInTheDocument());
    expect(box).toHaveValue('700');
  });

  it('refuses a price that is not whole rupees, and sends nothing', async () => {
    fetchServicesMock.mockResolvedValue([tank]);
    renderPage();

    const [, other] = await openSocieties();
    fireEvent.change(within(other).getByLabelText(/^Price per unit/), { target: { value: '12.50' } });
    fireEvent.click(within(other).getByRole('switch', { name: 'Offer Water Tank Cleaning in Blue Waters' }));

    expect(await within(other).findByText(/^Whole rupees up to/)).toBeInTheDocument();
    expect(upsertOfferingMock).not.toHaveBeenCalled();
  });

  it('cannot newly offer an inactive service — residents would never see it', async () => {
    fetchServicesMock.mockResolvedValue([{ ...tank, active: false }]);
    renderPage();

    const [green, other] = await openSocieties();
    expect(within(other).getByRole('switch', { name: /^Offer / })).toBeDisabled();
    // ...but an existing offering can still be switched off.
    expect(within(green).getByRole('switch', { name: /^Offer / })).toBeEnabled();
  });

  it('shows the server’s message when a create is refused', async () => {
    fetchServicesMock.mockResolvedValue([]);
    createServiceMock.mockRejectedValue(new ApiError('SERVICE_SLUG_TAKEN', 'A service with slug "x" already exists.', 409));
    renderPage();
    await screen.findByTestId('services-empty');

    const form = openAddForm();
    fill(form, /^Name/, 'X');
    fireEvent.change(within(form).getByLabelText(/^Category/), { target: { value: 'Vehicle' } });
    fill(form, /^Description/, 'x');
    fireEvent.click(within(form).getByRole('button', { name: 'Add service' }));

    expect(await within(form).findByText('A service with slug "x" already exists.')).toBeInTheDocument();
  });

  describe('server-side filters (FEAT-015)', () => {
    it('reads its filters from the URL and sends them to the server', async () => {
      fetchServicesMock.mockResolvedValue([tank]);
      renderPage(`/admin/services?q=tank&category=Utilities&status=active&offeredIn=${society.id}`);

      await screen.findByText('Water Tank Cleaning');
      expect(fetchServicesMock).toHaveBeenLastCalledWith({
        q: 'tank',
        category: 'Utilities',
        status: 'active',
        offeredIn: society.id,
      });
      expect(screen.getByRole('searchbox', { name: 'Search services' })).toHaveValue('tank');
      expect(within(screen.getByRole('radiogroup', { name: 'Category' })).getByRole('radio', { name: 'Utilities' })).toHaveAttribute('aria-checked', 'true');
    });

    it('ignores a status the server would refuse rather than sending it', async () => {
      fetchServicesMock.mockResolvedValue([tank]);
      renderPage('/admin/services?status=archived');
      await screen.findByText('Water Tank Cleaning');
      expect(fetchServicesMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }));
    });

    it('choosing a chip filters on the server and lands in the URL', async () => {
      fetchServicesMock.mockResolvedValue([tank, rice]);
      renderPage();
      await screen.findByText('Water Tank Cleaning');

      fetchServicesMock.mockResolvedValue([rice]);
      fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Category' })).getByRole('radio', { name: 'Bulk Staples' }));

      await waitFor(() => expect(fetchServicesMock).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'Bulk Staples' })));
      expect(screen.getByTestId('url')).toHaveTextContent('category=Bulk+Staples');
      await waitFor(() => expect(screen.queryByText('Water Tank Cleaning')).not.toBeInTheDocument());
    });

    it('debounces the search: one request once typing pauses, not one per keystroke', async () => {
      fetchServicesMock.mockResolvedValue([tank]);
      renderPage();
      await screen.findByText('Water Tank Cleaning');
      const calls = fetchServicesMock.mock.calls.length;

      const box = screen.getByRole('searchbox', { name: 'Search services' });
      fireEvent.change(box, { target: { value: 't' } });
      fireEvent.change(box, { target: { value: 'ta' } });
      fireEvent.change(box, { target: { value: 'tank' } });
      expect(fetchServicesMock.mock.calls.length).toBe(calls);

      await waitFor(() => expect(fetchServicesMock).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'tank' })));
      expect(fetchServicesMock.mock.calls.length).toBe(calls + 1);
    });

    it('keeps the previous rows on screen, marked busy, while the next result loads', async () => {
      fetchServicesMock.mockResolvedValue([tank]);
      renderPage();
      await screen.findByText('Water Tank Cleaning');

      fetchServicesMock.mockReturnValue(new Promise(() => {}));
      fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Status' })).getByRole('radio', { name: 'Inactive' }));

      // Not a skeleton, not an empty page: the old rows, dimmed.
      await waitFor(() => expect(screen.getByText('Water Tank Cleaning').closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true'));
      expect(screen.queryByTestId('services-skeleton')).not.toBeInTheDocument();
    });

    it('a filtered-to-nothing list says so, names the filters, and offers the way back', async () => {
      fetchServicesMock.mockResolvedValue([]);
      renderPage('/admin/services?q=zzz&category=Vehicle&other=keep');

      const noMatch = await screen.findByTestId('services-no-match');
      expect(noMatch).toHaveTextContent('No services match');
      expect(noMatch).toHaveTextContent('for “zzz”, in Vehicle');
      // Not the "No services yet" empty state — the catalog is not empty, the filter is.
      expect(screen.queryByTestId('services-empty')).not.toBeInTheDocument();

      fetchServicesMock.mockResolvedValue([tank]);
      fireEvent.click(within(noMatch).getByRole('button', { name: 'Clear filters' }));
      expect(screen.getByTestId('url')).toHaveTextContent('?other=keep');
      expect(await screen.findByText('Water Tank Cleaning')).toBeInTheDocument();
      expect(screen.getByRole('searchbox', { name: 'Search services' })).toHaveValue('');
    });

    it('counts the result, and only offers "Clear filters" when a filter is set', async () => {
      fetchServicesMock.mockResolvedValue([tank, rice]);
      renderPage();
      await screen.findByText('Water Tank Cleaning');
      expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === '2 services')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    });
  });
});

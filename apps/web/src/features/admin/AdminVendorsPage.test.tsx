import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeVendor, inactiveVendor } from './admin.fixtures';
import { createVendor, fetchVendors, updateVendor } from './admin.api';
import { AdminVendorsPage } from './AdminVendorsPage';

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

const fetchVendorsMock = vi.mocked(fetchVendors);
const createVendorMock = vi.mocked(createVendor);
const updateVendorMock = vi.mocked(updateVendor);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/vendors']}>
        <AdminVendorsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminVendorsPage', () => {
  afterEach(() => {
    // Leave the online manager as we found it, or a later test inherits "offline".
    onlineManager.setOnline(true);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists vendors with their active state', async () => {
    fetchVendorsMock.mockResolvedValue([activeVendor, inactiveVendor]);
    renderPage();

    expect(await screen.findByText('CoolFix')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows each vendor’s average rating with its count (FEAT-009)', async () => {
    fetchVendorsMock.mockResolvedValue([
      { ...activeVendor, averageRating: 4.5, ratingCount: 8 },
      { ...inactiveVendor, averageRating: null, ratingCount: 0 },
    ]);
    renderPage();

    await screen.findByText('CoolFix');
    const shown = screen.getAllByTestId('vendor-rating').map((el) => el.textContent);
    expect(shown[0]).toContain('4.5 (8)');
    // A vendor nobody has rated must not read as 0 — that looks like "terrible".
    expect(shown[1]).toContain('No ratings yet');
    expect(shown[1]).not.toContain('0.0');
  });

  it('creates a vendor with trimmed values and refetches the list', async () => {
    fetchVendorsMock.mockResolvedValue([]);
    createVendorMock.mockResolvedValue(activeVendor);
    renderPage();
    await screen.findByTestId('vendors-empty');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  CoolFix  ' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: ' +919811111111 ' } });
    fireEvent.change(screen.getByLabelText('Category (optional)'), { target: { value: ' Appliances ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));

    await waitFor(() =>
      expect(createVendorMock).toHaveBeenCalledWith({
        name: 'CoolFix',
        phone: '+919811111111',
        category: 'Appliances',
      }),
    );
    await waitFor(() => expect(fetchVendorsMock).toHaveBeenCalledTimes(2));
  });

  it('blocks an invalid phone client-side', async () => {
    fetchVendorsMock.mockResolvedValue([]);
    renderPage();
    await screen.findByTestId('vendors-empty');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'CoolFix' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '12-34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));

    expect(await screen.findByText(/Phone must be 8–15 digits/)).toBeInTheDocument();
    expect(createVendorMock).not.toHaveBeenCalled();
  });

  it('deactivates and edits a vendor inline', async () => {
    fetchVendorsMock.mockResolvedValue([activeVendor]);
    updateVendorMock.mockResolvedValue(activeVendor);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate CoolFix' }));
    await waitFor(() =>
      expect(updateVendorMock).toHaveBeenCalledWith('ven_1', { active: false }),
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit CoolFix' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Edit CoolFix' }));
    fireEvent.change(screen.getByLabelText('Name', { selector: '#edit-ven_1-name' }), {
      target: { value: 'CoolFix Pro ' },
    });
    fireEvent.change(screen.getByLabelText('Category (optional)', { selector: '#edit-ven_1-category' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateVendorMock).toHaveBeenLastCalledWith('ven_1', {
        name: 'CoolFix Pro',
        phone: '+919811111111',
        category: null,
        notes: null,
      }),
    );
  });

  it('tells the admin a create is QUEUED when offline, not stuck on "Adding…" (BUG-004)', async () => {
    // Offline pauses the mutation: nothing rejects, isPending stays true. A rejected
    // promise would NOT reproduce this — that is the server-error path.
    fetchVendorsMock.mockResolvedValue([]);
    renderPage();
    await screen.findByLabelText('Name');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'CoolFix' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+919811111111' } });
    act(() => {
      onlineManager.setOnline(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));

    expect(await screen.findByTestId('vendor-create-offline')).toHaveTextContent('reconnect');
    expect(createVendorMock).not.toHaveBeenCalled();

    act(() => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(createVendorMock).toHaveBeenCalledTimes(1));
  });
});

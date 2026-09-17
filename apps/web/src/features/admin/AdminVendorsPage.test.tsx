import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import {
  activeVendor,
  assignedRoundDetail,
  inactiveVendor,
  roundDetail,
} from './admin.fixtures';
import {
  assignRound,
  cancelRound,
  closeRound,
  deliverRound,
  fetchAdminRound,
  fetchVendors,
  setPayment,
} from './admin.api';
import { AdminRoundDetailPage } from './AdminRoundDetailPage';
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

const fetchAdminRoundMock = vi.mocked(fetchAdminRound);
const fetchVendorsMock = vi.mocked(fetchVendors);
const assignRoundMock = vi.mocked(assignRound);
const closeRoundMock = vi.mocked(closeRound);
const cancelRoundMock = vi.mocked(cancelRound);
const deliverRoundMock = vi.mocked(deliverRound);
const setPaymentMock = vi.mocked(setPayment);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/rounds/round_1']}>
        <Routes>
          <Route path="/admin/rounds/:id" element={<AdminRoundDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminRoundDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchVendorsMock.mockResolvedValue(page([activeVendor, inactiveVendor]));
  });

  it('OPEN: shows Close and Cancel only, and closing calls closeRound', async () => {
    fetchAdminRoundMock.mockResolvedValue(roundDetail());
    closeRoundMock.mockResolvedValue({} as never);
    renderPage();

    const close = await screen.findByRole('button', { name: 'Close round' });
    expect(fetchAdminRoundMock).toHaveBeenCalledWith('round_1');
    expect(screen.getByText('Cancel round')).toBeInTheDocument();
    expect(screen.queryByText('Mark delivered')).not.toBeInTheDocument();
    expect(screen.queryByText('Assign vendor')).not.toBeInTheDocument();
    // No vendor yet, so no payment toggles.
    expect(screen.queryByText('Mark collected')).not.toBeInTheDocument();
    // Unnamed resident falls back to "Resident".
    expect(screen.getAllByTestId('participant-row')[1]).toHaveTextContent('Resident');

    fireEvent.click(close);
    await waitFor(() => expect(closeRoundMock).toHaveBeenCalledWith('round_1'));
  });

  it('CLOSED_MET: assign form lists only active vendors and submits vendorId + finalPrice', async () => {
    fetchAdminRoundMock.mockResolvedValue(roundDetail({ status: 'CLOSED_MET' }));
    assignRoundMock.mockResolvedValue(assignedRoundDetail());
    renderPage();

    const submit = await screen.findByRole('button', { name: 'Assign vendor' });
    expect(screen.queryByText('Close round')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark delivered')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /CoolFix/ })).toBeInTheDocument();
    expect(screen.queryByText(/OldCo/)).not.toBeInTheDocument();
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'ven_1' } });
    fireEvent.change(screen.getByLabelText('Final price per AC unit (₹)'), { target: { value: '0' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Final price per AC unit (₹)'), { target: { value: '750' } });
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    await waitFor(() =>
      expect(assignRoundMock).toHaveBeenCalledWith('round_1', { vendorId: 'ven_1', finalPrice: 750 }),
    );
  });

  it('CLOSED_MET with no active vendors links to the vendors page', async () => {
    fetchAdminRoundMock.mockResolvedValue(roundDetail({ status: 'CLOSED_MET' }));
    fetchVendorsMock.mockResolvedValue(page([inactiveVendor]));
    renderPage();

    const link = await screen.findByRole('link', { name: 'Add a vendor' });
    expect(link).toHaveAttribute('href', '/admin/vendors');
  });

  it('ASSIGNED: shows Deliver and payment toggles that call setPayment', async () => {
    fetchAdminRoundMock.mockResolvedValue(assignedRoundDetail());
    deliverRoundMock.mockResolvedValue(assignedRoundDetail());
    setPaymentMock.mockResolvedValue(assignedRoundDetail().participants[0]);
    renderPage();

    const deliver = await screen.findByRole('button', { name: 'Mark delivered' });
    expect(screen.queryByText('Close round')).not.toBeInTheDocument();
    expect(screen.getByTestId('final-price')).toHaveTextContent('₹800');
    expect(screen.getByTestId('payment-summary')).toHaveTextContent(
      '1 of 2 paid · ₹1,600 collected · ₹3,200 outstanding',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark collected for Asha' }));
    await waitFor(() =>
      expect(setPaymentMock).toHaveBeenCalledWith('round_1', 'p_1', { collected: true }),
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Undo payment for Resident' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo payment for Resident' }));
    await waitFor(() =>
      expect(setPaymentMock).toHaveBeenCalledWith('round_1', 'p_2', { collected: false }),
    );

    fireEvent.click(deliver);
    await waitFor(() => expect(deliverRoundMock).toHaveBeenCalledWith('round_1'));
  });

  it('cancel requires the inline confirm step', async () => {
    fetchAdminRoundMock.mockResolvedValue(roundDetail());
    cancelRoundMock.mockResolvedValue({} as never);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel round' }));
    expect(cancelRoundMock).not.toHaveBeenCalled();

    // Backing out does nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Keep round' }));
    expect(screen.queryByTestId('cancel-confirm')).not.toBeInTheDocument();
    expect(cancelRoundMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel round' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel round' }));
    await waitFor(() => expect(cancelRoundMock).toHaveBeenCalledWith('round_1'));
  });

  it('DELIVERED: no lifecycle actions, payment toggles still available', async () => {
    fetchAdminRoundMock.mockResolvedValue({ ...assignedRoundDetail(), status: 'DELIVERED' });
    renderPage();

    await screen.findByRole('button', { name: 'Mark collected for Asha' });
    expect(screen.queryByText('Cancel round')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark delivered')).not.toBeInTheDocument();
  });

  it('shows the server error message inline when an action fails', async () => {
    fetchAdminRoundMock.mockResolvedValue(roundDetail());
    closeRoundMock.mockRejectedValue(
      new ApiError('INVALID_ROUND_TRANSITION', 'Round is no longer open.', 409),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Close round' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Round is no longer open.');
    // A failed action refetches the round (it likely changed underneath the page).
    await waitFor(() => expect(fetchAdminRoundMock).toHaveBeenCalledTimes(2));
  });

  it('shows the round rating summary and what each resident said (FEAT-009)', async () => {
    const base = assignedRoundDetail();
    fetchAdminRoundMock.mockResolvedValue({
      ...base,
      ratings: { average: 3.5, count: 2 },
      participants: [
        {
          ...base.participants[0],
          rating: { stars: 5, comment: 'Excellent.', ratedAt: '2026-09-18T10:00:00.000Z' },
        },
        { ...base.participants[1], rating: null },
      ],
    });
    renderPage();

    expect(await screen.findByTestId('round-rating')).toHaveTextContent('3.5 (2)');
    const cells = screen.getAllByTestId('participant-rating').map((el) => el.textContent);
    expect(cells[0]).toContain('5 / 5');
    expect(cells[0]).toContain('Excellent.');
    // A participant who has not rated shows a dash, never a zero.
    expect(cells[1]).toBe('—');
  });

  it('says so explicitly when a round has no ratings', async () => {
    fetchAdminRoundMock.mockResolvedValue({
      ...assignedRoundDetail(),
      ratings: { average: null, count: 0 },
    });
    renderPage();

    expect(await screen.findByTestId('round-rating')).toHaveTextContent('No ratings yet');
  });

  it('names the service’s unit everywhere on the page, including the PRICE field (FEAT-010)', async () => {
    // The reviewer's mutation run showed this file stayed green with the label helpers
    // stubbed — which is exactly where two generic renders survived, one of them the
    // per-unit price that amountDue bills against.
    const painting = {
      id: 'svc_paint',
      name: 'Painting',
      slug: 'painting',
      category: 'Renovation',
      unitLabel: 'room',
      unitLabelPlural: 'rooms',
      unitDescription: 'One room, walls only.',
    };
    fetchAdminRoundMock.mockResolvedValue({
      ...roundDetail({ status: 'CLOSED_MET' }),
      service: painting,
      tiers: [{ threshold: 5, price: 3500 }],
    });
    fetchVendorsMock.mockResolvedValue(page([activeVendor]));
    renderPage();

    await screen.findByText('Painting');
    // Facts, tiers and the participants column.
    expect(screen.getByText('Rooms / residents')).toBeInTheDocument();
    expect(screen.getByText(/5 rooms\+/)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Rooms' })).toBeInTheDocument();
    // The money field: a negotiated price is per WHAT.
    expect(await screen.findByLabelText('Final price per room (₹)')).toBeInTheDocument();
    // And nothing on the page still says the generic word.
    expect(screen.queryByText(/per unit/i)).not.toBeInTheDocument();
  });
});

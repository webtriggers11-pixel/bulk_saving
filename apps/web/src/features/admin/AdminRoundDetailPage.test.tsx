import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ApiError } from '../../lib/api';
import {
  activeVendor,
  assignedRoundDetail,
  inactiveVendor,
  roundDetail,
  type RoundDetailFixture,
} from './admin.fixtures';
import {
  assignRound,
  cancelRound,
  closeRound,
  deliverRound,
  fetchAdminRound,
  fetchRoundParticipants,
  fetchVendors,
  reopenRound,
  setPayment,
  updateRound,
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
  fetchRoundParticipants: vi.fn(),
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
  updateRound: vi.fn(),
  reopenRound: vi.fn(),
}));

// FEAT-044: fixtures carry `participants`; the paged endpoint serves them from the current round mock.
const fetchAdminRoundMock = vi.mocked(fetchAdminRound) as unknown as Mock<(id: string) => Promise<RoundDetailFixture>>;
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
    // Calls the round mock's implementation directly, so its call count stays the page's own.
    vi.mocked(fetchRoundParticipants).mockImplementation(async () => {
      const round = await fetchAdminRoundMock.getMockImplementation()?.('round_1');
      return page(round?.participants ?? []);
    });
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
    expect((await screen.findAllByTestId('participant-row'))[1]).toHaveTextContent('Resident');

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

    const participantsBefore = vi.mocked(fetchRoundParticipants).mock.calls.length;
    fireEvent.click(await screen.findByRole('button', { name: 'Mark collected for Asha' }));
    await waitFor(() =>
      expect(setPaymentMock).toHaveBeenCalledWith('round_1', 'p_1', { collected: true }),
    );
    // FEAT-044 V2 P3-5: the toggle refreshes the paged participants (same key prefix as the round).
    await waitFor(() => expect(vi.mocked(fetchRoundParticipants).mock.calls.length).toBeGreaterThan(participantsBefore));

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

  it('cancel asks first (FEAT-024)', async () => {
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
    // FEAT-039: a reason is required before the danger button works.
    expect(screen.getByRole('button', { name: 'Yes, cancel round' })).toBeDisabled();
    fireEvent.change(screen.getByTestId('cancel-reason'), { target: { value: 'ab' } });
    expect(screen.getByRole('button', { name: 'Yes, cancel round' })).toBeDisabled();
    fireEvent.change(screen.getByTestId('cancel-reason'), { target: { value: '  Vendor unavailable  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel round' }));
    await waitFor(() => expect(cancelRoundMock).toHaveBeenCalledWith('round_1', 'Vendor unavailable'));
  });

  it('a refused cancel stays in the sheet with its reason (FEAT-024 AC1)', async () => {
    fetchAdminRoundMock.mockResolvedValue(roundDetail());
    cancelRoundMock.mockRejectedValue(new ApiError('ROUND_CLOSED', 'Already closed.', 409));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel round' }));
    fireEvent.change(screen.getByTestId('cancel-reason'), { target: { value: 'Vendor unavailable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel round' }));
    await waitFor(() => expect(cancelRoundMock).toHaveBeenCalled());
    expect(screen.getByRole('dialog', { name: 'Cancel this round?' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent(/Already closed/);
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
    const cells = (await screen.findAllByTestId('participant-rating')).map((el) => el.textContent);
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
    expect(await screen.findByRole('columnheader', { name: 'Rooms' })).toBeInTheDocument();
    // The money field: a negotiated price is per WHAT.
    expect(await screen.findByLabelText('Final price per room (₹)')).toBeInTheDocument();
    // And nothing on the page still says the generic word.
    expect(screen.queryByText(/per unit/i)).not.toBeInTheDocument();
  });

  describe('Edit round (FEAT-038)', () => {
    it('an OPEN round opens the editor prefilled; saving sends only what changed', async () => {
      fetchAdminRoundMock.mockResolvedValue(roundDetail());
      vi.mocked(updateRound).mockResolvedValue(roundDetail({ tiers: [{ threshold: 5, price: 850 }, { threshold: 10, price: 700 }] }));
      renderPage();
      fireEvent.click(await screen.findByTestId('edit-round-open'));
      const price1 = screen.getByLabelText('Tier 1 price (₹)');
      expect(price1).toHaveValue(900);
      expect(screen.getByLabelText('Tier 2 threshold (AC units)')).toHaveValue(10);
      fireEvent.change(price1, { target: { value: '850' } });
      fireEvent.click(screen.getByTestId('edit-round-save'));
      await waitFor(() => expect(updateRound).toHaveBeenCalled());
      expect(vi.mocked(updateRound).mock.calls[0]).toEqual(['round_1', { tiers: [{ threshold: 5, price: 850 }, { threshold: 10, price: 700 }] }]);
      expect(await screen.findByText('Saved')).toBeInTheDocument();
    });

    it('a new deadline is sent as an ISO instant', async () => {
      fetchAdminRoundMock.mockResolvedValue(roundDetail());
      vi.mocked(updateRound).mockResolvedValue(roundDetail());
      renderPage();
      fireEvent.click(await screen.findByTestId('edit-round-open'));
      fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '2030-01-15T18:30' } });
      fireEvent.click(screen.getByTestId('edit-round-save'));
      await waitFor(() => expect(updateRound).toHaveBeenCalled());
      expect(vi.mocked(updateRound).mock.calls[0][1]).toEqual({ deadline: new Date('2030-01-15T18:30').toISOString() });
    });

    it('bad tiers are refused before calling the API; a server refusal is shown', async () => {
      fetchAdminRoundMock.mockResolvedValue(roundDetail());
      vi.mocked(updateRound).mockRejectedValue(new ApiError('ROUND_CLOSED', 'Only an open round can be edited. This one has already closed.', 409));
      renderPage();
      fireEvent.click(await screen.findByTestId('edit-round-open'));
      fireEvent.change(screen.getByLabelText('Tier 2 threshold (AC units)'), { target: { value: '5' } });
      fireEvent.click(screen.getByTestId('edit-round-save'));
      expect(await screen.findByText('Tier thresholds must be strictly ascending.')).toBeInTheDocument();
      expect(updateRound).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText('Tier 2 threshold (AC units)'), { target: { value: '12' } });
      fireEvent.click(screen.getByTestId('edit-round-save'));
      expect(await screen.findByText(/already closed/)).toBeInTheDocument();
    });

    it('an old round with rising prices can still have just its deadline moved (V2 P2-3)', async () => {
      fetchAdminRoundMock.mockResolvedValue(roundDetail({ tiers: [{ threshold: 5, price: 700 }, { threshold: 6, price: 800 }] }));
      vi.mocked(updateRound).mockResolvedValue(roundDetail());
      renderPage();
      fireEvent.click(await screen.findByTestId('edit-round-open'));
      fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '2030-01-15T18:30' } });
      fireEvent.click(screen.getByTestId('edit-round-save'));
      await waitFor(() => expect(updateRound).toHaveBeenCalled());
      expect(vi.mocked(updateRound).mock.calls[0][1]).toEqual({ deadline: new Date('2030-01-15T18:30').toISOString() });
    });

    it('saving with nothing changed sends nothing; Cancel closes the editor', async () => {
      fetchAdminRoundMock.mockResolvedValue(roundDetail());
      renderPage();
      fireEvent.click(await screen.findByTestId('edit-round-open'));
      fireEvent.click(screen.getByTestId('edit-round-save'));
      await waitFor(() => expect(screen.queryByTestId('edit-round-save')).not.toBeInTheDocument());
      expect(updateRound).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('edit-round-open'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByTestId('edit-round-save')).not.toBeInTheDocument();
    });

    it('is not offered once the round has closed', async () => {
      fetchAdminRoundMock.mockResolvedValue(roundDetail({ status: 'CLOSED_MET' }));
      renderPage();
      await screen.findByText('AC Servicing');
      expect(screen.queryByTestId('edit-round')).not.toBeInTheDocument();
    });
  });

  describe('Cancelled round: reason and reopen (FEAT-039)', () => {
    const cancelled = () => roundDetail({ status: 'CANCELLED', cancelReason: 'Vendor unavailable', cancelledAt: '2026-11-20T10:00:00.000Z', canReopen: true });

    it('shows the reason and reopens with a new deadline', async () => {
      fetchAdminRoundMock.mockResolvedValue(cancelled());
      vi.mocked(reopenRound).mockResolvedValue(roundDetail());
      renderPage();
      expect(await screen.findByTestId('cancel-reason-shown')).toHaveTextContent('Reason: Vendor unavailable');
      fireEvent.click(screen.getByTestId('reopen-round'));
      expect(await screen.findByText('Choose a new deadline.')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('New deadline'), { target: { value: '2030-01-15T18:30' } });
      fireEvent.click(screen.getByTestId('reopen-round'));
      await waitFor(() => expect(reopenRound).toHaveBeenCalledWith('round_1', new Date('2030-01-15T18:30').toISOString()));
    });

    it('says why a round that had a vendor cannot be reopened', async () => {
      fetchAdminRoundMock.mockResolvedValue({ ...cancelled(), canReopen: false });
      renderPage();
      expect(await screen.findByTestId('reopen-blocked')).toHaveTextContent("can't be reopened");
      expect(screen.queryByTestId('reopen-round')).not.toBeInTheDocument();
    });

    it('shows the server\'s refusal (another round open for the pair)', async () => {
      fetchAdminRoundMock.mockResolvedValue(cancelled());
      vi.mocked(reopenRound).mockRejectedValue(new ApiError('ROUND_ALREADY_OPEN', 'An open round already exists for this service in this society.', 409));
      renderPage();
      fireEvent.change(await screen.findByLabelText('New deadline'), { target: { value: '2030-01-15T18:30' } });
      fireEvent.click(screen.getByTestId('reopen-round'));
      expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    });
  });
});

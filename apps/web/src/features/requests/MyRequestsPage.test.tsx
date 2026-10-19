import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyRoundDto } from '@bulk/shared';
import { MyRequestsPage } from './MyRequestsPage';
import { fetchMyRounds } from '../rounds/rounds.api';
import { page } from '../../test/page';

vi.mock('../rounds/rounds.api', () => ({
  fetchMyRounds: vi.fn(),
  fetchRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));

const fetchMyRoundsMock = vi.mocked(fetchMyRounds);

function round(overrides: Partial<MyRoundDto> = {}): MyRoundDto {
  return {
    id: 'round_1',
    service: { id: 'svc_1', name: 'AC Servicing', slug: 'ac-servicing', category: 'Appliances', unitLabel: 'AC unit', unitLabelPlural: 'AC units', unitDescription: null },
    status: 'OPEN',
    unitsCount: 6,
    currentPrice: 900,
    deadline: '2099-01-01T12:00:00.000Z',
    tiers: [{ threshold: 5, price: 900 }],
    myUnits: 2,
    finalPrice: null,
    myRating: null,
    ...overrides,
  };
}

let queryClientRef: QueryClient | undefined;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClientRef = client;
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/my-requests']}>
        <MyRequestsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyRequestsPage', () => {
  beforeEach(() => {
    fetchMyRoundsMock.mockReset();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    vi.clearAllMocks();
  });

  it('reads GET /rounds/mine, not the OPEN-only browse list', async () => {
    fetchMyRoundsMock.mockResolvedValue(page([round()]));
    renderPage();

    await waitFor(() => expect(fetchMyRoundsMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('my-round-round_1')).toBeInTheDocument();
  });

  it('shows the pledge and the live price for a joined round', async () => {
    fetchMyRoundsMock.mockResolvedValue(page([round({ myUnits: 1, currentPrice: 1200 })]));
    renderPage();

    // FEAT-010: the service's own word, singular for one.
    expect(await screen.findByTestId('my-units')).toHaveTextContent('1 AC unit');
    expect(screen.getByTestId('my-price')).toHaveTextContent('₹1,200');
  });

  it.each([
    ['CLOSED_MET' as const, 'Target met', /booking a vendor/i],
    ['CLOSED_EXPIRED' as const, 'Did not fill', /Not enough neighbours/i],
    ['ASSIGNED' as const, 'Vendor booked', /vendor is scheduled/i],
    ['DELIVERED' as const, 'Delivered', /job is done/i],
    ['CANCELLED' as const, 'Cancelled', /not charged/i],
  ])('keeps a %s round visible and explains it in the resident’s words', async (status, badge, detail) => {
    fetchMyRoundsMock.mockResolvedValue(page([round({ status })]));
    renderPage();

    expect(await screen.findByTestId('status-badge')).toHaveTextContent(badge);
    expect(screen.getByTestId('my-round-round_1')).toHaveTextContent(detail);
    // The raw enum must never reach the resident.
    expect(screen.getByTestId('my-round-round_1')).not.toHaveTextContent(status);
  });

  it('shows an existing rating when the round carries one', async () => {
    fetchMyRoundsMock.mockResolvedValue(page([
      round({
        status: 'RATED',
        myRating: {
          id: 'rat_1',
          roundId: 'round_1',
          residentId: 'res_1',
          stars: 4,
          comment: null,
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
        },
      }),
    ]));
    renderPage();

    expect(await screen.findByTestId('my-rating')).toHaveTextContent('4 / 5');
  });

  it('offers a way out of the empty state instead of a dead end', async () => {
    fetchMyRoundsMock.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByTestId('my-requests-empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See open rounds' })).toHaveAttribute('href', '/rounds');
  });

  it('shows the offline/retry state when the request fails', async () => {
    fetchMyRoundsMock.mockRejectedValue(new Error('network down'));
    renderPage();

    const alert = await screen.findByTestId('query-error');
    expect(alert).toHaveTextContent(/requests/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows the offline state on a paused read, not a bare header (FEAT-008 V2 / BUG-004)', async () => {
    // The existing failure test uses mockRejectedValue, which is the SERVER-ERROR
    // path. Offline pauses the query instead: isError false, isLoading false, no
    // data — so gating on those alone rendered the heading and nothing else.
    fetchMyRoundsMock.mockResolvedValue(page([]));
    onlineManager.setOnline(false);
    renderPage();

    expect(await screen.findByTestId('query-error')).toBeInTheDocument();
    expect(fetchMyRoundsMock).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    await waitFor(() => expect(fetchMyRoundsMock).toHaveBeenCalled());
  });

  it('does not claim stale data when the list it failed to refresh was empty', async () => {
    // Boolean([]) is true, so the old flag rendered "showing what we loaded earlier"
    // AND the empty-state card together.
    fetchMyRoundsMock.mockResolvedValueOnce(page([])).mockRejectedValue(new Error('network down'));
    renderPage();

    await screen.findByTestId('my-requests-empty');
    fetchMyRoundsMock.mockRejectedValue(new Error('network down'));
    await act(async () => {
      await queryClientRef?.refetchQueries();
    });

    const banner = screen.queryByTestId('query-error');
    if (banner) {
      expect(banner).toHaveAttribute('data-mode', 'error');
      expect(banner).not.toHaveAttribute('data-mode', 'stale');
    }
  });

  describe('the price a resident owes (BUG-010)', () => {
    it('shows the negotiated price, labelled final, once the admin has set one — not the tier price', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([
        round({ status: 'DELIVERED', currentPrice: 700, finalPrice: 680, myUnits: 3 }),
      ]));
      renderPage();

      const price = await screen.findByTestId('my-price');
      expect(price).toHaveTextContent('₹680');
      expect(screen.getByText('Final price per AC unit')).toBeInTheDocument();
      // And what that comes to: 3 × ₹680.
      expect(screen.getByTestId('my-total')).toHaveTextContent('₹2,040');
    });

    it('shows the tier price, and no total, while nothing has been negotiated', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round({ status: 'OPEN', currentPrice: 900, finalPrice: null })]));
      renderPage();

      expect(await screen.findByTestId('my-price')).toHaveTextContent('₹900');
      expect(screen.getByText('Price per AC unit')).toBeInTheDocument();
      expect(screen.queryByTestId('my-total')).not.toBeInTheDocument();
    });
  });
});

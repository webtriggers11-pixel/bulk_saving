import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundDto } from '@bulk/shared';
import { RoundsPage } from './RoundsPage';
import { fetchRounds, joinRound } from './rounds.api';

// Mock the whole API module so the hooks resolve against these fakes, never fetch.
vi.mock('./rounds.api', () => ({
  fetchRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));

const fetchRoundsMock = vi.mocked(fetchRounds);
const joinRoundMock = vi.mocked(joinRound);

const openRound: RoundDto = {
  id: 'round_1',
  service: { id: 'svc_1', name: 'AC Servicing', slug: 'ac-servicing', category: 'Appliances', unitLabel: 'AC unit', unitLabelPlural: 'AC units', unitDescription: null },
  status: 'OPEN',
  unitsCount: 6,
  currentPrice: 900,
  nextTier: { threshold: 10, price: 700 },
  deadline: '2026-09-24T12:00:00.000Z',
  tiers: [
    { threshold: 5, price: 900 },
    { threshold: 10, price: 700 },
  ],
  myUnits: 0,
  finalPrice: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/rounds']}>
        <RoundsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RoundsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a round with service name, current price, unit count and the next-tier hint', async () => {
    fetchRoundsMock.mockResolvedValue([openRound]);
    renderPage();

    await waitFor(() => expect(screen.getByText('AC Servicing')).toBeInTheDocument());
    expect(screen.getByText('Appliances')).toBeInTheDocument();
    // Current price in ₹ (Indian locale, no decimals).
    expect(screen.getByTestId('price-round_1')).toHaveTextContent('₹900');
    // Live unit count toward the tier, in the SERVICE'S unit (FEAT-010).
    expect(screen.getByTestId('units-count-round_1')).toHaveTextContent('6 AC units pledged');
    // "unlocks ₹X at N <units>" hint from nextTier.
    expect(screen.getByTestId('next-tier-round_1')).toHaveTextContent('Unlocks ₹700 at 10 AC units');
    expect(screen.getByTestId('round-card')).toBeInTheDocument();
  });

  it('joins with the chosen units and refetches the list', async () => {
    fetchRoundsMock.mockResolvedValue([openRound]);
    joinRoundMock.mockResolvedValue({ ...openRound, myUnits: 3, unitsCount: 9 });
    renderPage();

    await waitFor(() => expect(screen.getByTestId('join-round_1')).toBeInTheDocument());

    // Choose 3 units, then join.
    fireEvent.change(screen.getByTestId('units-input-round_1'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('join-round_1'));

    // The mutation is called with the round id and the chosen units.
    await waitFor(() => expect(joinRoundMock).toHaveBeenCalledWith('round_1', 3));
    // Success invalidates ['rounds'] → the list refetches (initial + post-join).
    await waitFor(() => expect(fetchRoundsMock).toHaveBeenCalledTimes(2));
  });

  it('shows the empty state when there are no open rounds', async () => {
    fetchRoundsMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByTestId('rounds-empty')).toBeInTheDocument());
    expect(screen.getByText(/No open rounds in your society yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId('round-card')).not.toBeInTheDocument();
  });
});

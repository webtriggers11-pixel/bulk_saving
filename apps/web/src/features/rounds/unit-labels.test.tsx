import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MyRoundDto, RoundDto } from '@bulk/shared';
import { MyRequestsPage } from '../requests/MyRequestsPage';
import { RoundsPage } from './RoundsPage';
import { fetchMyRounds, fetchRounds } from './rounds.api';

vi.mock('./rounds.api', () => ({
  fetchRounds: vi.fn(),
  fetchMyRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));

/**
 * FEAT-010 end to end through the resident screens, using PAINTING — the service that
 * made the feature necessary. Before this, every one of these read "units", which for
 * painting is meaningless: a resident committed to, and was billed
 * `finalPrice × units` for, an undefined quantity.
 */
const painting = {
  id: 'svc_paint',
  name: 'Painting',
  slug: 'painting',
  category: 'Renovation',
  unitLabel: 'room',
  unitLabelPlural: 'rooms',
  unitDescription: 'One room up to 12x12 ft: walls only, two coats.',
};

const base: RoundDto = {
  id: 'round_paint',
  service: painting,
  status: 'OPEN',
  unitsCount: 6,
  currentPrice: 3500,
  nextTier: { threshold: 10, price: 3200 },
  deadline: '2099-01-01T12:00:00.000Z',
  tiers: [
    { threshold: 5, price: 3500 },
    { threshold: 10, price: 3200 },
  ],
  myUnits: 0,
  finalPrice: null,
};

function renderWith(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('resident screens speak the service’s unit (FEAT-010)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('the browse card counts ROOMS, prices per room, and says what a room includes', async () => {
    vi.mocked(fetchRounds).mockResolvedValue([base]);
    renderWith(<RoundsPage />);

    await waitFor(() => expect(screen.getByText('Painting')).toBeInTheDocument());
    expect(screen.getByTestId('units-count-round_paint')).toHaveTextContent('6 rooms pledged');
    expect(screen.getByTestId('price-round_paint')).toHaveTextContent('₹3,500 / room');
    expect(screen.getByTestId('next-tier-round_paint')).toHaveTextContent('at 10 rooms');
    // The scope sentence is the part that actually settles disputes (ADR-0019).
    expect(screen.getByTestId('unit-scope-round_paint')).toHaveTextContent('walls only');
    // And the word "unit" is gone from the card entirely.
    expect(screen.getByTestId('round-card').textContent).not.toMatch(/\bunits?\b/);
  });

  it('the join control is labelled with the unit, not "Units"', async () => {
    vi.mocked(fetchRounds).mockResolvedValue([base]);
    renderWith(<RoundsPage />);

    // FEAT-016: the control lives in the pledge sheet.
    fireEvent.click(await screen.findByTestId('pledge-open-round_paint'));
    expect(screen.getByLabelText('Rooms')).toBeInTheDocument();
    expect(screen.queryByLabelText('Units')).not.toBeInTheDocument();
  });

  it('the pledge line singularises correctly for one room', async () => {
    vi.mocked(fetchRounds).mockResolvedValue([{ ...base, myUnits: 1 }]);
    renderWith(<RoundsPage />);

    expect(await screen.findByTestId('my-units-round_paint')).toHaveTextContent(
      "You've pledged 1 room",
    );
  });

  it('My Requests shows the pledge and price in rooms', async () => {
    const mine: MyRoundDto = { ...base, myUnits: 2, status: 'ASSIGNED', myRating: null };
    vi.mocked(fetchMyRounds).mockResolvedValue([mine]);
    renderWith(<MyRequestsPage />);

    expect(await screen.findByTestId('my-units')).toHaveTextContent('2 rooms');
    expect(screen.getByText('Price per room')).toBeInTheDocument();
  });

  it('a service with NO labels still reads correctly — "unit(s)", never blank', async () => {
    vi.mocked(fetchRounds).mockResolvedValue([
      { ...base, service: { ...painting, unitLabel: '', unitLabelPlural: '', unitDescription: null } },
    ]);
    renderWith(<RoundsPage />);

    expect(await screen.findByTestId('units-count-round_paint')).toHaveTextContent('6 units pledged');
    expect(screen.getByTestId('price-round_paint')).toHaveTextContent('₹3,500 / unit');
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { onlineManager } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundDto } from '@bulk/shared';
import { RoundsPage } from './RoundsPage';
import { fetchRounds, joinRound, leaveRound, updatePledge } from './rounds.api';

// Mock the whole API module so the hooks resolve against these fakes, never fetch.
vi.mock('./rounds.api', () => ({
  fetchRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));

const fetchRoundsMock = vi.mocked(fetchRounds);
const joinRoundMock = vi.mocked(joinRound);
const updatePledgeMock = vi.mocked(updatePledge);
const leaveRoundMock = vi.mocked(leaveRound);

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

  it('below the first tier, says the round GOES AHEAD there — not that it "unlocks" the price already shown (CHORE-010)', async () => {
    fetchRoundsMock.mockResolvedValue([
      { ...openRound, unitsCount: 2, currentPrice: 900, nextTier: { threshold: 5, price: 900 } },
    ]);
    renderPage();

    const line = await screen.findByTestId('next-tier-round_1');
    expect(line).toHaveTextContent('Goes ahead at 5 AC units');
    expect(line).not.toHaveTextContent('Unlocks');
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

    // FEAT-016: the card's Join opens the pledge sheet; the sheet commits.
    fireEvent.click(await screen.findByTestId('pledge-open-round_1'));
    expect(screen.getByRole('dialog', { name: 'Join AC Servicing' })).toBeInTheDocument();

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

  describe('the pledge sheet (FEAT-016)', () => {
    it('stepping costs nothing — nothing is sent until the one action is pressed', async () => {
      fetchRoundsMock.mockResolvedValue([openRound]);
      renderPage();
      fireEvent.click(await screen.findByTestId('pledge-open-round_1'));
      fireEvent.click(screen.getByTestId('increment-round_1'));
      fireEvent.click(screen.getByTestId('increment-round_1'));
      expect(joinRoundMock).not.toHaveBeenCalled();
      expect(screen.getByTestId('join-round_1')).toHaveTextContent('Join with 3 AC units');
    });

    it('previews what the chosen number costs — today, and at the next, cheaper tier', async () => {
      fetchRoundsMock.mockResolvedValue([{ ...openRound, currentPrice: 900, nextTier: { threshold: 10, price: 700 } }]);
      renderPage();
      fireEvent.click(await screen.findByTestId('pledge-open-round_1'));
      fireEvent.change(screen.getByTestId('units-input-round_1'), { target: { value: '2' } });
      const preview = screen.getByTestId('pledge-preview-round_1');
      expect(preview).toHaveTextContent('₹1,800'); // 2 × ₹900
      expect(preview).toHaveTextContent('₹1,400'); // 2 × ₹700
      expect(preview).toHaveTextContent('At 10 AC units');
    });

    it('a pledged resident changes it from the same sheet, and cannot "update" to the same number', async () => {
      fetchRoundsMock.mockResolvedValue([{ ...openRound, myUnits: 2 }]);
      updatePledgeMock.mockResolvedValue({ ...openRound, myUnits: 3 });
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
      expect(screen.getByTestId('update-round_1')).toBeDisabled();
      fireEvent.click(screen.getByTestId('increment-round_1'));
      fireEvent.click(screen.getByTestId('update-round_1'));
      await waitFor(() => expect(updatePledgeMock).toHaveBeenCalledWith('round_1', 3));
    });

    it('leaving is in the sheet, and the sheet closes once the server agrees', async () => {
      fetchRoundsMock.mockResolvedValue([{ ...openRound, myUnits: 2 }]);
      leaveRoundMock.mockResolvedValue(undefined as never);
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
      fireEvent.click(screen.getByTestId('leave-round_1'));
      await waitFor(() => expect(leaveRoundMock).toHaveBeenCalledWith('round_1'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('each opening starts from what is pledged now — an abandoned draft does not come back', async () => {
      fetchRoundsMock.mockResolvedValue([openRound]);
      renderPage();
      fireEvent.click(await screen.findByTestId('pledge-open-round_1'));
      fireEvent.click(screen.getByTestId('increment-round_1'));
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      fireEvent.click(screen.getByTestId('pledge-open-round_1'));
      expect(screen.getByTestId('units-input-round_1')).toHaveValue(1);
    });

    it('a pledge queued OFFLINE still says so on the card once the sheet is closed (FEAT-016 V2 P2-3)', async () => {
      fetchRoundsMock.mockResolvedValue([openRound]);
      renderPage();
      fireEvent.click(await screen.findByTestId('pledge-open-round_1'));
      onlineManager.setOnline(false);
      fireEvent.click(screen.getByTestId('join-round_1'));
      await screen.findByTestId('pledge-paused');
      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByTestId('pledge-paused')).toBeInTheDocument();
      onlineManager.setOnline(true);
    });
  });
});

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundDto } from '@bulk/shared';
import { RoundsPage } from './RoundsPage';
import { PriceLadder } from './PriceLadder';
import { RoundsSummary } from './RoundsSummary';
import { InviteButton, inviteText } from './InviteButton';
import { Celebrate } from './Celebrate';
import { formatClock } from './formatCountdown';
import { fetchRounds, joinRound } from './rounds.api';

/**
 * FEAT-018 — the rounds screen's ladder, summary, invite, celebration and live clock.
 */
vi.mock('./rounds.api', () => ({
  fetchRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));
const fetchRoundsMock = vi.mocked(fetchRounds);
const joinRoundMock = vi.mocked(joinRound);

const ac: RoundDto = {
  id: 'round_ac',
  service: { id: 's1', name: 'AC Servicing', slug: 'ac', category: 'Appliances', unitLabel: 'AC unit', unitLabelPlural: 'AC units', unitDescription: null },
  status: 'OPEN',
  unitsCount: 7,
  currentPrice: 900,
  nextTier: { threshold: 10, price: 700 },
  deadline: '2099-01-01T00:00:00.000Z',
  tiers: [
    { threshold: 10, price: 700 },
    { threshold: 5, price: 900 },
    { threshold: 20, price: 600 },
  ],
  myUnits: 0,
  finalPrice: null,
};

function allowMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

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

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('PriceLadder (AC2)', () => {
  it('lists every tier in climbing order, marks reached and next, and says how far the next one is', () => {
    render(<PriceLadder round={ac} />);
    const steps = within(screen.getByRole('list', { name: 'Price ladder' })).getAllByRole('listitem');
    expect(steps.map((s) => s.textContent)).toEqual([
      '₹9005 AC units, reached',
      '₹70010 AC units, next',
      '₹60020 AC units',
    ]);
    expect(screen.getByTestId('to-go-round_ac')).toHaveTextContent('3 more AC units and everyone pays ₹700');
  });

  it('below the go-ahead line it says the round goes ahead, not that a price unlocks', () => {
    render(<PriceLadder round={{ ...ac, unitsCount: 4, nextTier: { threshold: 5, price: 900 } }} />);
    expect(screen.getByTestId('to-go-round_ac')).toHaveTextContent('1 more AC unit and this round goes ahead');
  });

  it('at the top tier there is nothing left to go, and a single-tier round has no ladder', () => {
    const { rerender } = render(<PriceLadder round={{ ...ac, unitsCount: 25, currentPrice: 600, nextTier: undefined }} />);
    expect(screen.queryByTestId('to-go-round_ac')).not.toBeInTheDocument();
    rerender(<PriceLadder round={{ ...ac, tiers: [{ threshold: 5, price: 900 }] }} />);
    expect(screen.queryByTestId('ladder-round_ac')).not.toBeInTheDocument();
  });
});

describe('RoundsSummary (AC1)', () => {
  it('counts open and joined rounds, and what my pledges could save at best', () => {
    render(<RoundsSummary rounds={[ac, { ...ac, id: 'r2', myUnits: 2 }]} />);
    expect(screen.getByTestId('summary-open')).toHaveTextContent('2');
    expect(screen.getByTestId('summary-joined')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-saving')).toHaveTextContent('₹600'); // (900 − 600) × 2
  });

  it('shows a dash, not ₹0, before anything is joined', () => {
    render(<RoundsSummary rounds={[ac]} />);
    expect(screen.getByTestId('summary-saving')).toHaveTextContent('—');
  });
});

describe('InviteButton (AC3)', () => {
  it('pitches the next price and never carries personal data', () => {
    expect(inviteText(ac)).toBe(
      'Join the AC Servicing group buy in our society on Bulk Saving. 3 more AC units and everyone pays ₹700.',
    );
    expect(inviteText({ ...ac, myUnits: 4 })).not.toMatch(/4|you/i);
  });

  it('uses the phone share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    render(<InviteButton round={ac} />);
    fireEvent.click(screen.getByRole('button', { name: 'Invite neighbours to AC Servicing' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0].url).toBe(`${window.location.origin}/rounds`);
  });

  it('falls back to the clipboard and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    render(<InviteButton round={ac} />);
    fireEvent.click(screen.getByTestId('invite-round_ac'));
    expect(await screen.findByText(/Invite link copied/)).toBeInTheDocument();
    expect(writeText.mock.calls[0][0]).toContain('/rounds');
  });

  it('a dismissed share sheet is not an error and copies nothing', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, share, clipboard: { writeText } });
    render(<InviteButton round={ac} />);
    fireEvent.click(screen.getByTestId('invite-round_ac'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText(/copied/)).not.toBeInTheDocument();
  });
});

describe('Celebrate (AC5)', () => {
  it('plays nothing at rest, and nothing at all under reduced motion', () => {
    const { rerender } = render(<Celebrate burst={0} />);
    expect(screen.queryByTestId('celebrate')).not.toBeInTheDocument();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    rerender(<Celebrate burst={1} />);
    expect(screen.queryByTestId('celebrate')).not.toBeInTheDocument();
  });

  it('bursts when motion is allowed', () => {
    allowMotion();
    render(<Celebrate burst={1} />);
    expect(screen.getByTestId('celebrate').children).toHaveLength(16);
  });
});

describe('the rounds screen (AC1, AC4, AC5, AC6)', () => {
  it('shows the summary, and marks a joined round as mine', async () => {
    fetchRoundsMock.mockResolvedValue([ac, { ...ac, id: 'mine', myUnits: 2 }]);
    renderPage();
    expect(await screen.findByTestId('rounds-summary')).toBeInTheDocument();
    expect(screen.getByTestId('joined-mine')).toHaveTextContent("You're in");
    expect(screen.queryByTestId('joined-round_ac')).not.toBeInTheDocument();
  });

  it('celebrates a join the server accepted', async () => {
    allowMotion();
    fetchRoundsMock.mockResolvedValue([ac]);
    joinRoundMock.mockResolvedValue({ ...ac, myUnits: 1, unitsCount: 8 });
    renderPage();
    fireEvent.click(await screen.findByTestId('pledge-open-round_ac'));
    fireEvent.click(screen.getByTestId('join-round_ac'));
    expect(await screen.findByTestId('celebrate')).toBeInTheDocument();
  });

  it('celebrates when a round reaches a cheaper tier while on screen', async () => {
    allowMotion();
    fetchRoundsMock.mockResolvedValue([ac]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <RoundsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId('round-card');
    expect(screen.queryByTestId('celebrate')).not.toBeInTheDocument();
    // The live count crosses 10: the round reaches its second tier.
    act(() => {
      client.setQueryData(['rounds'], [{ ...ac, unitsCount: 11, currentPrice: 700, nextTier: { threshold: 20, price: 600 } }]);
    });
    expect(await screen.findByTestId('celebrate')).toBeInTheDocument();
  });

  it('ticks the last day as a clock, and stops ticking on unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const deadline = new Date(Date.now() + 2 * 3600_000 + 5_000).toISOString();
    fetchRoundsMock.mockResolvedValue([{ ...ac, deadline }]);
    const view = renderPage();
    const badge = await screen.findByTestId('closing-round_ac');
    expect(badge.textContent).toMatch(/Closes in 02:00:0\d/);
    const before = badge.textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByTestId('closing-round_ac').textContent).not.toBe(before);
    const clear = vi.spyOn(window, 'clearInterval');
    view.unmount();
    expect(clear).toHaveBeenCalled();
  });

  it('formats the clock, and reads Closed once past', () => {
    const now = Date.parse('2026-10-19T10:00:00Z');
    expect(formatClock('2026-10-19T15:42:09Z', now)).toBe('Closes in 05:42:09');
    expect(formatClock('2026-10-19T09:00:00Z', now)).toBe('Closed');
  });
});

describe('TierRing glow (AC7)', () => {
  it('sits on the <svg>, never on an SVG element — a filtered <circle> painted a grey box', async () => {
    const { TierRing } = await import('./TierRing');
    const { container } = render(<TierRing label="AC: progress" percent={70} value={7} unitLabel="AC units" />);
    for (const shape of container.querySelectorAll('svg *')) {
      expect(shape.getAttribute('class') ?? '').not.toMatch(/drop-shadow/);
    }
    expect(container.querySelector('svg')?.getAttribute('class')).toMatch(/ring-arc .*drop-shadow/);
  });
});

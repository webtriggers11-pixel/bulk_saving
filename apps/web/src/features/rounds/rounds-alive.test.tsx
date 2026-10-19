import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
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
import { useDeadlineClock } from './useDeadlineClock';
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
  // Real timers back BEFORE restoring spies: a spy taken on a fake timer otherwise
  // restores to a function that no longer exists.
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    render(<InviteButton round={ac} onMessage={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Invite neighbours to AC Servicing' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0].url).toBe(`${window.location.origin}/rounds`);
  });

  it('falls back to the clipboard and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    const onMessage = vi.fn();
    render(<InviteButton round={ac} onMessage={onMessage} />);
    fireEvent.click(screen.getByTestId('invite-round_ac'));
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith(expect.stringMatching(/Invite link copied/)));
    expect(writeText.mock.calls[0][0]).toContain('/rounds');
  });

  it('a dismissed share sheet is not an error and copies nothing', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, share, clipboard: { writeText } });
    const onMessage = vi.fn();
    render(<InviteButton round={ac} onMessage={onMessage} />);
    fireEvent.click(screen.getByTestId('invite-round_ac'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
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
    // FEAT-019 wiring (V2 P3-4): the beam on the lead card only, light through the saving.
    const cards = screen.getAllByTestId('round-card');
    expect(cards[0].className).toMatch(/\bborder-beam\b/);
    expect(cards[1].className).not.toMatch(/\bborder-beam\b/);
    expect(screen.getByTestId('summary-saving').querySelector('.ink-shimmer')).not.toBeNull();
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

  it('ticks the last day as a clock on the card', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const deadline = new Date(Date.now() + 2 * 3600_000 + 5_000).toISOString();
    fetchRoundsMock.mockResolvedValue([{ ...ac, deadline }]);
    renderPage();
    const badge = await screen.findByTestId('closing-round_ac');
    expect(badge.textContent).toMatch(/Closes in 02:00:0\d/);
    const before = badge.textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByTestId('closing-round_ac').textContent).not.toBe(before);
  });

  it('the invite toast goes away on its own even while the card ticks every second (V2 P2-1)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const deadline = new Date(Date.now() + 3600_000).toISOString();
    fetchRoundsMock.mockResolvedValue([{ ...ac, deadline }]);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    renderPage();
    fireEvent.click(await screen.findByTestId('invite-round_ac'));
    expect(await screen.findByText(/Invite link copied/)).toBeInTheDocument();
    // One second at a time, as the clock ticks: a single 6s jump batches the renders and
    // let the original bug (a timer reset every tick) pass (V2 r2 P3-2).
    for (let tick = 0; tick < 6; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }
    expect(screen.queryByText(/Invite link copied/)).not.toBeInTheDocument();
  });

  it('a join that also reaches a cheaper tier celebrates once, not twice (V2 P2-2)', async () => {
    allowMotion();
    const crossed = { ...ac, myUnits: 4, unitsCount: 11, currentPrice: 700, nextTier: { threshold: 20, price: 600 } };
    fetchRoundsMock.mockResolvedValueOnce([ac]).mockResolvedValue([crossed]);
    joinRoundMock.mockResolvedValue(crossed);
    renderPage();
    fireEvent.click(await screen.findByTestId('pledge-open-round_ac'));
    fireEvent.click(screen.getByTestId('join-round_ac'));
    const first = await screen.findByTestId('celebrate');
    // The refetch brings the new tier in; the burst already playing must not restart.
    await waitFor(() => expect(fetchRoundsMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('price-round_ac')).toHaveTextContent('₹700'));
    expect(screen.getByTestId('celebrate')).toBe(first);
  });

  it('losing a tier is not celebrated — and winning it back is (V2 P2-3, M4)', async () => {
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
    act(() => {
      client.setQueryData(['rounds'], [{ ...ac, unitsCount: 3, nextTier: { threshold: 5, price: 900 } }]);
    });
    // TanStack batches cache notifications on a timer: wait for the dip to RENDER, or the
    // next write lands first and the component never sees the tier go.
    await waitFor(() => expect(screen.getByTestId('to-go-round_ac')).toHaveTextContent('this round goes ahead'));
    expect(screen.queryByTestId('celebrate')).not.toBeInTheDocument();
    act(() => {
      client.setQueryData(['rounds'], [ac]);
    });
    expect(await screen.findByTestId('celebrate')).toBeInTheDocument();
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

describe('useDeadlineClock (AC6, V2 P2-3, P3-1)', () => {
  const HOUR = 3600_000;

  it('a round days away runs no interval at all (M5)', () => {
    const setInterval = vi.spyOn(window, 'setInterval');
    const { result } = renderHook(() => useDeadlineClock(new Date(Date.now() + 5 * 24 * HOUR).toISOString()));
    expect(result.current.urgent).toBe(false);
    expect(setInterval).not.toHaveBeenCalled();
  });

  it('clears the very interval it started, on unmount (M3)', () => {
    const setInterval = vi.spyOn(window, 'setInterval');
    const clearInterval = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => useDeadlineClock(new Date(Date.now() + 2 * HOUR).toISOString()));
    expect(setInterval).toHaveBeenCalledTimes(1);
    const id = setInterval.mock.results[0].value;
    unmount();
    expect(clearInterval).toHaveBeenCalledWith(id);
  });

  it('starts ticking by itself when the last day begins on screen (P3-1)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Fixed once: computed inside the callback, the deadline moved with every render.
    const deadline = new Date(Date.now() + 24 * HOUR + 2_000).toISOString();
    const { result } = renderHook(() => useDeadlineClock(deadline));
    expect(result.current.urgent).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(result.current.urgent).toBe(true);
    const at = result.current.now;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    expect(result.current.now).toBeGreaterThan(at);
  });
});

describe('one burst per win, whichever arrives first (V2 r2 P3-1)', () => {
  it('a poll that brings the new tier in before the join responds does not restart the burst', async () => {
    allowMotion();
    const crossed = { ...ac, myUnits: 4, unitsCount: 11, currentPrice: 700, nextTier: { threshold: 20, price: 600 } };
    let respond: (round: RoundDto) => void = () => {};
    joinRoundMock.mockReturnValue(new Promise<RoundDto>((resolve) => (respond = resolve)));
    fetchRoundsMock.mockResolvedValue([ac]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <RoundsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByTestId('pledge-open-round_ac'));
    fireEvent.click(screen.getByTestId('join-round_ac'));
    // The poll lands first.
    act(() => {
      client.setQueryData(['rounds'], [crossed]);
    });
    const first = await screen.findByTestId('celebrate');
    fetchRoundsMock.mockResolvedValue([crossed]);
    await act(async () => {
      respond(crossed);
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('celebrate')).toBe(first);
  });
});

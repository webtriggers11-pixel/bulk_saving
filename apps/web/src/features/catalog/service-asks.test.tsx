import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceDto } from '@bulk/shared';
import { ServicesPage } from './ServicesPage';
import { askForService, fetchCatalog, withdrawAsk } from './catalog.api';
import { fetchRounds } from '../rounds/rounds.api';
import { ApiError } from '../../lib/api';

/**
 * FEAT-022 (ADR-0033) — "Ask for this service" on a catalog card with no open round.
 */
vi.mock('./catalog.api', () => ({ fetchCatalog: vi.fn(), askForService: vi.fn(), withdrawAsk: vi.fn() }));
vi.mock('../rounds/rounds.api', () => ({ fetchRounds: vi.fn(), joinRound: vi.fn(), updatePledge: vi.fn(), leaveRound: vi.fn() }));

const tank = (demand: ServiceDto['demand']): ServiceDto => ({
  id: 'svc_tank',
  name: 'Water Tank Cleaning',
  slug: 'tank',
  description: 'Overhead tank cleaning.',
  category: 'Utilities',
  unitLabel: 'tank',
  unitLabelPlural: 'tanks',
  unitDescription: null,
  demand,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/services']}>
        <ServicesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchRounds).mockResolvedValue([]);
});

describe('Ask for this service (FEAT-022)', () => {
  it.each([
    [{ askCount: 0, askedByMe: false }, 'be the first to ask', 'Ask for this'],
    [{ askCount: 4, askedByMe: false }, '4 neighbours asked for this', 'Ask for this'],
    [{ askCount: 1, askedByMe: true }, 'You asked — we’ll tell you when it opens', 'Asked'],
    [{ askCount: 3, askedByMe: true }, 'You and 2 neighbours asked', 'Asked'],
  ])('with %o it reads "%s" and offers "%s"', async (demand, line, button) => {
    vi.mocked(fetchCatalog).mockResolvedValue([tank(demand)]);
    renderPage();
    expect(await screen.findByTestId('service-demand')).toHaveTextContent(line);
    const ask = screen.getByTestId('ask-tank');
    expect(ask).toHaveTextContent(button);
    expect(ask).toHaveAttribute('aria-pressed', String(demand.askedByMe));
  });

  it('asking sends the ask and refreshes the catalog so the count moves', async () => {
    vi.mocked(fetchCatalog)
      .mockResolvedValueOnce([tank({ askCount: 2, askedByMe: false })])
      .mockResolvedValue([tank({ askCount: 3, askedByMe: true })]);
    vi.mocked(askForService).mockResolvedValue({ askCount: 3, askedByMe: true });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ask for this' }));
    await waitFor(() => expect(askForService).toHaveBeenCalledWith('svc_tank'));
    expect(await screen.findByText('You and 2 neighbours asked')).toBeInTheDocument();
    expect(withdrawAsk).not.toHaveBeenCalled();
  });

  it('tapping "Asked" takes the ask back', async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([tank({ askCount: 1, askedByMe: true })]);
    vi.mocked(withdrawAsk).mockResolvedValue({ askCount: 0, askedByMe: false });
    renderPage();
    fireEvent.click(await screen.findByTestId('ask-tank'));
    await waitFor(() => expect(withdrawAsk).toHaveBeenCalledWith('svc_tank'));
  });

  it('a failed ask says so, and the button works again', async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([tank({ askCount: 0, askedByMe: false })]);
    vi.mocked(askForService).mockRejectedValue(new Error('offline'));
    renderPage();
    fireEvent.click(await screen.findByTestId('ask-tank'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t send that');
    expect(screen.getByTestId('ask-tank')).not.toBeDisabled();
  });

  it('a round that opened since the page loaded: says so, and the card turns into booking (V2 P2-3)', async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([tank({ askCount: 0, askedByMe: false })]);
    vi.mocked(askForService).mockRejectedValue(new ApiError('ROUND_ALREADY_OPEN', 'open', 409));
    vi.mocked(fetchRounds)
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          id: 'round_tank',
          service: { id: 'off', name: 'Water Tank Cleaning', slug: 'tank', category: 'Utilities', unitLabel: 'tank', unitLabelPlural: 'tanks', unitDescription: null },
          status: 'OPEN',
          unitsCount: 0,
          currentPrice: 700,
          deadline: '2099-01-01T00:00:00.000Z',
          tiers: [{ threshold: 5, price: 700 }],
          myUnits: 0,
          finalPrice: null,
        },
      ]);
    renderPage();
    fireEvent.click(await screen.findByTestId('ask-tank'));
    expect(await screen.findByTestId('book-tank')).toBeInTheDocument();
    expect(screen.queryByTestId('ask-tank')).not.toBeInTheDocument();
  });

  it('a service WITH an open round offers booking, never asking', async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([tank({ askCount: 5, askedByMe: true })]);
    vi.mocked(fetchRounds).mockResolvedValue([
      {
        id: 'round_tank',
        service: { id: 'off', name: 'Water Tank Cleaning', slug: 'tank', category: 'Utilities', unitLabel: 'tank', unitLabelPlural: 'tanks', unitDescription: null },
        status: 'OPEN',
        unitsCount: 2,
        currentPrice: 700,
        deadline: '2099-01-01T00:00:00.000Z',
        tiers: [{ threshold: 5, price: 700 }],
        myUnits: 0,
        finalPrice: null,
      },
    ]);
    renderPage();
    expect(await screen.findByTestId('book-tank')).toBeInTheDocument();
    expect(screen.queryByTestId('ask-tank')).not.toBeInTheDocument();
  });
});

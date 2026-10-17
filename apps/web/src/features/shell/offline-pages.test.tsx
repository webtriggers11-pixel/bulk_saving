import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { ServicesPage } from '../catalog/ServicesPage';
import { fetchCatalog } from '../catalog/catalog.api';
import { RoundsPage } from '../rounds/RoundsPage';
import { fetchRounds, joinRound } from '../rounds/rounds.api';

vi.mock('../catalog/catalog.api', () => ({ fetchCatalog: vi.fn() }));
vi.mock('../rounds/rounds.api', () => ({
  fetchRounds: vi.fn(),
  fetchMyRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));
const fetchCatalogMock = vi.mocked(fetchCatalog);
const fetchRoundsMock = vi.mocked(fetchRounds);
const joinRoundMock = vi.mocked(joinRound);

/**
 * FEAT-008 AC7 on the path it was actually written for (V2 P1-2).
 *
 * TanStack Query v5 PAUSES a query when the browser is offline instead of
 * failing it, so `isError` is false, `isLoading` is false and `data` is
 * undefined. The original AC7 tests used `mockRejectedValue` with
 * `navigator.onLine` true — the SERVER-ERROR path — and so proved nothing about
 * being offline. This drives the real thing through `onlineManager`, and it
 * fails against a page that gates only on `isError`: the body renders its
 * heading and nothing else.
 */
function renderServices() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/services']}>
        <ServicesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('a data page on an offline cold load', () => {
  beforeEach(() => {
    fetchCatalogMock.mockReset();
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    onlineManager.setOnline(false);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    vi.clearAllMocks();
  });

  it('tells the resident it is offline and offers Retry — never a bare heading', async () => {
    fetchCatalogMock.mockResolvedValue([]);
    renderServices();

    const alert = await screen.findByTestId('query-error');
    expect(alert).toHaveAttribute('data-mode', 'offline-empty');
    expect(alert).toHaveTextContent(/You're offline/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // The query never even ran: it is paused, not failed.
    expect(fetchCatalogMock).not.toHaveBeenCalled();
  });

  it('does not also show the empty state, which would read as "there are none"', async () => {
    fetchCatalogMock.mockResolvedValue([]);
    renderServices();

    await screen.findByTestId('query-error');
    expect(screen.queryByTestId('catalog-empty')).not.toBeInTheDocument();
  });

  it('recovers on reconnect without a reload', async () => {
    fetchCatalogMock.mockResolvedValue([]);
    renderServices();
    await screen.findByTestId('query-error');

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    onlineManager.setOnline(true);

    await waitFor(() => expect(fetchCatalogMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('query-error')).not.toBeInTheDocument());
  });
});

/**
 * The mutation-side twin of the same v5 behaviour: an offline mutation is
 * PAUSED, not rejected — `isPending` stays true and nothing errors — so a
 * submit button reads "Joining…" forever unless the page checks `isPaused`.
 */
describe('a pledge submitted while offline', () => {
  beforeEach(() => {
    fetchRoundsMock.mockReset();
    joinRoundMock.mockReset();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    vi.clearAllMocks();
  });

  it('says it will send on reconnect instead of spinning silently', async () => {
    fetchRoundsMock.mockResolvedValue([
      {
        id: 'round_1',
        service: { id: 'svc_1', name: 'AC Servicing', slug: 'ac-servicing', category: 'Appliances', unitLabel: 'AC unit', unitLabelPlural: 'AC units', unitDescription: null },
        status: 'OPEN',
        unitsCount: 6,
        currentPrice: 900,
        deadline: '2099-01-01T12:00:00.000Z',
        tiers: [{ threshold: 5, price: 900 }],
        myUnits: 0,
        finalPrice: null,
      },
    ]);
    joinRoundMock.mockResolvedValue({} as never);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/rounds']}>
          <RoundsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const joinButton = await screen.findByRole('button', { name: 'Join' });

    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    onlineManager.setOnline(false);
    fireEvent.click(joinButton);

    const notice = await screen.findByTestId('pledge-paused');
    expect(notice).toHaveTextContent(/as soon as you reconnect/i);
    expect(joinRoundMock).not.toHaveBeenCalled();

    // It really does resume — that is why the copy promises it.
    onlineManager.setOnline(true);
    await waitFor(() => expect(joinRoundMock).toHaveBeenCalledTimes(1));
  });
});

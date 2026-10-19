import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundDto, ServiceDto } from '@bulk/shared';
import { ServicesPage } from './ServicesPage';
import { RoundsPage } from '../rounds/RoundsPage';
import { fetchCatalog } from './catalog.api';
import { fetchRounds } from '../rounds/rounds.api';
import { page, pagedData } from '../../test/page';

/**
 * FEAT-021 — from a service to booking it in one tap: the catalog says whether a service
 * can be booked now and links to its round; `/rounds?join=<id>` opens that round's sheet.
 */
vi.mock('./catalog.api', () => ({ fetchCatalog: vi.fn() }));
vi.mock('../rounds/rounds.api', () => ({
  fetchRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));

const ac: ServiceDto = {
  id: 'svc_ac',
  name: 'AC Servicing',
  slug: 'ac-servicing',
  description: 'Split & window AC cleaning.',
  category: 'Appliances',
  indicativePrice: 499,
  unitLabel: 'AC unit',
  unitLabelPlural: 'AC units',
  unitDescription: null,
  demand: { askCount: 0, askedByMe: false },
};
const paint: ServiceDto = { ...ac, id: 'svc_paint', name: 'Painting', slug: 'painting', unitLabel: 'room', unitLabelPlural: 'rooms' };

const acRound: RoundDto = {
  id: 'round_ac',
  service: { id: 'off_ac', name: 'AC Servicing', slug: 'ac-servicing', category: 'Appliances', unitLabel: 'AC unit', unitLabelPlural: 'AC units', unitDescription: null },
  status: 'OPEN',
  unitsCount: 7,
  currentPrice: 900,
  nextTier: { threshold: 10, price: 700 },
  deadline: '2099-01-01T00:00:00.000Z',
  tiers: [
    { threshold: 5, price: 900 },
    { threshold: 10, price: 700 },
  ],
  myUnits: 0,
  finalPrice: null,
};

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

let go: (to: string) => void = () => {};
function Nav() {
  go = useNavigate();
  return null;
}

function renderApp(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/rounds" element={<RoundsPage />} />
        </Routes>
        <Where />
        <Nav />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

beforeEach(() => {
  vi.mocked(fetchCatalog).mockReset().mockResolvedValue(page([ac, paint]));
  vi.mocked(fetchRounds).mockReset().mockResolvedValue(page([acRound]));
});

describe('the catalog says whether a service can be booked now (AC1, AC2)', () => {
  it('a service with an open round shows it, and the whole card books it', async () => {
    renderApp('/services');
    const link = await screen.findByTestId('book-ac-servicing');
    expect(link).toHaveAttribute('href', '/rounds?join=round_ac');
    // Named by its content: the service and the round facts, not a generic label.
    expect(link).toHaveAccessibleName(/AC Servicing.*Group buy open · 7 AC units in · ₹900 now/);
  });

  it('a service with no open round says so, and is not a link', async () => {
    renderApp('/services');
    await screen.findByTestId('book-ac-servicing');
    expect(screen.queryByTestId('book-painting')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('service-no-round')).toHaveLength(1);
  });

  it('says nothing about rounds until they have loaded — never a wrong "none open"', async () => {
    vi.mocked(fetchRounds).mockReturnValue(new Promise(() => {}));
    renderApp('/services');
    await screen.findAllByTestId('service-card');
    expect(screen.queryByTestId('service-no-round')).not.toBeInTheDocument();
    expect(screen.queryByTestId('service-round')).not.toBeInTheDocument();
  });
});

describe('/rounds?join=<id> lands on the pledge sheet (AC3, AC4)', () => {
  it('tapping a bookable service opens that round, ready to join', async () => {
    renderApp('/services');
    fireEvent.click(await screen.findByTestId('book-ac-servicing'));
    expect(await screen.findByRole('dialog', { name: 'Join AC Servicing' })).toBeInTheDocument();
    expect(document.getElementById('round-round_ac')?.className).toMatch(/\bround-requested\b/);
  });

  it('drops the param once used, so back and refresh do not reopen the sheet', async () => {
    renderApp('/rounds?join=round_ac');
    await screen.findByRole('dialog', { name: 'Join AC Servicing' });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/rounds$/));
  });

  it('a link to a round that has closed says so, and shows what is open', async () => {
    renderApp('/rounds?join=round_gone');
    expect(await screen.findByTestId('join-gone')).toHaveTextContent('has closed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('round-card')).toBeInTheDocument();
  });

  it('without the param, nothing opens and nothing is highlighted', async () => {
    renderApp('/rounds');
    await screen.findByTestId('round-card');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('join-gone')).not.toBeInTheDocument();
    expect(document.querySelector('.round-requested')).toBeNull();
  });
});

describe('the arrival scroll (V2 P1, P2)', () => {
  const scroll = vi.fn();
  beforeEach(() => {
    scroll.mockReset();
    Element.prototype.scrollIntoView = scroll;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scrolls to the requested round once — a later refetch does not drag the page back', async () => {
    const { client } = renderApp('/rounds?join=round_ac');
    await screen.findByRole('dialog', { name: 'Join AC Servicing' });
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    // Two polls that move the count: new `data` references each time.
    act(() => client.setQueryData(['rounds'], pagedData([{ ...acRound, unitsCount: 8 }])));
    await waitFor(() => expect(screen.getByTestId('units-count-round_ac')).toHaveTextContent('8 AC units pledged'));
    act(() => client.setQueryData(['rounds'], pagedData([{ ...acRound, unitsCount: 9 }])));
    await new Promise((r) => setTimeout(r, 50));
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('jumps instead of gliding under reduced motion', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    renderApp('/rounds?join=round_ac');
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' }));
  });

  it('a second request while on the page is honoured too', async () => {
    const other = { ...acRound, id: 'round_two', service: { ...acRound.service, slug: 'ac-2', name: 'Deep Clean' } };
    vi.mocked(fetchRounds).mockResolvedValue(page([acRound, other]));
    renderApp('/rounds?join=round_ac');
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    // Close the first sheet, then ask for another round from inside the page.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    act(() => go('/rounds?join=round_two'));
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(2));
    expect(document.getElementById('round-round_two')?.className).toMatch(/\bround-requested\b/);
    expect(await screen.findByRole('dialog', { name: 'Join Deep Clean' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/rounds$/));
  });

  it('asking for the same round again scrolls again and clears the param (V2 r2 P3)', async () => {
    renderApp('/rounds?join=round_ac');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/rounds$/));
    act(() => go('/rounds?join=round_ac'));
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/rounds$/));
  });
});

describe('a round you are already in (V2 P3)', () => {
  it('the catalog says you are in, not that you can join', async () => {
    vi.mocked(fetchRounds).mockResolvedValue(page([{ ...acRound, myUnits: 3 }]));
    renderApp('/services');
    expect(await screen.findByTestId('service-round')).toHaveTextContent('You’re in with 3 AC units · ₹900 now');
  });
});

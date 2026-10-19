import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundDto, ServiceDto } from '@bulk/shared';
import { ServicesPage } from './ServicesPage';
import { RoundsPage } from '../rounds/RoundsPage';
import { fetchCatalog } from './catalog.api';
import { fetchRounds } from '../rounds/rounds.api';

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

function renderApp(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/rounds" element={<RoundsPage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(fetchCatalog).mockReset().mockResolvedValue([ac, paint]);
  vi.mocked(fetchRounds).mockReset().mockResolvedValue([acRound]);
});

describe('the catalog says whether a service can be booked now (AC1, AC2)', () => {
  it('a service with an open round shows it, and the whole card books it', async () => {
    renderApp('/services');
    const link = await screen.findByTestId('book-ac-servicing');
    expect(link).toHaveAttribute('href', '/rounds?join=round_ac');
    expect(link).toHaveAccessibleName('Book AC Servicing — join the open group buy');
    expect(link).toHaveTextContent('Group buy open · ₹900 now · 7 AC units in');
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

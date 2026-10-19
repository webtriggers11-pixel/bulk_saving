import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundDto } from '@bulk/shared';
import { fetchRounds } from '../rounds/rounds.api';
import { GroupBuysLead } from './GroupBuysLead';
import { signIn, signOutAfterTest } from '../../test/session';

vi.mock('../rounds/rounds.api', () => ({
  fetchRounds: vi.fn(),
  fetchMyRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));
const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});
const fetchRoundsMock = vi.mocked(fetchRounds);

const DAY = 24 * 60 * 60 * 1000;
function round(id: string, name: string, daysLeft: number, myUnits = 0, unitLabel = 'flat'): RoundDto {
  return {
    id,
    service: { id: `s_${id}`, name, slug: id, category: 'Home Care', unitLabel, unitLabelPlural: `${unitLabel}s`, unitDescription: null },
    status: 'OPEN',
    unitsCount: 4,
    currentPrice: 900,
    nextTier: { threshold: 10, price: 700 },
    deadline: new Date(Date.now() + daysLeft * DAY).toISOString(),
    tiers: [
      { threshold: 5, price: 900 },
      { threshold: 10, price: 700 },
    ],
    myUnits,
    finalPrice: null,
  };
}

function renderLead() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GroupBuysLead />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GroupBuysLead (FEAT-023)', () => {
  beforeEach(() => {
    navigate.mockClear();
    fetchRoundsMock.mockReset();
    signIn();
  });

  afterEach(() => {
    signOutAfterTest();
  });

  it('leads with the live counts and up to three rounds, soonest-closing first', async () => {
    fetchRoundsMock.mockResolvedValue([
      round('paint', 'Painting', 9),
      round('tank', 'Water Tank Cleaning', 1.5, 2, 'tank'),
      round('pest', 'Pest Control', 3, 1),
      round('ac', 'AC Servicing', 5),
    ]);
    renderLead();

    expect(await screen.findByText('4 open in your society')).toBeInTheDocument();
    expect(screen.getByTestId('group-buys-line')).toHaveTextContent("You're in 2 of them.");

    const rows = within(screen.getByTestId('group-buys-rows')).getAllByRole('button');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Water Tank Cleaning'),
      expect.stringContaining('Pest Control'),
      expect.stringContaining('AC Servicing'),
    ]);
    // Price per unit in the service's own word; "You're in" only where it is true.
    expect(rows[0]).toHaveTextContent('₹900 / tank');
    expect(rows[0]).toHaveTextContent('Closes in 1 day');
    expect(screen.getByTestId('group-buys-in-tank')).toBeInTheDocument();
    expect(screen.queryByTestId('group-buys-in-ac')).not.toBeInTheDocument();
    // The fourth is behind the tab, and the button says how many there are.
    expect(screen.queryByText('Painting')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /See all 4 group buys/ })).toBeInTheDocument();
  });

  it('a row deep-links into that round’s pledge sheet (FEAT-021)', async () => {
    fetchRoundsMock.mockResolvedValue([round('pest', 'Pest Control', 3)]);
    renderLead();
    fireEvent.click(await screen.findByTestId('group-buys-row-pest'));
    expect(navigate).toHaveBeenCalledWith('/rounds?join=pest');

    fireEvent.click(screen.getByRole('button', { name: /See group buys/ }));
    expect(navigate).toHaveBeenCalledWith('/rounds');
  });

  it('says so plainly when nothing is open, and points at Services', async () => {
    fetchRoundsMock.mockResolvedValue([]);
    renderLead();
    expect(await screen.findByText('Nothing open right now')).toBeInTheDocument();
    expect(screen.queryByTestId('group-buys-rows')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ask for a service/ }));
    expect(navigate).toHaveBeenCalledWith('/services');
  });

  it('never blanks Home when the rounds query fails — the way in stays', async () => {
    fetchRoundsMock.mockRejectedValue(new Error('down'));
    renderLead();
    expect(await screen.findByText(/Could not check just now/)).toBeInTheDocument();
    expect(screen.getByTestId('group-buys-title')).toHaveTextContent('Open in your society');
    expect(screen.getByRole('button', { name: /See group buys/ })).toBeInTheDocument();
  });
});

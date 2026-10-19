import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceDto } from '@bulk/shared';
import { ServicesPage } from './ServicesPage';
import * as catalogApi from './catalog.api';
import { page } from '../../test/page';

const services: ServiceDto[] = [
  {
    id: 'svc_1',
    name: 'AC Servicing',
    slug: 'ac-servicing',
    description: 'Split & window AC cleaning.',
    category: 'Appliances',
    indicativePrice: 499,
    unitLabel: 'AC unit',
    unitLabelPlural: 'AC units',
    unitDescription: null,
    demand: { askCount: 0, askedByMe: false },
  },
  {
    id: 'svc_2',
    name: 'Painting',
    slug: 'painting',
    description: 'Interior wall painting.',
    category: 'Renovation',
    indicativePrice: 3500,
    unitLabel: 'room',
    unitLabelPlural: 'rooms',
    unitDescription: 'One room up to 12x12 ft: walls only.',
    demand: { askCount: 0, askedByMe: false },
  },
];

function renderPage(url = '/services') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <ServicesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ServicesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the society services from the API with names and formatted price', async () => {
    vi.spyOn(catalogApi, 'fetchCatalog').mockResolvedValue(page(services));
    renderPage();

    await waitFor(() => expect(screen.getByText('AC Servicing')).toBeInTheDocument());
    expect(screen.getByText('Painting')).toBeInTheDocument();
    // Scoped to the list: the category chips above it say 'Appliances' too.
    expect(within(screen.getByRole('region', { name: 'Available services' })).getByText('Appliances')).toBeInTheDocument();

    // Indicative price formatted in ₹ (Indian locale, no decimals).
    expect(screen.getByText(/From ₹499/)).toBeInTheDocument();
    // FEAT-010 / V2 P1-C: the price is per unit, so it must name the unit — and
    // Painting is priced per ROOM (it was 15000 per flat before the unit was defined).
    expect(screen.getByText('From ₹3,500 / room')).toBeInTheDocument();
    expect(screen.getByTestId('service-unit-scope')).toHaveTextContent('walls only');

    expect(screen.getAllByTestId('service-card')).toHaveLength(2);
    expect(screen.queryByTestId('catalog-empty')).not.toBeInTheDocument();
  });

  it('renders the empty state when the API returns no services', async () => {
    vi.spyOn(catalogApi, 'fetchCatalog').mockResolvedValue(page([]));
    renderPage();

    await waitFor(() => expect(screen.getByTestId('catalog-empty')).toBeInTheDocument());
    expect(screen.getByText('No services yet')).toBeInTheDocument();
    expect(screen.queryByTestId('service-card')).not.toBeInTheDocument();
  });

  it('renders an error state when the API call fails', async () => {
    vi.spyOn(catalogApi, 'fetchCatalog').mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load/i);
  });

  describe('search and categories (FEAT-015)', () => {
    it('sends the URL’s filters to the server and shows them in the controls', async () => {
      const spy = vi.spyOn(catalogApi, 'fetchCatalog').mockResolvedValue(page(services));
      renderPage('/services?q=ac&category=Appliances');

      await screen.findByText('AC Servicing');
      expect(spy).toHaveBeenLastCalledWith({ q: 'ac', category: 'Appliances' });
      expect(screen.getByRole('searchbox', { name: 'Search services' })).toHaveValue('ac');
      expect(screen.getByRole('radio', { name: 'Appliances' })).toHaveAttribute('aria-checked', 'true');
    });

    it('filters by category from a chip', async () => {
      const spy = vi.spyOn(catalogApi, 'fetchCatalog').mockResolvedValue(page(services));
      renderPage();
      await screen.findByText('AC Servicing');

      fireEvent.click(screen.getByRole('radio', { name: 'Bulk Staples' }));
      await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ q: undefined, category: 'Bulk Staples' }));
    });

    it('a search that finds nothing is not "no services yet" — and offers everything back', async () => {
      vi.spyOn(catalogApi, 'fetchCatalog').mockResolvedValue(page([]));
      renderPage('/services?q=zzz');

      const noMatch = await screen.findByTestId('catalog-no-match');
      expect(screen.queryByTestId('catalog-empty')).not.toBeInTheDocument();
      vi.spyOn(catalogApi, 'fetchCatalog').mockResolvedValue(page(services));
      fireEvent.click(within(noMatch).getByRole('button', { name: 'Show all services' }));
      expect(await screen.findByText('AC Servicing')).toBeInTheDocument();
      expect(screen.getByRole('searchbox', { name: 'Search services' })).toHaveValue('');
    });

    it('keeps the unfiltered page quiet — no result count until a filter is set', async () => {
      vi.spyOn(catalogApi, 'fetchCatalog').mockResolvedValue(page(services));
      renderPage();
      await screen.findByText('AC Servicing');
      expect(screen.queryByText(/match$/)).not.toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceDto } from '@bulk/shared';
import { ServicesPage } from './ServicesPage';
import * as catalogApi from './catalog.api';

const services: ServiceDto[] = [
  {
    id: 'svc_1',
    name: 'AC Servicing',
    slug: 'ac-servicing',
    description: 'Split & window AC cleaning.',
    category: 'Appliances',
    indicativePrice: 499,
  },
  {
    id: 'svc_2',
    name: 'Painting',
    slug: 'painting',
    description: 'Interior wall painting.',
    category: 'Renovation',
    indicativePrice: 15000,
  },
];

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

describe('ServicesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the society services from the API with names and formatted price', async () => {
    vi.spyOn(catalogApi, 'fetchCatalog').mockResolvedValue(services);
    renderPage();

    await waitFor(() => expect(screen.getByText('AC Servicing')).toBeInTheDocument());
    expect(screen.getByText('Painting')).toBeInTheDocument();
    expect(screen.getByText('Appliances')).toBeInTheDocument();

    // Indicative price formatted in ₹ (Indian locale, no decimals).
    expect(screen.getByText(/From ₹499/)).toBeInTheDocument();
    expect(screen.getByText(/From ₹15,000/)).toBeInTheDocument();

    expect(screen.getAllByTestId('service-card')).toHaveLength(2);
    expect(screen.queryByTestId('catalog-empty')).not.toBeInTheDocument();
  });

  it('renders the empty state when the API returns no services', async () => {
    vi.spyOn(catalogApi, 'fetchCatalog').mockResolvedValue([]);
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
});

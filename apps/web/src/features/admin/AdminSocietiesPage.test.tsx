import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSocietyDetailDto } from '@bulk/shared';
import { createSociety, fetchSocieties } from './admin.api';
import { AdminSocietiesPage, validateSocietyForm } from './AdminSocietiesPage';

vi.mock('./admin.api', () => ({
  fetchSocieties: vi.fn(),
  fetchSociety: vi.fn(),
  createSociety: vi.fn(),
  updateSociety: vi.fn(),
  rotateInviteCode: vi.fn(),
  deleteSociety: vi.fn(),
}));

const lakeview: AdminSocietyDetailDto = {
  id: 'soc_lake',
  name: 'Lakeview',
  city: 'Pune',
  inviteCode: 'AB23CD45',
  residentCount: 12,
  roundCount: 2,
  createdAt: '2026-11-22T08:00:00.000Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/societies']}>
        <Routes>
          <Route path="/admin/societies" element={<AdminSocietiesPage />} />
          <Route path="/admin/societies/:id" element={<p>society page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminSocietiesPage (FEAT-032)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists every society with its city, resident count and spaced invite code, linking to its page', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue([lakeview]);
    renderPage();
    const row = await screen.findByTestId('society-row');
    expect(row).toHaveTextContent('Lakeview');
    expect(row).toHaveTextContent('Pune · 12 residents');
    expect(screen.getByTestId('society-code')).toHaveTextContent('AB23 CD45');
    expect(row.querySelector('a')).toHaveAttribute('href', '/admin/societies/soc_lake');
  });

  it('an empty list says how to start', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No societies yet')).toBeInTheDocument();
  });

  it('creates a society with trimmed fields and opens its page', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue([]);
    vi.mocked(createSociety).mockResolvedValue(lakeview);
    renderPage();
    fireEvent.change(screen.getByLabelText('Society name'), { target: { value: '  Lakeview ' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Pune ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create society' }));
    await waitFor(() => expect(createSociety).toHaveBeenCalledWith({ name: 'Lakeview', city: 'Pune' }, expect.anything()));
    expect(await screen.findByText('society page')).toBeInTheDocument();
  });

  it('refuses a blank form without calling the API', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue([]);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Create society' }));
    expect(await screen.findByText('Enter the society name.')).toBeInTheDocument();
    expect(screen.getByText('Enter the city.')).toBeInTheDocument();
    expect(createSociety).not.toHaveBeenCalled();
  });

  it('validateSocietyForm mirrors the API limits', () => {
    expect(validateSocietyForm({ name: 'Ok', city: 'Ab' })).toEqual({});
    expect(validateSocietyForm({ name: 'x'.repeat(81), city: 'y'.repeat(61) })).toEqual({
      name: 'Keep the name under 80 characters.',
      city: 'Keep the city under 60 characters.',
    });
  });
});

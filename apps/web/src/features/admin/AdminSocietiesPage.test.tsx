import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSocietyDetailDto } from '@bulk/shared';
import { createSociety, fetchSocieties } from './admin.api';
import { AdminSocietiesPage, validateSocietyForm } from './AdminSocietiesPage';
import { page } from '../../test/page';

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
  addressLine1: 'Plot 12, Baner Road',
  addressLine2: 'Baner',
  landmark: null,
  state: 'Maharashtra',
  pincode: '411045',
  contactPhone: null,
  active: true,
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
    vi.mocked(fetchSocieties).mockResolvedValue(page([lakeview]));
    renderPage();
    const row = await screen.findByTestId('society-row');
    expect(row).toHaveTextContent('Lakeview');
    expect(row).toHaveTextContent('Pune · 12 residents');
    expect(screen.getByTestId('society-code')).toHaveTextContent('AB23 CD45');
    expect(row.querySelector('a')).toHaveAttribute('href', '/admin/societies/soc_lake');
  });

  it('an empty list says how to start', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText('No societies yet')).toBeInTheDocument();
  });

  it('creates a society with trimmed fields and opens its page', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue(page([]));
    vi.mocked(createSociety).mockResolvedValue(lakeview);
    renderPage();
    fireEvent.change(screen.getByLabelText('Society name'), { target: { value: '  Lakeview ' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Pune ' } });
    fireEvent.change(screen.getByLabelText('Building and street'), { target: { value: ' Plot 12, Baner Road ' } });
    fireEvent.change(screen.getByLabelText(/Area \/ locality/), { target: { value: '  ' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'Maharashtra' } });
    fireEvent.change(screen.getByLabelText('PIN code'), { target: { value: '411 045x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create society' }));
    await waitFor(() =>
      expect(createSociety).toHaveBeenCalledWith(
        {
          name: 'Lakeview',
          city: 'Pune',
          addressLine1: 'Plot 12, Baner Road',
          addressLine2: null,
          landmark: null,
          state: 'Maharashtra',
          pincode: '411045',
          contactPhone: null,
        },
        expect.anything(),
      ),
    );
    expect(await screen.findByText('society page')).toBeInTheDocument();
  });

  it('refuses a blank form without calling the API', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue(page([]));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Create society' }));
    expect(await screen.findByText('Enter the society name.')).toBeInTheDocument();
    expect(screen.getByText('Enter the city.')).toBeInTheDocument();
    expect(screen.getByText('Enter the building and street.')).toBeInTheDocument();
    expect(screen.getByText('Choose the state.')).toBeInTheDocument();
    expect(screen.getByText('Enter the 6-digit PIN code.')).toBeInTheDocument();
    // The phone is optional: an empty one is not an error.
    expect(screen.queryByText(/10-digit mobile/)).toBeNull();
    expect(createSociety).not.toHaveBeenCalled();
  });

  const VALID = {
    name: 'Ok',
    city: 'Ab',
    addressLine1: 'Plot 1',
    addressLine2: '',
    landmark: '',
    state: 'Goa',
    pincode: '403001',
    phoneDigits: '',
  };

  it('validateSocietyForm mirrors the API limits (FEAT-043: address required, phone optional)', () => {
    expect(validateSocietyForm(VALID)).toEqual({});
    expect(validateSocietyForm({ ...VALID, phoneDigits: '9876543210' })).toEqual({});
    expect(validateSocietyForm({ ...VALID, name: 'x'.repeat(81), city: 'y'.repeat(61) })).toEqual({
      name: 'Keep the name under 80 characters.',
      city: 'Keep the city under 60 characters.',
    });
    expect(
      validateSocietyForm({ ...VALID, addressLine1: ' a ', state: 'Atlantis', pincode: '012345', phoneDigits: '12345', landmark: 'z'.repeat(81) }),
    ).toEqual({
      addressLine1: 'Enter the building and street.',
      state: 'Choose the state.',
      pincode: 'Enter the 6-digit PIN code.',
      phoneDigits: 'Enter a 10-digit mobile number, or leave it empty.',
      landmark: 'Keep it under 80 characters.',
    });
  });

  it('sends a given contact phone in its canonical +91 form', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue(page([]));
    vi.mocked(createSociety).mockResolvedValue(lakeview);
    renderPage();
    fireEvent.change(screen.getByLabelText('Society name'), { target: { value: 'Lakeview' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Pune' } });
    fireEvent.change(screen.getByLabelText('Building and street'), { target: { value: 'Plot 12' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'Maharashtra' } });
    fireEvent.change(screen.getByLabelText('PIN code'), { target: { value: '411045' } });
    fireEvent.change(screen.getByLabelText(/Contact phone/), { target: { value: '98765 43210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create society' }));
    await waitFor(() =>
      expect(createSociety).toHaveBeenCalledWith(expect.objectContaining({ contactPhone: '+919876543210' }), expect.anything()),
    );
  });

  it('marks a society that has no address yet in the list', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue(page([
      lakeview,
      { ...lakeview, id: 'soc_old', name: 'Old Towers', addressLine1: null, state: null, pincode: null },
    ]));
    renderPage();
    const rows = await screen.findAllByTestId('society-row');
    expect(rows).toHaveLength(2);
    expect(screen.getAllByTestId('society-no-address')).toHaveLength(1);
    expect(rows[1]).toHaveTextContent('No address');
  });

  it('searches societies on the server and pages with Show more (FEAT-044)', async () => {
    vi.mocked(fetchSocieties)
      .mockResolvedValueOnce(page([lakeview], { nextCursor: 'soc_lake', total: 2 }))
      .mockResolvedValueOnce(page([{ ...lakeview, id: 'soc_2', name: 'Maple Court' }], { nextCursor: null, total: 2 }))
      .mockResolvedValue(page([lakeview], { total: 1 }));
    renderPage();
    expect(await screen.findAllByTestId('society-row')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Show 1 more society/ }));
    expect(await screen.findByText('Maple Court')).toBeInTheDocument();
    expect(vi.mocked(fetchSocieties).mock.calls[1][0]).toMatchObject({ cursor: 'soc_lake' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search societies' }), { target: { value: 'Pune' } });
    await waitFor(() => expect(vi.mocked(fetchSocieties)).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Pune' })), { timeout: 2000 });
  });
});

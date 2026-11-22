import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSocietyDetailDto } from '@bulk/shared';
import { deleteSociety, fetchSociety, rotateInviteCode, updateSociety } from './admin.api';
import { AdminSocietyDetailPage } from './AdminSocietyDetailPage';

vi.mock('./admin.api', () => ({
  fetchSocieties: vi.fn(),
  fetchSociety: vi.fn(),
  createSociety: vi.fn(),
  updateSociety: vi.fn(),
  rotateInviteCode: vi.fn(),
  deleteSociety: vi.fn(),
}));

const empty: AdminSocietyDetailDto = {
  id: 'soc_lake',
  name: 'Lakeview',
  city: 'Pune',
  inviteCode: 'AB23CD45',
  active: true,
  residentCount: 0,
  roundCount: 0,
  createdAt: '2026-11-22T08:00:00.000Z',
};
const occupied: AdminSocietyDetailDto = { ...empty, residentCount: 12, roundCount: 2 };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/societies/soc_lake']}>
        <Routes>
          <Route path="/admin/societies/:id" element={<AdminSocietyDetailPage />} />
          <Route path="/admin/societies" element={<p>societies list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const origin = window.location.origin;

describe('AdminSocietyDetailPage (FEAT-032)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('shows the code, the join link, a QR code of that link, and a print button', async () => {
    vi.mocked(fetchSociety).mockResolvedValue(occupied);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderPage();
    expect(await screen.findByTestId('society-invite-code')).toHaveTextContent('AB23 CD45');
    expect(screen.getByTestId('society-join-link')).toHaveTextContent(`${origin}/onboard?code=AB23CD45`);
    const qr = await screen.findByTestId('society-qr');
    expect(qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(qr).toHaveAttribute('alt', `QR code that opens ${origin}/onboard?code=AB23CD45`);
    fireEvent.click(screen.getByTestId('print-poster'));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it('the print-only poster carries the society name and the code', async () => {
    vi.mocked(fetchSociety).mockResolvedValue(occupied);
    const { container } = renderPage();
    await screen.findByTestId('society-invite-code');
    const poster = container.querySelector('[data-print-poster]');
    expect(poster).not.toBeNull();
    expect(poster?.className).toContain('hidden');
    expect(poster?.className).toContain('print:flex');
    // V2 P1: its own ink, so dark mode does not print white text on white paper.
    expect(poster?.className).toContain('print:text-black');
    expect(poster).toHaveTextContent('Lakeview');
    expect(poster).toHaveTextContent('AB23 CD45');
  });

  it('the invitation names the society, carries link and code; Copy, WhatsApp and Share work', async () => {
    vi.mocked(fetchSociety).mockResolvedValue(occupied);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText }, share });
    renderPage();
    const message = await screen.findByTestId('invitation-message');
    expect(message).toHaveTextContent('Lakeview');
    expect(message).toHaveTextContent(`${origin}/onboard?code=AB23CD45`);

    fireEvent.click(screen.getByTestId('copy-message'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('AB23CD45')));
    expect(await within(screen.getByTestId('copy-message')).findByText(/Copied/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('copy-code'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('AB23CD45'));

    const wa = screen.getByTestId('whatsapp-message');
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(wa.getAttribute('href')!.split('text=')[1])).toContain('AB23CD45');
    expect(wa).toHaveAttribute('target', '_blank');

    fireEvent.click(screen.getByTestId('share-message'));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Lakeview') })));
  });

  it('a browser without the Web Share API gets no Share button', async () => {
    vi.mocked(fetchSociety).mockResolvedValue(occupied);
    vi.stubGlobal('navigator', { ...navigator, share: undefined });
    renderPage();
    await screen.findByTestId('invitation-message');
    expect(screen.queryByTestId('share-message')).not.toBeInTheDocument();
  });

  it('rotating the code asks first, then shows the new code', async () => {
    vi.mocked(fetchSociety).mockResolvedValue(occupied);
    vi.mocked(rotateInviteCode).mockResolvedValue({ ...occupied, inviteCode: 'ZZ23YY45' });
    renderPage();
    fireEvent.click(await screen.findByTestId('rotate-code'));
    expect(rotateInviteCode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, new code' }));
    await waitFor(() => expect(screen.getByTestId('society-invite-code')).toHaveTextContent('ZZ23 YY45'));
  });

  it('delete is off while residents exist, and says why', async () => {
    vi.mocked(fetchSociety).mockResolvedValue(occupied);
    renderPage();
    expect(await screen.findByTestId('delete-society')).toBeDisabled();
    expect(screen.getByTestId('delete-reason')).toHaveTextContent('12 resident(s) and 2 round(s)');
  });

  it('an empty society can be deleted after confirming; we land back on the list', async () => {
    vi.mocked(fetchSociety).mockResolvedValue(empty);
    vi.mocked(deleteSociety).mockResolvedValue({ deleted: true });
    renderPage();
    fireEvent.click(await screen.findByTestId('delete-society'));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(await screen.findByText('societies list')).toBeInTheDocument();
    expect(deleteSociety).toHaveBeenCalledWith('soc_lake');
  });

  it('edits the name and city', async () => {
    vi.mocked(fetchSociety).mockResolvedValue(occupied);
    vi.mocked(updateSociety).mockResolvedValue({ ...occupied, name: 'Lakeview Towers' });
    renderPage();
    const name = await screen.findByLabelText('Society name');
    expect(screen.getByRole('button', { name: 'Save details' })).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Lakeview Towers ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    });
    expect(updateSociety).toHaveBeenCalledWith('soc_lake', { name: 'Lakeview Towers', city: 'Pune' });
  });

  it('the Active switch turns the society off and back on (FEAT-035)', async () => {
    vi.mocked(fetchSociety).mockResolvedValue(occupied);
    vi.mocked(updateSociety).mockResolvedValue({ ...occupied, active: false });
    renderPage();
    fireEvent.click(await screen.findByRole('switch', { name: 'Society active' }));
    await waitFor(() => expect(updateSociety).toHaveBeenCalledWith('soc_lake', { active: false }));
  });
});

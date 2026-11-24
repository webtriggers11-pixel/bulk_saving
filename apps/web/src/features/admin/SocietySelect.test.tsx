import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSocietyDetailDto } from '@bulk/shared';
import { fetchSocieties, fetchSociety } from './admin.api';
import { society } from './admin.fixtures';
import { LOAD_MORE, SOCIETY_PICKER_PAGE, SocietySelect } from './SocietySelect';
import { page } from '../../test/page';

vi.mock('./admin.api', () => ({ fetchSocieties: vi.fn(), fetchSociety: vi.fn() }));

const named = (n: number): AdminSocietyDetailDto => ({ ...society, id: `soc_${n}`, name: `Society ${String(n).padStart(3, '0')}` });

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SocietySelect id="pick" value={value} onChange={setValue} emptyLabel="All societies" />
      <output data-testid="chosen">{value}</output>
    </>
  );
}

function renderPicker(initial?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness initial={initial} />
    </QueryClientProvider>,
  );
}

describe('SocietySelect (FEAT-044)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a few societies: a plain select, no search box, no "show more"', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue(page([named(1), named(2)]));
    renderPicker();
    expect(await screen.findByRole('option', { name: 'Society 002' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Search societies' })).toBeNull();
    expect(screen.queryByRole('option', { name: /Show more/ })).toBeNull();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'soc_2' } });
    expect(screen.getByTestId('chosen')).toHaveTextContent('soc_2');
    expect(vi.mocked(fetchSocieties).mock.calls[0][0]).toMatchObject({ limit: SOCIETY_PICKER_PAGE });
  });

  it('many societies: a search box, and "Show more" loads the next page instead of choosing it', async () => {
    const first = Array.from({ length: 50 }, (_, i) => named(i + 1));
    vi.mocked(fetchSocieties)
      .mockResolvedValueOnce(page(first, { nextCursor: 'soc_50', total: 120 }))
      .mockResolvedValueOnce(page([named(51)], { nextCursor: null, total: 120 }));
    renderPicker();
    expect(await screen.findByRole('searchbox', { name: 'Search societies' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Show more societies (70 more)…' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: LOAD_MORE } });
    expect(screen.getByTestId('chosen')).toHaveTextContent('');
    expect(await screen.findByRole('option', { name: 'Society 051' })).toBeInTheDocument();
    expect(vi.mocked(fetchSocieties).mock.calls[1][0]).toMatchObject({ cursor: 'soc_50' });
  });

  it('search goes to the server (debounced) with q', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const first = Array.from({ length: 50 }, (_, i) => named(i + 1));
      vi.mocked(fetchSocieties).mockResolvedValueOnce(page(first, { nextCursor: 'soc_50', total: 120 })).mockResolvedValue(page([named(7)], { total: 1 }));
      renderPicker();
      const box = await screen.findByRole('searchbox', { name: 'Search societies' });
      fireEvent.change(box, { target: { value: ' 411045 ' } });
      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      await waitFor(() => expect(vi.mocked(fetchSocieties)).toHaveBeenLastCalledWith(expect.objectContaining({ q: '411045' })));
    } finally {
      vi.useRealTimers();
    }
  });

  it('a chosen society that is not on a loaded page is still shown (fetched by id)', async () => {
    vi.mocked(fetchSocieties).mockResolvedValue(page([named(1)], { nextCursor: 'soc_1', total: 500 }));
    vi.mocked(fetchSociety).mockResolvedValue(named(400));
    renderPicker('soc_400');
    expect(await screen.findByRole('option', { name: 'Society 400' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('soc_400');
    expect(fetchSociety).toHaveBeenCalledWith('soc_400');
  });
});

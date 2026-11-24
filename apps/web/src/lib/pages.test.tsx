import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Page, PageQuery } from '@bulk/shared';
import { CatalogTooLargeError, fetchAllPages, retryUnlessTooLarge, usePagedQuery } from './pages';

/** A three-page list of numbers, served by cursor like the API does. */
function server(items: number[], limit: number) {
  return vi.fn(async (query: PageQuery): Promise<Page<number>> => {
    const start = query.cursor ? items.indexOf(Number(query.cursor)) + 1 : 0;
    const slice = items.slice(start, start + limit);
    const more = start + limit < items.length;
    return { items: slice, nextCursor: more ? String(slice[slice.length - 1]) : null, total: items.length };
  });
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePagedQuery (FEAT-025)', () => {
  it('exposes the loaded items flat, the total, and loads the next page on request', async () => {
    const fetchPage = server([1, 2, 3, 4, 5], 2);
    const { result } = renderHook(() => usePagedQuery({ queryKey: ['nums'], fetchPage, limit: 2 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    expect(result.current.total).toBe(5);
    expect(result.current.hasMore).toBe(true);
    expect(fetchPage).toHaveBeenLastCalledWith({ limit: 2 });

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data).toEqual([1, 2, 3, 4]));
    expect(fetchPage).toHaveBeenLastCalledWith({ limit: 2, cursor: '2' });

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data).toEqual([1, 2, 3, 4, 5]));
    expect(result.current.hasMore).toBe(false);
  });

  it('a refetch re-reads every loaded page, in order, so nothing shows twice', async () => {
    const fetchPage = server([1, 2, 3, 4], 2);
    const { result } = renderHook(() => usePagedQuery({ queryKey: ['nums2'], fetchPage, limit: 2 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data).toEqual([1, 2, 3, 4]));
    fetchPage.mockClear();
    await act(() => result.current.refetch());
    expect(fetchPage.mock.calls.map(([q]) => q)).toEqual([{ limit: 2 }, { limit: 2, cursor: '2' }]);
    expect(result.current.data).toEqual([1, 2, 3, 4]);
  });
});

describe('fetchAllPages', () => {
  it('walks every page for a picker', async () => {
    const fetchPage = server(Array.from({ length: 7 }, (_, i) => i + 1), 3);
    expect(await fetchAllPages(fetchPage, 3)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('throws at the cap instead of truncating silently (FEAT-044 V2 P2-1)', async () => {
    const endless = vi.fn(async () => ({ items: [1], nextCursor: 'more', total: 999 }));
    await expect(fetchAllPages(endless, 1, 3)).rejects.toThrow(CatalogTooLargeError);
    expect(endless).toHaveBeenCalledTimes(3);
    // V2 r2 P3-7: never retried; other errors keep the usual 3 retries.
    expect(retryUnlessTooLarge(0, new CatalogTooLargeError('x'))).toBe(false);
    expect(retryUnlessTooLarge(0, new Error('network'))).toBe(true);
    expect(retryUnlessTooLarge(3, new Error('network'))).toBe(false);
  });
});

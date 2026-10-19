import { keepPreviousData, useInfiniteQuery, type InfiniteData, type QueryKey, type UseInfiniteQueryResult } from '@tanstack/react-query';
import type { Page, PageQuery } from '@bulk/shared';

/** What a screen needs from a paged list (FEAT-025, ADR-0035). */
export interface Paged<T> {
  /** Every item loaded so far, first page first. `undefined` until the first page lands. */
  data: T[] | undefined;
  /** How many match in all — from the newest page. */
  total: number | undefined;
  hasMore: boolean;
  loadMore: () => void;
  loadingMore: boolean;
  isLoading: boolean;
  isError: boolean;
  isPaused: boolean;
  isPlaceholderData: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  status: UseInfiniteQueryResult['status'];
  fetchStatus: UseInfiniteQueryResult['fetchStatus'];
}

interface PagedOptions<T> {
  queryKey: QueryKey;
  fetchPage: (page: PageQuery) => Promise<Page<T>>;
  limit?: number;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  placeholderData?: 'keepPrevious';
  enabled?: boolean;
}

/**
 * One hook for every paged list. The screens keep reading `data` as the flat array they
 * always had; "Show more" is `loadMore`, and `total` says how many there are in all.
 * Live polling (ADR-0010) refetches every loaded page in order, so a row that moved pages
 * is not shown twice.
 */
export function usePagedQuery<T>({ queryKey, fetchPage, limit, refetchInterval, refetchOnWindowFocus, placeholderData, enabled }: PagedOptions<T>): Paged<T> {
  const query = useInfiniteQuery<Page<T>, Error, InfiniteData<Page<T>, string | null>, QueryKey, string | null>({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage({ limit, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null,
    // Defensive: a malformed or empty response (a mocked fetch that resolves to nothing, a
    // proxy that strips the body) must not throw inside the observer — it ends the list.
    getNextPageParam: (last) => last?.nextCursor ?? null,
    refetchInterval,
    refetchOnWindowFocus,
    enabled,
    ...(placeholderData === 'keepPrevious' ? { placeholderData: keepPreviousData } : {}),
  });
  const pages = query.data?.pages;
  return {
    data: pages ? pages.flatMap((page) => page?.items ?? []) : undefined,
    total: pages ? pages[pages.length - 1]?.total : undefined,
    hasMore: query.hasNextPage,
    loadMore: () => {
      if (!query.isFetchingNextPage) void query.fetchNextPage();
    },
    loadingMore: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
    isPaused: query.fetchStatus === 'paused',
    isPlaceholderData: query.isPlaceholderData,
    error: query.error,
    refetch: () => query.refetch(),
    status: query.status,
    fetchStatus: query.fetchStatus,
  };
}

/** Walk every page (for a picker that needs the whole list, e.g. vendors to assign). Capped. */
export async function fetchAllPages<T>(fetchPage: (page: PageQuery) => Promise<Page<T>>, limit = 50, maxPages = 40): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let n = 0; n < maxPages; n += 1) {
    const page = await fetchPage({ limit, ...(cursor ? { cursor } : {}) });
    items.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return items;
}

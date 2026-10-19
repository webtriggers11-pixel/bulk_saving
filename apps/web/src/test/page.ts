import type { InfiniteData } from '@tanstack/react-query';
import type { Page } from '@bulk/shared';

/** One page holding every item (FEAT-025): what a mocked list fetch returns. */
export function page<T>(items: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { items, nextCursor: null, total: items.length, ...overrides };
}

/** What a paged query holds in the cache (FEAT-025): one loaded page. For `setQueryData`. */
export function pagedData<T>(items: T[]): InfiniteData<Page<T>, string | null> {
  return { pages: [page(items)], pageParams: [null] };
}

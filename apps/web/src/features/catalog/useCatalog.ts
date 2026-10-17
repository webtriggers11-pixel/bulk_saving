import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CatalogQuery, ServiceDto } from '@bulk/shared';
import { fetchCatalog } from './catalog.api';

/** Query key for the resident catalog (the caller's own society). */
export const catalogQueryKey = ['catalog'] as const;

/**
 * TanStack Query hook for the resident catalog (`GET /catalog`). The filters are part of
 * the key (a prefix of `catalogQueryKey`, so invalidating the catalog refreshes every
 * filtered view), and the previous result stays on screen while the next one loads.
 */
export function useCatalog(query: CatalogQuery = {}): UseQueryResult<ServiceDto[]> {
  return useQuery({
    queryKey: [...catalogQueryKey, query],
    queryFn: () => fetchCatalog(query),
    placeholderData: keepPreviousData,
  });
}

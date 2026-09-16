import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ServiceDto } from '@bulk/shared';
import { fetchCatalog } from './catalog.api';

/** Query key for the resident catalog (the caller's own society). */
export const catalogQueryKey = ['catalog'] as const;

/** TanStack Query hook for the resident catalog (`GET /catalog`). */
export function useCatalog(): UseQueryResult<ServiceDto[]> {
  return useQuery({
    queryKey: catalogQueryKey,
    queryFn: fetchCatalog,
  });
}

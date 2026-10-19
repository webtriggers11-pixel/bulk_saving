import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { CatalogQuery, ServiceDto } from '@bulk/shared';
import { askForService, fetchCatalog, withdrawAsk } from './catalog.api';
import { ApiError } from '../../lib/api';
import { roundsQueryKey } from '../rounds/useRounds';

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

/**
 * FEAT-022: ask for (or withdraw from) a round of a service. On success every cached
 * catalog list is refreshed, so the count and the button agree everywhere at once.
 */
export function useServiceAsk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, asked }: { serviceId: string; asked: boolean }) =>
      asked ? withdrawAsk(serviceId) : askForService(serviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogQueryKey }),
    // A round opened after this page loaded (409 ROUND_ALREADY_OPEN): refresh the rounds
    // and the catalog so the card turns into "book" instead of failing on every retry (V2 P2-3).
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'ROUND_ALREADY_OPEN') {
        void queryClient.invalidateQueries({ queryKey: roundsQueryKey });
        void queryClient.invalidateQueries({ queryKey: catalogQueryKey });
      }
    },
  });
}

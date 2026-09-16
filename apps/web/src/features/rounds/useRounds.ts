import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { RoundDto } from '@bulk/shared';
import { fetchRounds, joinRound, leaveRound, updatePledge } from './rounds.api';

/** Query key for the resident rounds list (the caller's own society). */
export const roundsQueryKey = ['rounds'] as const;

/**
 * How often the rounds list re-polls so the live unit count / current price stay
 * fresh without websockets (ADR-0010: "live updates in v1 via polling"). Also
 * refetches on window focus so returning to the tab shows the latest count.
 */
const LIVE_REFETCH_MS = 20_000;

/** TanStack Query hook for the resident rounds list (`GET /rounds`), live-polled. */
export function useRounds(): UseQueryResult<RoundDto[]> {
  return useQuery({
    queryKey: roundsQueryKey,
    queryFn: fetchRounds,
    refetchOnWindowFocus: true,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

/** Arguments for a pledge mutation: the round id and the chosen unit count. */
interface PledgeVars {
  id: string;
  units: number;
}

/** POST /rounds/:id/join mutation; invalidates the rounds list on success. */
export function useJoinRound(): UseMutationResult<RoundDto, Error, PledgeVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, units }: PledgeVars) => joinRound(id, units),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roundsQueryKey });
    },
  });
}

/** PATCH /rounds/:id/join mutation; invalidates the rounds list on success. */
export function useUpdatePledge(): UseMutationResult<RoundDto, Error, PledgeVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, units }: PledgeVars) => updatePledge(id, units),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roundsQueryKey });
    },
  });
}

/** DELETE /rounds/:id/join mutation; invalidates the rounds list on success. */
export function useLeaveRound(): UseMutationResult<RoundDto, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leaveRound(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roundsQueryKey });
    },
  });
}

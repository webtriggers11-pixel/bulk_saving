import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { MyRoundDto, RoundDto } from '@bulk/shared';
import { usePagedQuery, type Paged } from '../../lib/pages';
import { fetchMyRounds, fetchRounds, joinRound, leaveRound, updatePledge } from './rounds.api';

/** Query key for the resident rounds list (the caller's own society). */
export const roundsQueryKey = ['rounds'] as const;

/** Query key for "My Requests" — rounds the caller has joined, any status. */
export const myRoundsQueryKey = ['rounds', 'mine'] as const;

/**
 * How often the rounds list re-polls so the live unit count / current price stay
 * fresh without websockets (ADR-0010: "live updates in v1 via polling"). Also
 * refetches on window focus so returning to the tab shows the latest count.
 */
const LIVE_REFETCH_MS = 20_000;

/** The resident rounds list (`GET /rounds`), live-polled, one page at a time (FEAT-025). */
export function useRounds(): Paged<RoundDto> {
  return usePagedQuery({
    queryKey: roundsQueryKey,
    fetchPage: fetchRounds,
    refetchOnWindowFocus: true,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

/**
 * TanStack Query hook for "My Requests" (`GET /rounds/mine`). Polled on the same
 * cadence as the browse list: a joined round's unit count and price move while
 * it is OPEN, and its status moves without the resident doing anything.
 */
export function useMyRounds(): Paged<MyRoundDto> {
  return usePagedQuery({
    queryKey: myRoundsQueryKey,
    fetchPage: fetchMyRounds,
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
      // `roundsQueryKey` is a prefix of `myRoundsQueryKey`, so this one call
      // refreshes the browse list AND My Requests — joining changes both.
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
      // `roundsQueryKey` is a prefix of `myRoundsQueryKey`, so this one call
      // refreshes the browse list AND My Requests — joining changes both.
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
      // `roundsQueryKey` is a prefix of `myRoundsQueryKey`, so this one call
      // refreshes the browse list AND My Requests — joining changes both.
      void queryClient.invalidateQueries({ queryKey: roundsQueryKey });
    },
  });
}

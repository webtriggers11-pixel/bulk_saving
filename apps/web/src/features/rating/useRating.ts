import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { RateRoundBody, RatingDto } from '@bulk/shared';
import { rateRound, removeRating } from './rating.api';
import { roundsQueryKey } from '../rounds/useRounds';

/** Arguments for a rating write: which round, and what the resident said. */
export interface RateVars extends RateRoundBody {
  roundId: string;
}

/**
 * PUT /rounds/:id/rating.
 *
 * Deliberately NOT optimistic (ADR-0018): on a flaky connection a star that
 * appears and then silently reverts is worse than a short wait, because the
 * resident believes they rated and did not. The server response is the only thing
 * this UI trusts.
 *
 * Invalidating `['rounds']` is enough for both lists: `myRoundsQueryKey` is
 * `['rounds', 'mine']`, a prefix child, so My Requests refetches too.
 */
export function useRateRound(): UseMutationResult<RatingDto, Error, RateVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roundId, stars, comment }: RateVars) =>
      rateRound(roundId, comment === undefined ? { stars } : { stars, comment }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roundsQueryKey });
    },
  });
}

/** DELETE /rounds/:id/rating — withdraw the caller's own rating. */
export function useRemoveRating(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roundId: string) => removeRating(roundId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roundsQueryKey });
    },
  });
}

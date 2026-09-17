import type { Rating } from '@prisma/client';
import type { RatingDto, RatingSummary } from '@bulk/shared';

/**
 * Pure shaping for ratings (FEAT-007). Lives apart from `RatingsService` so both
 * the service and `RoundsService` can use it without importing each other — the
 * same split as `rounds.mapper.ts`.
 */

/** Shape a `Rating` row for the API. */
export function toRatingDto(rating: Rating): RatingDto {
  return {
    id: rating.id,
    roundId: rating.roundId,
    residentId: rating.residentId,
    stars: rating.stars,
    comment: rating.comment,
    createdAt: rating.createdAt.toISOString(),
    updatedAt: rating.updatedAt.toISOString(),
  };
}

/**
 * Average rounded to one decimal, or null when there is nothing to average.
 * `count` always ships alongside it: an average of 5.0 from one rating and from
 * fifty are very different claims (ADR-0017).
 */
export function summarise(stars: number[]): RatingSummary {
  if (stars.length === 0) {
    return { average: null, count: 0 };
  }
  const total = stars.reduce((sum, s) => sum + s, 0);
  return { average: Math.round((total / stars.length) * 10) / 10, count: stars.length };
}

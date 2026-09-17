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
 * Group rating stars by the vendor that delivered the round they belong to
 * (FEAT-007, ADR-0017). Ratings on rounds with no vendor are skipped. Pure, so the
 * vendors domain can use it without importing the rounds module (which already
 * imports vendors — the reverse edge would be a cycle).
 */
export function groupStarsByVendor(
  rows: Array<{ stars: number; round: { vendorId: string | null } }>,
): Map<string, number[]> {
  const byVendor = new Map<string, number[]>();
  for (const row of rows) {
    const vendorId = row.round.vendorId;
    if (!vendorId) {
      continue;
    }
    const bucket = byVendor.get(vendorId);
    if (bucket) {
      bucket.push(row.stars);
    } else {
      byVendor.set(vendorId, [row.stars]);
    }
  }
  return byVendor;
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
  // + EPSILON: 87/20 is 4.35 in decimal but 4.3499999999999996 in binary, which
  // would round DOWN to 4.3 and quietly understate a vendor.
  const average = Math.round((total / stars.length + Number.EPSILON) * 10) / 10;
  return { average, count: stars.length };
}

import type { RateRoundBody, RatingDto } from '@bulk/shared';
import { apiRequest } from '../../lib/api';

/**
 * Post-service rating (FEAT-007 API, FEAT-009 UI). Both routes act on the CALLER'S
 * own rating only — the server derives the resident from the access token, so there
 * is no resident id in either signature.
 */

/** PUT /rounds/:id/rating — create or replace the caller's rating (idempotent). */
export function rateRound(roundId: string, body: RateRoundBody): Promise<RatingDto> {
  return apiRequest<RatingDto>(`/rounds/${roundId}/rating`, { method: 'PUT', body });
}

/** DELETE /rounds/:id/rating — withdraw the caller's rating. The round stays RATED. */
export function removeRating(roundId: string): Promise<void> {
  return apiRequest<void>(`/rounds/${roundId}/rating`, { method: 'DELETE' });
}

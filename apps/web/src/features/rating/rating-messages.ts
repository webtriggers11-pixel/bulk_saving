import { ApiError } from '../../lib/api';

/**
 * Resident-facing copy for rating failures (V2 P2).
 *
 * Previously these went through `features/auth/error-messages`, whose switch knows
 * only auth codes — so ROUND_NOT_DELIVERED, NOT_A_PARTICIPANT and a 404 on delete
 * all became "Something went wrong. Please try again.", which advises retrying
 * something that can never succeed. It was also a feature-boundary smell
 * (rating importing from auth).
 */
export function ratingErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'ROUND_NOT_DELIVERED':
        return 'This job has not been marked delivered yet, so it cannot be rated.';
      case 'NOT_A_PARTICIPANT':
        return 'Only residents who joined this round can rate it.';
      case 'NOT_FOUND':
        return error.status === 404
          ? 'We could not find that rating — it may already have been removed.'
          : 'We could not find that round.';
      case 'VALIDATION_ERROR':
      case 'BAD_REQUEST':
        return 'Please choose a rating between 1 and 5 and keep the comment under 500 characters.';
      case 'UNAUTHORIZED':
      case 'TOKEN_REVOKED':
        return 'Your session has expired. Please sign in again.';
      default:
        return 'We could not save your rating. Please try again.';
    }
  }
  return 'We could not save your rating. Please try again.';
}

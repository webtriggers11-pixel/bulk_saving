import { ApiError } from '../../lib/api';

/** Map a backend auth error code to a friendly, resident-facing message. */
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'INVALID_INVITE_CODE':
      return "We couldn't find that invite code. Check it with your society and try again.";
    case 'OTP_INVALID':
      return 'That code is incorrect. Please check the SMS and try again.';
    case 'OTP_EXPIRED':
      return 'That code has expired. Request a new one.';
    case 'OTP_LOCKED':
      return 'Too many incorrect attempts. Request a new code to continue.';
    case 'NOT_AN_ADMIN':
      return 'This number is not an administrator. Use the resident sign-in instead.';
    case 'OTP_RATE_LIMITED':
      return 'Too many requests. Please wait a moment before trying again.';
    case 'UNAUTHORIZED':
    case 'TOKEN_REVOKED':
      return 'Your session has expired. Please sign in again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/** Resolve any thrown value into a friendly message (ApiError-aware). */
export function messageFromError(error: unknown): string {
  if (error instanceof ApiError) {
    return authErrorMessage(error.code);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return authErrorMessage('UNKNOWN');
}

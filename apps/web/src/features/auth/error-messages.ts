import { OTP_CODE_LENGTH } from '@bulk/shared';
import { ApiError } from '../../lib/api';

/** What a number must look like (BUG-019) — shown under the field and for the server's refusal. */
export const PHONE_HINT = "Enter your 10-digit mobile number.";
/** What an invite code must look like (BUG-021) — the same pattern, for the other validated field. */
export const INVITE_HINT = 'An invite code is 8 letters and numbers, like AB12CD34.';
export const INVITE_CODE_SHAPE = /^[A-Z0-9]{8}$/;
/** FEAT-047 (ADR-0055): every sign-in code is OTP_CODE_LENGTH digits; the input shows 123456. */
export const OTP_PLACEHOLDER = Array.from({ length: OTP_CODE_LENGTH }, (_, i) => String((i + 1) % 10)).join('');
export const OTP_HINT = `The code is ${OTP_CODE_LENGTH} digits.`;

/**
 * Map a backend auth error code to a friendly, resident-facing message. `serverMessage` is
 * the envelope's text: a validation refusal names the field it is about, and that decides
 * whether the hint is the phone's or the invite code's (BUG-021 — before this, every 400 on
 * the auth doors read as a phone problem).
 */
export function authErrorMessage(code: string, serverMessage?: string): string {
  switch (code) {
    case 'INVALID_INVITE_CODE':
      // FEAT-045: the owner's words ("This is an invalid invite code."), then what to do about it.
      return 'This is an invalid invite code. Check it with your society and try again.';
    case 'INVITE_CHECK_RATE_LIMITED':
      return 'Too many invite codes tried. Please wait a while, then try again.';
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
    // FEAT-047: a daily cap (this number, or the whole service) is spent until midnight.
    case 'OTP_DAILY_LIMIT':
      return 'Too many codes have been sent today. Please try again tomorrow.';
    // FEAT-046: the SMS gateway refused or timed out.
    case 'OTP_DELIVERY_FAILED':
      return 'We could not send your code right now. Please try again in a minute.';
    // BUG-019: the server refused the number itself (either the DTO shape or the normaliser)…
    // …or, BUG-021, the invite code: the server's message says which.
    case 'VALIDATION_ERROR':
    case 'BAD_REQUEST':
      if (/inviteCode/i.test(serverMessage ?? '')) return `That invite code isn't right. ${INVITE_HINT}`;
      // FEAT-047: the code's shape (the DTO says "code must be 6 digits.").
      if (/\bcode must\b/i.test(serverMessage ?? '')) return `That code isn't complete. ${OTP_HINT}`;
      return `That doesn't look like a phone number. ${PHONE_HINT}`;
    // FEAT-035 V2 P2: an admin switched this account off.
    case 'ACCOUNT_DISABLED':
      return 'This account has been switched off. Ask your society admin to switch it back on.';
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
    return authErrorMessage(error.code, error.message);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return authErrorMessage('UNKNOWN');
}

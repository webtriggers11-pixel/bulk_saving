import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api';
import { INVITE_HINT, OTP_HINT, OTP_PLACEHOLDER, PHONE_HINT, authErrorMessage, messageFromError } from './error-messages';

/** BUG-021: a validation refusal names the field it is about. */
describe('authErrorMessage — validation refusals', () => {
  it('a refused invite code talks about the invite code, not the phone', () => {
    const message = messageFromError(new ApiError('BAD_REQUEST', 'inviteCode must be 8 uppercase alphanumeric characters.', 400));
    expect(message).toContain(INVITE_HINT);
    expect(message).not.toContain(PHONE_HINT);
  });

  it('a refused phone keeps the phone hint (BUG-019)', () => {
    expect(messageFromError(new ApiError('VALIDATION_ERROR', 'phone must be a valid phone number.', 400))).toContain(PHONE_HINT);
    // No server message at all: the phone is still the likeliest field on these doors.
    expect(authErrorMessage('BAD_REQUEST')).toContain(PHONE_HINT);
  });

  it('names a switched-off account plainly (FEAT-035)', () => {
    expect(authErrorMessage('ACCOUNT_DISABLED')).toMatch(/switched off/);
  });
});

/** FEAT-045: the owner's wording for a code no society answers to. */
describe('authErrorMessage — invite code', () => {
  it('an unknown invite code reads "This is an invalid invite code."', () => {
    expect(authErrorMessage('INVALID_INVITE_CODE')).toMatch(/^This is an invalid invite code\./);
  });

  it('too many wrong codes says to wait', () => {
    expect(authErrorMessage('INVITE_CHECK_RATE_LIMITED')).toMatch(/wait/);
  });
});

describe('FEAT-047: one 6-digit code, daily caps', () => {
  it('a short code talks about the code, not the phone', () => {
    const msg = authErrorMessage('BAD_REQUEST', 'code must be 6 digits.');
    expect(msg).toContain(OTP_HINT);
    expect(msg).not.toContain(PHONE_HINT);
  });

  it('a 400 about the name asks for the name, not a phone number (FEAT-048)', () => {
    expect(authErrorMessage('BAD_REQUEST', 'name must be 1 to 80 characters.')).toBe('Please enter your name (up to 80 characters).');
    expect(authErrorMessage('BAD_REQUEST', 'name is required.')).toBe('Please enter your name (up to 80 characters).');
  });

  it('the placeholder is 6 digits', () => {
    expect(OTP_PLACEHOLDER).toBe('123456');
  });

  it('a spent daily cap says to try tomorrow; a failed send says to retry soon', () => {
    expect(authErrorMessage('OTP_DAILY_LIMIT')).toMatch(/tomorrow/);
    expect(authErrorMessage('OTP_DELIVERY_FAILED')).toMatch(/could not send/);
  });
});

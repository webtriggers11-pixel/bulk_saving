import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api';
import { INVITE_HINT, PHONE_HINT, authErrorMessage, messageFromError } from './error-messages';

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
});

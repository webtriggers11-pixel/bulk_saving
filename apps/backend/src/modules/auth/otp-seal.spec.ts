import { sealOtp, unsealOtp } from './otp-seal';

/**
 * CHORE-017: a queued OTP sits in Redis until the worker sends it. It is sealed
 * (AES-256-GCM, key derived from OTP_HASH_SECRET) so a Redis dump, a MONITOR session
 * or BullMQ's dashboard never shows a usable code.
 */
describe('sealOtp / unsealOtp', () => {
  const OLD = process.env.OTP_HASH_SECRET;
  beforeAll(() => {
    process.env.OTP_HASH_SECRET = 'test-secret-for-sealing';
  });
  afterAll(() => {
    process.env.OTP_HASH_SECRET = OLD;
  });

  it('round-trips, and the sealed form does not contain the code', () => {
    const sealed = sealOtp('1234');
    expect(sealed).not.toContain('1234');
    expect(unsealOtp(sealed)).toBe('1234');
  });

  it('seals the same code differently every time (random IV)', () => {
    expect(sealOtp('1234')).not.toBe(sealOtp('1234'));
  });

  it('refuses a tampered payload rather than returning a wrong code', () => {
    const sealed = Buffer.from(sealOtp('1234'), 'base64');
    sealed[sealed.length - 1] ^= 0xff;
    expect(() => unsealOtp(sealed.toString('base64'))).toThrow();
  });

  it('refuses a payload sealed under another secret', () => {
    const sealed = sealOtp('1234');
    process.env.OTP_HASH_SECRET = 'rotated';
    try {
      expect(() => unsealOtp(sealed)).toThrow();
    } finally {
      process.env.OTP_HASH_SECRET = 'test-secret-for-sealing';
    }
  });
});

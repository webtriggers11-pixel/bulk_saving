import { randomBytes } from 'node:crypto';
import { RedisService } from '../../redis/redis.service';
import type { NotificationChannel } from '../notifications/notification-channel';
import { OtpService, OTP_MAX_ATTEMPTS, devOtpEchoEnabled } from './otp.service';

/**
 * OtpService unit tests against REAL Redis (needs `docker compose up -d`),
 * consistent with the existing BullMQ integration test. A capturing fake
 * channel recovers the generated code (the only place the raw code is exposed).
 */
class CapturingChannel implements NotificationChannel {
  public lastCode: string | null = null;
  public lastPhone: string | null = null;
  async sendOtp(phone: string, code: string): Promise<void> {
    this.lastPhone = phone;
    this.lastCode = code;
  }
  async send(): Promise<void> {}
}

describe('OtpService (integration, needs Redis)', () => {
  let redis: RedisService;
  let channel: CapturingChannel;
  let service: OtpService;

  const societyId = `soc_${randomBytes(4).toString('hex')}`;
  const uniquePhone = (): string => `+9198${randomBytes(4).toString('hex').slice(0, 8)}`;

  beforeAll(() => {
    redis = new RedisService();
  });

  beforeEach(() => {
    channel = new CapturingChannel();
    service = new OtpService(redis, channel);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('happy path: request dispatches a code, verify with it returns OK', async () => {
    const phone = uniquePhone();
    const result = await service.request(societyId, phone);
    expect(result.result).toBe('SENT');
    expect(channel.lastCode).toMatch(/^\d{6}$/);

    const verify = await service.verify(societyId, phone, channel.lastCode as string);
    expect(verify).toBe('OK');
  });

  it('wrong code returns INVALID', async () => {
    const phone = uniquePhone();
    await service.request(societyId, phone);
    const wrong = channel.lastCode === '000000' ? '111111' : '000000';
    expect(await service.verify(societyId, phone, wrong)).toBe('INVALID');
  });

  it('locks the OTP after the max failed attempts', async () => {
    const phone = uniquePhone();
    await service.request(societyId, phone);
    const wrong = channel.lastCode === '000000' ? '111111' : '000000';

    const results: string[] = [];
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
      results.push(await service.verify(societyId, phone, wrong));
    }
    // First four wrong -> INVALID, the fifth trips the lock.
    expect(results.slice(0, OTP_MAX_ATTEMPTS - 1)).toEqual(
      Array(OTP_MAX_ATTEMPTS - 1).fill('INVALID'),
    );
    expect(results[OTP_MAX_ATTEMPTS - 1]).toBe('LOCKED');

    // Even the correct code no longer works — the OTP was invalidated.
    expect(await service.verify(societyId, phone, channel.lastCode as string)).toBe('EXPIRED');
  });

  it('verifying with no outstanding OTP returns EXPIRED', async () => {
    const phone = uniquePhone();
    expect(await service.verify(societyId, phone, '123456')).toBe('EXPIRED');
  });

  it('rate-limits an immediate resend (1 / 30s)', async () => {
    const phone = uniquePhone();
    expect((await service.request(societyId, phone)).result).toBe('SENT');
    expect((await service.request(societyId, phone)).result).toBe('RATE_LIMITED');
  });

  describe('dev OTP echo (CHORE-002, ADR-0016)', () => {
    const OLD_FLAG = process.env.OTP_DEV_LOG;

    afterEach(() => {
      process.env.OTP_DEV_LOG = OLD_FLAG;
    });

    // NOTE: these tests deliberately do NOT mutate NODE_ENV. Backend suites share one
    // DB and Redis, and several boot-time guards key off `NODE_ENV === 'test'` (the
    // round-closing and notification reconcilers). Flipping it process-wide lets those
    // reconcilers act on other suites' fixtures. The production branch is asserted
    // through the pure predicate below instead, which needs no global state.

    it('does NOT return the code by default — the ADR-0007 rule still holds', async () => {
      delete process.env.OTP_DEV_LOG;
      const outcome = await service.request(societyId, uniquePhone());
      expect(outcome).toEqual({ result: 'SENT' });
      expect(outcome).not.toHaveProperty('devCode');
    });

    it('returns the real code when the dev flag is on', async () => {
      process.env.OTP_DEV_LOG = 'true';
      const outcome = await service.request(societyId, uniquePhone());
      expect(outcome.devCode).toMatch(/^\d{6}$/);
      // It is the code that was actually dispatched, not a second one.
      expect(outcome.devCode).toBe(channel.lastCode);
    });

    it('devOtpEchoEnabled is the single decision point: BOTH conditions must hold', () => {
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'true', NODE_ENV: 'development' })).toBe(true);
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'true', NODE_ENV: 'test' })).toBe(true);
      // The flag alone is NOT enough — production always refuses.
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'true', NODE_ENV: 'production' })).toBe(false);
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'false', NODE_ENV: 'development' })).toBe(false);
      expect(devOtpEchoEnabled({ NODE_ENV: 'development' })).toBe(false);
      // Only the exact opt-in string counts, not anything boolean-ish.
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: '1', NODE_ENV: 'development' })).toBe(false);
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'TRUE', NODE_ENV: 'development' })).toBe(false);
    });
  });
});

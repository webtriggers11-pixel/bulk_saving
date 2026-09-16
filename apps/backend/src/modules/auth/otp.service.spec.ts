import { randomBytes } from 'node:crypto';
import { RedisService } from '../../redis/redis.service';
import type { NotificationChannel } from '../notifications/notification-channel';
import { OtpService, OTP_MAX_ATTEMPTS } from './otp.service';

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
    expect(result).toBe('SENT');
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
    expect(await service.request(societyId, phone)).toBe('SENT');
    expect(await service.request(societyId, phone)).toBe('RATE_LIMITED');
  });
});

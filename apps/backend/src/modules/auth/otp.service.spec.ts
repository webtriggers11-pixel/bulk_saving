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

  describe('the OTP never leaves this service (ADR-0020)', () => {
    const OLD_FLAG = process.env.OTP_DEV_LOG;

    afterEach(() => {
      process.env.OTP_DEV_LOG = OLD_FLAG;
    });

    it('returns only the result — no code, under any flag', async () => {
      // CHORE-002 briefly returned the code here for the local toast. CHORE-007 moved
      // that affordance into the stub SMS channel, so the production auth path has no
      // bypass at all: the shape is the same whatever OTP_DEV_LOG says.
      process.env.OTP_DEV_LOG = 'true';
      expect(await service.request(societyId, uniquePhone())).toEqual({ result: 'SENT' });

      delete process.env.OTP_DEV_LOG;
      expect(await service.request(societyId, uniquePhone())).toEqual({ result: 'SENT' });
    });

    it('devOtpEchoEnabled still requires BOTH conditions (it now gates the stub adapter)', () => {
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'true', NODE_ENV: 'development' })).toBe(true);
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'true', NODE_ENV: 'test' })).toBe(true);
      // The flag alone is NOT enough — production always refuses.
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'true', NODE_ENV: 'production' })).toBe(false);
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'false', NODE_ENV: 'development' })).toBe(false);
      expect(devOtpEchoEnabled({ NODE_ENV: 'development' })).toBe(false);
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: '1', NODE_ENV: 'development' })).toBe(false);
      expect(devOtpEchoEnabled({ OTP_DEV_LOG: 'TRUE', NODE_ENV: 'development' })).toBe(false);
    });
  });
});

/**
 * V2 round 2, P1-A. Suppressing the send for non-admins equalised the status, the body
 * and the stored state, and left the one step that costs real time — the SMS provider's
 * round-trip — inside an administrator's response and nobody else's. With a 200ms
 * provider that was ~230ms against ~13ms: one unauthenticated request, 15× apart.
 *
 * A timing assertion would be flaky, so the property is tested as a fact about control
 * flow instead: with a channel that NEVER resolves, a detached request still returns.
 * That cannot pass if the send is awaited, and it does not depend on a clock.
 */
describe('OtpService dispatch modes (ADR-0023)', () => {
  let redis: RedisService;

  /** A provider that accepts the send and never comes back. */
  class HangingChannel implements NotificationChannel {
    public calls = 0;
    private release: (() => void) | null = null;
    async sendOtp(): Promise<void> {
      this.calls += 1;
      return new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }
    async send(): Promise<void> {}
    /** Let the pending send finish so the test does not leak a dangling promise. */
    finish(): void {
      this.release?.();
    }
  }

  beforeAll(() => {
    redis = new RedisService();
  });

  afterAll(async () => {
    await redis.quit();
  });

  /** A phone nobody else in this suite uses, so the rate limiter never collides. */
  function freshPhone(): string {
    return `+9198${randomBytes(4).toString('hex').replace(/\D/g, '').padEnd(8, '0').slice(0, 8)}`;
  }

  it('returns without waiting for the provider when the dispatch is detached', async () => {
    const channel = new HangingChannel();
    const service = new OtpService(redis, channel);
    const phone = freshPhone();

    // If this awaited the send, it would hang here until the test timed out.
    const outcome = await service.request('detach-test', phone, { dispatch: 'detached' });

    expect(outcome.result).toBe('SENT');
    // Not called YET: the invocation itself is deferred to `setImmediate`, so even an
    // adapter's synchronous prefix stays out of the response (V2 round 3).
    expect(channel.calls).toBe(0);

    await new Promise((resolve) => setImmediate(resolve));
    expect(channel.calls).toBe(1);
    channel.finish();
  });

  it('DOES wait for the provider when the dispatch is awaited', async () => {
    const channel = new HangingChannel();
    const service = new OtpService(redis, channel);
    const phone = freshPhone();

    let settled = false;
    const pending = service.request('await-test', phone, { dispatch: 'awaited' }).then(() => {
      settled = true;
    });

    // Give the event loop every chance to settle it; it must not, because the
    // provider has not returned. This is the mirror that proves the test above
    // is measuring the dispatch mode and not something incidental.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(settled).toBe(false);

    channel.finish();
    await pending;
    expect(settled).toBe(true);
  });

  it('never calls the provider at all when the dispatch is suppressed', async () => {
    const channel = new HangingChannel();
    const service = new OtpService(redis, channel);

    const outcome = await service.request('suppress-test', freshPhone(), {
      dispatch: 'suppressed',
    });

    expect(outcome.result).toBe('SENT');
    expect(channel.calls).toBe(0);
  });

  it('survives a provider that throws SYNCHRONOUSLY, without failing the request', async () => {
    // V2 round 3. `sendOtp` is declared `Promise<void>`, but throwing before returning
    // one is legal TypeScript — and then `.catch` is never attached, so the exception
    // walked out as a 500 for administrators and a 200 for everyone else. The same
    // oracle a third time, through the mechanism this file claimed to handle. The
    // rejected-promise test below is NOT this case; it was the one that already worked.
    const throwing: NotificationChannel = {
      sendOtp(): Promise<void> {
        throw new Error('malformed provider URL');
      },
      send: () => Promise.resolve(),
    };
    const service = new OtpService(redis, throwing);

    const outcome = await service.request('sync-throw-test', freshPhone(), {
      dispatch: 'detached',
    });

    expect(outcome.result).toBe('SENT');
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  it('keeps the code out of the failure log, even if the provider echoes it back', async () => {
    // ADR-0020: the raw code must never be logged. A provider SDK that embeds the
    // outgoing request body in its error message would do exactly that.
    const warnings: string[] = [];
    const echoing: NotificationChannel = {
      sendOtp: (_phone: string, code: string) =>
        Promise.reject(new Error(`POST /sms failed: {"text":"Your code is ${code}"}`)),
      send: () => Promise.resolve(),
    };
    const service = new OtpService(redis, echoing);
    const spy = vi_spyOnWarn(service, warnings);

    await service.request('redact-test', freshPhone(), { dispatch: 'detached' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    spy();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('******');
    expect(warnings[0]).not.toMatch(/Your code is \d{6}/);
  });

  it('survives a provider that rejects, without failing the request', async () => {
    // The other half of P1-A: a provider that throws on an unroutable number used to
    // propagate out as a 500 for administrators and a 200 for everyone else.
    const failing: NotificationChannel = {
      sendOtp: () => Promise.reject(new Error('provider unavailable')),
      send: () => Promise.resolve(),
    };
    const service = new OtpService(redis, failing);

    const outcome = await service.request('reject-test', freshPhone(), {
      dispatch: 'detached',
    });

    expect(outcome.result).toBe('SENT');
    // Let the rejection land; an unhandled rejection here would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});

/**
 * Capture what the service logs, without reaching for a mocking framework the backend
 * suite does not otherwise use: swap the private logger's `warn` and hand back the
 * restore. Returns the restore function so a test cannot forget it.
 */
function vi_spyOnWarn(service: OtpService, sink: string[]): () => void {
  const holder = service as unknown as { log: { warn: (message: string) => void } };
  const original = holder.log.warn.bind(holder.log);
  holder.log.warn = (message: string) => {
    sink.push(message);
  };
  return () => {
    holder.log.warn = original;
  };
}

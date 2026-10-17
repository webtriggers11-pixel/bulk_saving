import { randomBytes } from 'node:crypto';
import { RedisService } from '../../redis/redis.service';
import type { Queue } from 'bullmq';
import type { NotificationChannel } from '../notifications/notification-channel';
import { unsealOtp } from './otp-seal';
import type { OtpSendJobData } from './otp-send.processor';
import {
  OtpService,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_HOURLY_MAX,
  OTP_RESEND_PHONE_HOURLY_MAX,
  OTP_VERIFY_FAIL_CLIENT_MAX,
  OTP_VERIFY_FAIL_PHONE_MAX,
  devOtpEchoEnabled,
  ipBucket,
} from './otp.service';

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

  /**
   * CHORE-016: six unauthenticated requests used to deny an administrator their own
   * sign-in for an hour, because every budget was keyed by phone alone. The budgets are
   * now per (phone, client IP), with a ceiling per phone across all IPs — and identical
   * for every caller, so no budget differs by role (ADR-0023's oracle stays closed).
   */
  describe('budgets are per client, under a per-phone ceiling (CHORE-016)', () => {
    const at = (clientIp: string) => ({ clientIp });

    it('one machine’s requests do not lock out the owner on another', async () => {
      const phone = uniquePhone();
      expect((await service.request(societyId, phone, at('198.51.100.7'))).result).toBe('SENT');
      expect((await service.request(societyId, phone, at('198.51.100.7'))).result).toBe('RATE_LIMITED');
      // The owner, elsewhere, is not inside the attacker's 30s window.
      expect((await service.request(societyId, phone, at('203.0.113.9'))).result).toBe('SENT');
    });

    it('an exhausted hourly budget on one IP leaves another IP its own', async () => {
      const phone = uniquePhone();
      await redis.set(`otp:resend:hourly:${societyId}:${phone}:198.51.100.7`, String(OTP_RESEND_HOURLY_MAX), 'EX', 3600);
      expect((await service.request(societyId, phone, at('198.51.100.7'))).result).toBe('RATE_LIMITED');
      expect((await service.request(societyId, phone, at('203.0.113.9'))).result).toBe('SENT');
    });

    it('caps a phone across ALL clients — rotating IPs does not buy unlimited codes', async () => {
      const phone = uniquePhone();
      for (let n = 1; n <= OTP_RESEND_PHONE_HOURLY_MAX; n += 1) {
        expect((await service.request(societyId, phone, at(`192.0.2.${n}`))).result).toBe('SENT');
      }
      expect((await service.request(societyId, phone, at('192.0.2.200'))).result).toBe('RATE_LIMITED');
    });

    it('a refused request does not spend the per-phone ceiling', async () => {
      const phone = uniquePhone();
      expect((await service.request(societyId, phone, at('198.51.100.7'))).result).toBe('SENT');
      for (let n = 0; n < 20; n += 1) {
        await service.request(societyId, phone, at('198.51.100.7')); // all inside the 30s window
      }
      expect(await redis.get(`otp:resend:ceiling:${societyId}:${phone}`)).toBe('1');
    });

    it('buckets IPv6 by /64 — an attacker gets a whole /64 for free', () => {
      expect(ipBucket('2001:db8:aa:bb:1::1')).toBe(ipBucket('2001:db8:aa:bb:ffff::2'));
      expect(ipBucket('2001:db8:aa:bb::1')).not.toBe(ipBucket('2001:db8:aa:cc::1'));
    });

    it('ignores a port a proxy may append — otherwise every source port is a fresh budget (ADR-0027 V2)', () => {
      expect(ipBucket('198.51.100.7:51234')).toBe(ipBucket('198.51.100.7'));
      expect(ipBucket('[2001:db8:aa:bb::1]:443')).toBe(ipBucket('2001:db8:aa:bb::9'));
    });

    it('treats an IPv4-mapped address as the IPv4 address, and a missing one as one shared bucket', () => {
      expect(ipBucket('::ffff:198.51.100.7')).toBe(ipBucket('198.51.100.7'));
      expect(ipBucket(undefined)).toBe(ipBucket(''));
    });
  });

  /**
   * ADR-0027 V2 P1: the request ceiling is per scope, and an admin's number is reachable
   * through BOTH doors — so a multi-IP guesser got ~100 guesses an hour at a SUPER_ADMIN.
   * Failed guesses now spend a budget per (phone, client) and per phone, across scopes.
   */
  describe('failed guesses spend a budget across both doors (ADR-0027)', () => {
    const at = (clientIp: string) => ({ clientIp });
    const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

    /**
     * One wrong guess against a fresh code, from `ip` — the per-code lock never trips.
     * The REQUEST budgets for that client are cleared first: this suite is about guess
     * budgets, and needs more codes per client than the request budget hands out.
     */
    async function guessWrong(scope: string, phone: string, ip: string) {
      await redis.del(`otp:resend:interval:${scope}:${phone}:${ip}`, `otp:resend:hourly:${scope}:${phone}:${ip}`);
      await service.request(scope, phone, at(ip));
      return service.verify(scope, phone, wrong(channel.lastCode as string), at(ip));
    }

    it('a guesser on one client is stopped — even a correct code is refused once its budget is spent', async () => {
      const phone = uniquePhone();
      for (let n = 0; n < OTP_VERIFY_FAIL_CLIENT_MAX; n += 1) {
        expect(await guessWrong(societyId, phone, '198.51.100.7')).toBe('INVALID');
      }
      await redis.del(`otp:resend:interval:${societyId}:${phone}:198.51.100.7`);
      await service.request(societyId, phone, at('198.51.100.7'));
      expect(await service.verify(societyId, phone, channel.lastCode as string, at('198.51.100.7'))).toBe('LOCKED');
    });

    it('…while the owner, on another client, still signs in', async () => {
      const phone = uniquePhone();
      for (let n = 0; n < OTP_VERIFY_FAIL_CLIENT_MAX; n += 1) {
        await guessWrong(societyId, phone, '198.51.100.7');
      }
      await service.request(societyId, phone, at('203.0.113.9'));
      expect(await service.verify(societyId, phone, channel.lastCode as string, at('203.0.113.9'))).toBe('OK');
    });

    it('caps a phone across clients AND across doors — the admin door and a society door share it', async () => {
      const phone = uniquePhone();
      let spent = 0;
      for (let client = 1; spent < OTP_VERIFY_FAIL_PHONE_MAX; client += 1) {
        for (let n = 0; n < OTP_VERIFY_FAIL_CLIENT_MAX && spent < OTP_VERIFY_FAIL_PHONE_MAX; n += 1) {
          // Alternate the scope: guesses through either door count against the same phone.
          await guessWrong(spent % 2 === 0 ? societyId : 'admin-door', phone, `192.0.2.${client}`);
          spent += 1;
        }
      }
      await service.request('admin-door', phone, at('203.0.113.50'));
      expect(await service.verify('admin-door', phone, channel.lastCode as string, at('203.0.113.50'))).toBe('LOCKED');
    });

    it('a correct code costs nothing, and neither does verifying with no code outstanding', async () => {
      const phone = uniquePhone();
      await service.request(societyId, phone, at('198.51.100.7'));
      expect(await service.verify(societyId, phone, channel.lastCode as string, at('198.51.100.7'))).toBe('OK');
      expect(await service.verify(societyId, phone, '123456', at('198.51.100.7'))).toBe('EXPIRED');
      expect(await redis.get(`otp:verify-fail:${phone}`)).toBeNull();
    });
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
describe('OtpService dispatch modes (ADR-0023, ADR-0027)', () => {
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

  it('queued: never touches the provider, and hands the worker a SEALED code that verifies (CHORE-017)', async () => {
    const channel = new HangingChannel();
    const jobs: Array<{ name: string; data: OtpSendJobData; opts: Record<string, unknown> }> = [];
    const queue = {
      add: async (name: string, data: OtpSendJobData, opts: Record<string, unknown>) => {
        jobs.push({ name, data, opts });
      },
    } as unknown as Queue<OtpSendJobData>;
    const service = new OtpService(redis, channel, queue);
    const phone = freshPhone();

    const outcome = await service.request('queue-test', phone, { dispatch: 'queued' });

    expect(outcome.result).toBe('SENT');
    // The provider is not on the request path in any phase — not even deferred.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(channel.calls).toBe(0);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].data).toMatchObject({ door: 'admin', phone });
    const code = unsealOtp(jobs[0].data.sealed);
    expect(jobs[0].data.sealed).not.toContain(code);
    expect(await service.verify('queue-test', phone, code)).toBe('OK');
    // A job that exhausts its retries is deleted, not kept holding a sealed code.
    expect(jobs[0].opts).toMatchObject({ removeOnComplete: true, removeOnFail: true });
  });

  it('queued without a queue fails loudly rather than silently sending nothing', async () => {
    const service = new OtpService(redis, new HangingChannel());
    await expect(service.request('queue-missing', freshPhone(), { dispatch: 'queued' })).rejects.toThrow(
      /queue is not configured/,
    );
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

  // The provider-failure cases (a synchronous throw, an error that echoes the code, a
  // rejection) moved with the send: see otp-send.processor.spec.ts (CHORE-017).
});

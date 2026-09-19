import { createHmac, randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import {
  NOTIFICATION_CHANNEL,
  type NotificationChannel,
} from '../notifications/notification-channel';

/** Result of requesting an OTP. */
export type OtpRequestResult = 'SENT' | 'RATE_LIMITED';

/**
 * The OTP scope the admin door uses for EVERY caller (FEAT-012, ADR-0023).
 *
 * Not a society id. The resident path scopes its OTP by society because the invite
 * code names one; the admin path has no such input, and — more importantly — scoping
 * by the caller's own row would make the OTP state itself an oracle: a registered
 * number's key would exist where an unregistered one's does not, and `verify` would
 * answer EXPIRED for one and INVALID for the other. One scope for everyone means one
 * set of answers for everyone.
 */
export const ADMIN_OTP_SCOPE = 'admin-door';

/**
 * The outcome of an OTP request. The code itself is NEVER part of it (ADR-0020):
 * it leaves this service only through the notification channel.
 */
export interface OtpRequestOutcome {
  result: OtpRequestResult;
}

/**
 * DEV ONLY (CHORE-002 → CHORE-007, ADR-0016 → ADR-0020): may the raw OTP be exposed
 * for local clicking?
 *
 * The code no longer leaves this service through the API — `POST /auth/otp/request`
 * returns `{ requested: true }` and nothing else, so the production auth path holds
 * no bypass at all. This flag now only tells the STUB SMS channel whether to log the
 * code and stash it in a short-lived Redis key for the E2E harness. That adapter is
 * what a real provider replaces wholesale, so in production the affordance does not
 * exist rather than being switched off.
 *
 * Both conditions still apply, because the stub could in principle be bound in a
 * deployed environment by mistake.
 */
export function devOtpEchoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OTP_DEV_LOG === 'true' && env.NODE_ENV !== 'production';
}

/** Result of verifying an OTP. */
export type OtpVerifyResult = 'OK' | 'INVALID' | 'EXPIRED' | 'LOCKED';

/** OTP policy (ADR-0007 · spec resolved decisions). */
export const OTP_TTL_SECONDS = 5 * 60; // 5-min TTL
export const OTP_MAX_ATTEMPTS = 5; // lock after 5 failed verify attempts
export const OTP_RESEND_MIN_INTERVAL_SECONDS = 30; // max 1 / 30s
export const OTP_RESEND_HOURLY_MAX = 5; // max 5 / hour
const OTP_RESEND_HOUR_SECONDS = 60 * 60;

/**
 * Atomic hourly-resend counter: INCR, and set the TTL only on the first hit —
 * in one round-trip so a crash can never leave a non-expiring (permanent-lock)
 * key. Returns the new count.
 */
const RESEND_HOURLY_LUA = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return n`;

/**
 * Atomic verify: checks the stored hash, enforces the attempt cap, increments
 * on a miss, and consumes/locks the OTP — all in one round-trip so concurrent
 * verifies cannot slip extra guesses past the cap. Returns a status string.
 *   KEYS[1] = otp key · ARGV[1] = provided code hash · ARGV[2] = max attempts
 */
const VERIFY_LUA = `
local codeHash = redis.call('HGET', KEYS[1], 'codeHash')
if not codeHash then
  return 'EXPIRED'
end
local max = tonumber(ARGV[2])
local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
if attempts >= max then
  redis.call('DEL', KEYS[1])
  return 'LOCKED'
end
if codeHash == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 'OK'
end
local n = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if n >= max then
  redis.call('DEL', KEYS[1])
  return 'LOCKED'
end
return 'INVALID'`;

/**
 * Generates, stores, and verifies phone OTPs entirely in Redis (ADR-0007).
 *
 * - Only a keyed HASH of the code is stored — the raw code is never persisted,
 *   returned, or logged.
 * - Verify attempts are capped ({@link OTP_MAX_ATTEMPTS}) then the OTP is locked.
 * - Resend is rate-limited via atomic Redis counters (per scope+phone).
 * - The scope always comes from the caller's authenticated/invite context, or is a
 *   fixed server constant ({@link ADMIN_OTP_SCOPE}) — never raw client input (ADR-0003).
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {}

  private otpKey(scopeId: string, phone: string): string {
    return `otp:${scopeId}:${phone}`;
  }

  private resendIntervalKey(scopeId: string, phone: string): string {
    return `otp:resend:interval:${scopeId}:${phone}`;
  }

  private resendHourlyKey(scopeId: string, phone: string): string {
    return `otp:resend:hourly:${scopeId}:${phone}`;
  }

  // No hardcoded fallback — the OTP hashing secret comes from validated env only.
  private hash(code: string): string {
    const secret = process.env.OTP_HASH_SECRET;
    if (!secret) {
      throw new Error('OTP_HASH_SECRET is not configured.');
    }
    return createHmac('sha256', secret).update(code).digest('hex');
  }

  /**
   * Generate + store a 6-digit OTP and, unless told otherwise, dispatch it via the
   * notification channel. Enforces resend rate-limits atomically. Returns a result
   * enum — never the code.
   *
   * `scopeId` is a key namespace, normally a society id. `dispatch: false` runs every
   * other step unchanged — limiter, generation, storage — and simply does not send.
   * That is what lets the admin door treat an administrator and a stranger
   * identically in everything the caller can observe (ADR-0023): same rate-limit
   * consumption, so the second request inside 30s is 429 for both, and same stored
   * state, so `verify` cannot tell them apart either.
   */
  async request(
    scopeId: string,
    phone: string,
    options: { dispatch?: boolean } = {},
  ): Promise<OtpRequestOutcome> {
    // 1/30s window: SET NX with a 30s TTL. If the key already exists -> too soon.
    const intervalSet = await this.redis.set(
      this.resendIntervalKey(scopeId, phone),
      '1',
      'EX',
      OTP_RESEND_MIN_INTERVAL_SECONDS,
      'NX',
    );
    if (intervalSet === null) {
      return { result: 'RATE_LIMITED' };
    }

    // 5/hour window: atomic INCR + first-hit EXPIRE via a single Lua script.
    const hourlyCount = (await this.redis.eval(
      RESEND_HOURLY_LUA,
      1,
      this.resendHourlyKey(scopeId, phone),
      String(OTP_RESEND_HOUR_SECONDS),
    )) as number;
    if (hourlyCount > OTP_RESEND_HOURLY_MAX) {
      return { result: 'RATE_LIMITED' };
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const key = this.otpKey(scopeId, phone);
    await this.redis
      .multi()
      .del(key)
      .hset(key, { codeHash: this.hash(code), attempts: '0' })
      .expire(key, OTP_TTL_SECONDS)
      .exec();

    // Dispatch through the channel boundary. The raw code leaves this service ONLY
    // here: it is never returned to the caller and never logged (ADR-0020).
    if (options.dispatch ?? true) {
      await this.channel.sendOtp(phone, code);
    }
    return { result: 'SENT' };
  }

  /**
   * Verify a submitted code. Consumes the OTP on success; increments attempts
   * on failure and locks after {@link OTP_MAX_ATTEMPTS}.
   */
  async verify(scopeId: string, phone: string, code: string): Promise<OtpVerifyResult> {
    const status = (await this.redis.eval(
      VERIFY_LUA,
      1,
      this.otpKey(scopeId, phone),
      this.hash(code),
      String(OTP_MAX_ATTEMPTS),
    )) as string;
    return status as OtpVerifyResult;
  }
}

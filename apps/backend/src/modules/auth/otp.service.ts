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
 * The outcome of an OTP request. `devCode` is present ONLY under
 * {@link devOtpEchoEnabled} — see ADR-0016. In every real environment the caller
 * gets `{ result: 'SENT' }` and the code stays inside this service.
 */
export interface OtpRequestOutcome {
  result: OtpRequestResult;
  devCode?: string;
}

/**
 * DEV ONLY (CHORE-002, ADR-0016): may the raw OTP leave the server?
 *
 * TWO independent conditions, because `POST /auth/otp/request` is unauthenticated and
 * echoing the code there is a full auth bypass — anyone with an invite code and a
 * phone number could mint a token for that resident:
 *  1. `OTP_DEV_LOG === 'true'` — the explicit "this is a local box" opt-in; and
 *  2. `NODE_ENV !== 'production'` — so a flag mis-set in production still fails closed.
 *
 * This is the ONLY place that decision is made. It must be deleted before the first
 * real deployment (ADR-0016 revisit trigger).
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
 * - Resend is rate-limited via atomic Redis counters (per society+phone).
 * - `societyId` always comes from the caller's authenticated/invite context,
 *   never from raw client input (ADR-0003).
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {}

  private otpKey(societyId: string, phone: string): string {
    return `otp:${societyId}:${phone}`;
  }

  private resendIntervalKey(societyId: string, phone: string): string {
    return `otp:resend:interval:${societyId}:${phone}`;
  }

  private resendHourlyKey(societyId: string, phone: string): string {
    return `otp:resend:hourly:${societyId}:${phone}`;
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
   * Generate + store a 6-digit OTP and dispatch it via the notification channel.
   * Enforces resend rate-limits atomically. Returns a result enum — never the code.
   */
  async request(societyId: string, phone: string): Promise<OtpRequestOutcome> {
    // 1/30s window: SET NX with a 30s TTL. If the key already exists -> too soon.
    const intervalSet = await this.redis.set(
      this.resendIntervalKey(societyId, phone),
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
      this.resendHourlyKey(societyId, phone),
      String(OTP_RESEND_HOUR_SECONDS),
    )) as number;
    if (hourlyCount > OTP_RESEND_HOURLY_MAX) {
      return { result: 'RATE_LIMITED' };
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const key = this.otpKey(societyId, phone);
    await this.redis
      .multi()
      .del(key)
      .hset(key, { codeHash: this.hash(code), attempts: '0' })
      .expire(key, OTP_TTL_SECONDS)
      .exec();

    // Dispatch through the channel boundary. The raw code leaves this service ONLY
    // here — and, in local development only, through the ADR-0016 dev echo below.
    await this.channel.sendOtp(phone, code);
    return devOtpEchoEnabled() ? { result: 'SENT', devCode: code } : { result: 'SENT' };
  }

  /**
   * Verify a submitted code. Consumes the OTP on success; increments attempts
   * on failure and locks after {@link OTP_MAX_ATTEMPTS}.
   */
  async verify(societyId: string, phone: string, code: string): Promise<OtpVerifyResult> {
    const status = (await this.redis.eval(
      VERIFY_LUA,
      1,
      this.otpKey(societyId, phone),
      this.hash(code),
      String(OTP_MAX_ATTEMPTS),
    )) as string;
    return status as OtpVerifyResult;
  }
}

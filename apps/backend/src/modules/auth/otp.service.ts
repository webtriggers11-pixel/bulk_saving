import { createHmac, randomInt } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { RedisService } from '../../redis/redis.service';
import {
  NOTIFICATION_CHANNEL,
  type NotificationChannel,
} from '../notifications/notification-channel';
import { sealOtp } from './otp-seal';
import {
  OTP_SEND_ATTEMPTS,
  OTP_SEND_JOB,
  OTP_SEND_QUEUE,
  type OtpSendJobData,
} from './otp-send.processor';

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
 * deployed environment by mistake — and since FEAT-026 the NODE_ENV condition is an
 * explicit `development`/`test`, never "anything but production".
 */
export function devOtpEchoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  // Default CLOSED (FEAT-026 V2): an unset NODE_ENV is not "development" — a platform build
  // that forgot it must not get the echo, the stash or the dev route.
  return env.OTP_DEV_LOG === 'true' && (env.NODE_ENV === 'development' || env.NODE_ENV === 'test');
}

/**
 * DEV ONLY (CHORE-026, ADR-0040): the fixed OTP every resident and admin gets locally,
 * or null for a random one.
 *
 * `OTP_DEV_FIXED_CODE` (4–6 digits, e.g. `1111`) applies ONLY when NODE_ENV is exactly
 * `development` — not `test`, so the suites keep exercising random codes, and not unset,
 * same default-closed rule as {@link devOtpEchoEnabled}. Production refuses the variable
 * at boot (`assertProductionSafe`).
 */
export function devFixedOtp(env: NodeJS.ProcessEnv = process.env): string | null {
  const code = env.OTP_DEV_FIXED_CODE?.trim();
  if (env.NODE_ENV !== 'development' || !code || !/^\d{4,6}$/.test(code)) return null;
  return code;
}

/** Result of verifying an OTP. */
export type OtpVerifyResult = 'OK' | 'INVALID' | 'EXPIRED' | 'LOCKED';

/** OTP policy (ADR-0007 · spec resolved decisions). */
export const OTP_TTL_SECONDS = 5 * 60; // 5-min TTL
export const OTP_MAX_ATTEMPTS = 5; // lock after 5 failed verify attempts
export const OTP_RESEND_MIN_INTERVAL_SECONDS = 30; // max 1 / 30s, per (phone, client)
export const OTP_RESEND_HOURLY_MAX = 5; // max 5 / hour, per (phone, client)
/**
 * Max codes per phone per hour across ALL clients (CHORE-016, ADR-0027). The per-client
 * budgets above stop one machine locking an owner out; this caps what rotating clients
 * can buy — SMS cost, and the number of codes a brute-forcer gets to guess against.
 */
export const OTP_RESEND_PHONE_HOURLY_MAX = 10;
/**
 * Wrong codes per hour, per DOOR (scope) — ADR-0027. 10 per (scope, phone, client): two
 * codes' worth of OTP_MAX_ATTEMPTS, so a person who fat-fingers one code can request
 * another and try again, and one address cannot lock the owner out; 20 per (scope, phone),
 * which caps a multi-address guesser.
 *
 * Per door on purpose. The first version shared the phone budget across scopes (an
 * administrator is reachable through two doors), and that let anyone holding ANY invite
 * code lock any phone out of every door in every society (V2 round 2, P1). Per door, a
 * society's guesses can only ever lock that society's account for that phone.
 */
export const OTP_VERIFY_FAIL_CLIENT_MAX = 10;
export const OTP_VERIFY_FAIL_PHONE_MAX = 20;
const OTP_RESEND_HOUR_SECONDS = 60 * 60;

/**
 * The rate-limit bucket for a client address (CHORE-016). IPv4 as is (an IPv4-mapped
 * IPv6 address is the IPv4 address); IPv6 by its /64, because a single subscriber is
 * routinely handed a whole /64 and can rotate within it for free. A missing address —
 * no socket, or a misconfigured proxy — falls into one shared bucket, which degrades to
 * the old per-phone behaviour rather than to no limit at all.
 */
export function ipBucket(ip: string | undefined): string {
  let raw = (ip ?? '').trim().toLowerCase();
  if (raw === '') {
    return 'unknown';
  }
  // A proxy may append a port (`1.2.3.4:5678`, `[v6]:443`); without stripping it every
  // source port would be a fresh budget (ADR-0027 V2).
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(raw);
  if (bracketed) {
    raw = bracketed[1];
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(raw)) {
    raw = raw.slice(0, raw.lastIndexOf(':'));
  }
  raw = raw.replace(/%.*$/, ''); // an IPv6 zone id names an interface, not a client
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(raw);
  if (mapped) {
    return mapped[1];
  }
  if (!raw.includes(':')) {
    return raw;
  }
  // Expand `::` so the first four hextets are the /64.
  const [head, tail = ''] = raw.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const full = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${full.slice(0, 4).map((h) => h.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

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
 * Budgeted verify (ADR-0027): the budget check, the code check and the counting of a
 * wrong guess in ONE script, so concurrent guesses cannot slip past the cap between a
 * check and its increment (they did: 20 parallel guesses at 19/20 left the counter at 24 —
 * V2 round 2, P2). The code check is the original atomic verify (ADR-0007): the stored
 * hash, the attempt cap, consume on success, lock on the last miss.
 *   KEYS[1] otp key · KEYS[2] client fail key · KEYS[3] phone fail key
 *   ARGV[1] code hash · ARGV[2] max attempts · ARGV[3] client max · ARGV[4] phone max · ARGV[5] window s
 */
const BUDGETED_VERIFY_LUA = `
if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[3])
  or tonumber(redis.call('GET', KEYS[3]) or '0') >= tonumber(ARGV[4]) then
  return 'LOCKED'
end
local codeHash = redis.call('HGET', KEYS[1], 'codeHash')
if not codeHash then
  return 'EXPIRED'
end
local max = tonumber(ARGV[2])
local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
local result
if attempts >= max then
  redis.call('DEL', KEYS[1])
  result = 'LOCKED'
elseif codeHash == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 'OK'
else
  local n = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
  if n >= max then
    redis.call('DEL', KEYS[1])
    result = 'LOCKED'
  else
    result = 'INVALID'
  end
end
for i = 2, 3 do
  if redis.call('INCR', KEYS[i]) == 1 then
    redis.call('EXPIRE', KEYS[i], ARGV[5])
  end
end
return result`;

/**
 * Generates, stores, and verifies phone OTPs entirely in Redis (ADR-0007).
 *
 * - Only a keyed HASH of the code is stored — the raw code is never persisted,
 *   returned, or logged.
 * - Verify attempts are capped ({@link OTP_MAX_ATTEMPTS}) then the OTP is locked.
 * - Resend is rate-limited via atomic Redis counters: per scope+phone+client, under a
 *   per scope+phone ceiling (CHORE-016, ADR-0027).
 * - The scope always comes from the caller's authenticated/invite context, or is a
 *   fixed server constant ({@link ADMIN_OTP_SCOPE}) — never raw client input (ADR-0003).
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
    // Optional so the Redis-only unit spec can build the service without a queue; the
    // app always provides it (AuthModule registers OTP_SEND_QUEUE).
    @Optional() @InjectQueue(OTP_SEND_QUEUE) private readonly sendQueue?: Queue<OtpSendJobData>,
  ) {}

  private otpKey(scopeId: string, phone: string): string {
    return `otp:${scopeId}:${phone}`;
  }

  private resendIntervalKey(scopeId: string, phone: string, client: string): string {
    return `otp:resend:interval:${scopeId}:${phone}:${client}`;
  }

  private resendHourlyKey(scopeId: string, phone: string, client: string): string {
    return `otp:resend:hourly:${scopeId}:${phone}:${client}`;
  }

  private resendCeilingKey(scopeId: string, phone: string): string {
    return `otp:resend:ceiling:${scopeId}:${phone}`;
  }

  // Per door (scope) — never shared across scopes; see OTP_VERIFY_FAIL_* (ADR-0027).
  private verifyFailClientKey(scopeId: string, phone: string, client: string): string {
    return `otp:verify-fail:${scopeId}:${phone}:${client}`;
  }

  private verifyFailPhoneKey(scopeId: string, phone: string): string {
    return `otp:verify-fail:${scopeId}:${phone}`;
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
   *
   * `scopeId` is a key namespace, normally a society id.
   *
   * `dispatch` decides what happens to the send:
   *  - `'awaited'` — the resident door. The send completes before the response, which is
   *    what makes a provider outage visible to the resident at all; that door has nothing
   *    to hide (its latency varies only with invite-code validity, which its 400-vs-200
   *    already discloses).
   *  - `'queued'` — the admin door (CHORE-017, ADR-0027). The code is sealed into a job on
   *    the send queue for EVERY caller, and the worker decides whether this number is an
   *    administrator and should get it. The request path is then identical for everyone:
   *    the provider is never touched here, in any phase, so neither its latency, its
   *    synchronous prefix nor its failures can reach the caller — the three mechanisms
   *    ADR-0023's review rounds closed one at a time. And a queued send survives a restart,
   *    which the earlier `setImmediate` send did not.
   *  - `'suppressed'` — nothing is sent; every other step still runs.
   */
  async request(
    scopeId: string,
    phone: string,
    options: { dispatch?: 'awaited' | 'queued' | 'suppressed'; clientIp?: string } = {},
  ): Promise<OtpRequestOutcome> {
    // CHORE-016 (ADR-0027): the interval and hourly budgets are per (phone, client), so
    // one machine cannot spend an owner's budget; the ceiling below is per phone. Every
    // caller takes every step, whatever their role — the limiter must not become the
    // oracle ADR-0023 closed.
    const client = ipBucket(options.clientIp);

    // 1/30s window: SET NX with a 30s TTL. If the key already exists -> too soon.
    const intervalSet = await this.redis.set(
      this.resendIntervalKey(scopeId, phone, client),
      '1',
      'EX',
      OTP_RESEND_MIN_INTERVAL_SECONDS,
      'NX',
    );
    if (intervalSet === null) {
      return { result: 'RATE_LIMITED' };
    }

    // 5/hour per client: atomic INCR + first-hit EXPIRE via a single Lua script.
    const hourlyCount = (await this.redis.eval(
      RESEND_HOURLY_LUA,
      1,
      this.resendHourlyKey(scopeId, phone, client),
      String(OTP_RESEND_HOUR_SECONDS),
    )) as number;
    if (hourlyCount > OTP_RESEND_HOURLY_MAX) {
      return { result: 'RATE_LIMITED' };
    }

    // 10/hour per phone across every client. Counted only for requests the per-client
    // budgets let through, so a client hammering inside its own 30s window cannot spend
    // the owner's ceiling.
    const phoneCount = (await this.redis.eval(
      RESEND_HOURLY_LUA,
      1,
      this.resendCeilingKey(scopeId, phone),
      String(OTP_RESEND_HOUR_SECONDS),
    )) as number;
    if (phoneCount > OTP_RESEND_PHONE_HOURLY_MAX) {
      return { result: 'RATE_LIMITED' };
    }

    const code = devFixedOtp() ?? randomInt(0, 1_000_000).toString().padStart(6, '0');
    const key = this.otpKey(scopeId, phone);
    await this.redis
      .multi()
      .del(key)
      .hset(key, { codeHash: this.hash(code), attempts: '0' })
      .expire(key, OTP_TTL_SECONDS)
      .exec();

    // Dispatch through the channel boundary. The raw code leaves this service ONLY
    // here: it is never returned to the caller and never logged (ADR-0020).
    const dispatch = options.dispatch ?? 'awaited';
    if (dispatch === 'awaited') {
      await this.channel.sendOtp(phone, code);
    } else if (dispatch === 'queued') {
      if (!this.sendQueue) {
        throw new Error('OTP send queue is not configured.');
      }
      // Sealed, never in the clear: the job lives in Redis until the worker runs.
      // removeOnFail: true — a job that exhausted its retries is deleted, not kept
      // around holding a (sealed) code for the default retention window.
      await this.sendQueue.add(
        OTP_SEND_JOB,
        { door: 'admin', phone, sealed: sealOtp(code) },
        {
          attempts: OTP_SEND_ATTEMPTS,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }
    return { result: 'SENT' };
  }

  /**
   * Verify a submitted code. Consumes the OTP on success; increments attempts
   * on failure and locks after {@link OTP_MAX_ATTEMPTS}.
   */
  async verify(
    scopeId: string,
    phone: string,
    code: string,
    options: { clientIp?: string } = {},
  ): Promise<OtpVerifyResult> {
    // ADR-0027: a spent guess budget refuses BEFORE the code is looked at — a correct
    // code included, or it would not be a cap. The answer is LOCKED either way, and the
    // budgets are the same for every caller, so this says nothing about who owns the
    // phone. A wrong guess spends both budgets; a right one, or a verify with no code
    // outstanding (nothing to guess against), spends nothing. All in one atomic script.
    const client = ipBucket(options.clientIp);
    return (await this.redis.eval(
      BUDGETED_VERIFY_LUA,
      3,
      this.otpKey(scopeId, phone),
      this.verifyFailClientKey(scopeId, phone, client),
      this.verifyFailPhoneKey(scopeId, phone),
      this.hash(code),
      String(OTP_MAX_ATTEMPTS),
      String(OTP_VERIFY_FAIL_CLIENT_MAX),
      String(OTP_VERIFY_FAIL_PHONE_MAX),
      String(OTP_RESEND_HOUR_SECONDS),
    )) as OtpVerifyResult;
  }
}

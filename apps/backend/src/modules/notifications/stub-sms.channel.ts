import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { devOtpEchoEnabled } from '../auth/otp.service';
import { NotificationChannel, redactPhone } from './notification-channel';

/** Redis key holding the last OTP sent to a phone. DEV ONLY — see below. */
export function devOtpKey(phone: string): string {
  return `dev:last-otp:${phone}`;
}

/** How long the dev copy of an OTP survives. Shorter than the OTP's own TTL. */
export const DEV_OTP_TTL_SECONDS = 120;

/**
 * v1 stub SMS adapter. Does NOT really send — it logs a redacted line so dev can see
 * delivery happened.
 *
 * It is also the ONLY place the raw OTP is exposed for local development
 * (CHORE-007, ADR-0020). Both the debug log line and the short-lived Redis copy are
 * gated on {@link devOtpEchoEnabled} (`OTP_DEV_LOG=true` AND NODE_ENV explicitly development/test).
 *
 * Why here rather than on the API response, where CHORE-002 first put it: this
 * adapter is what a real SMS provider REPLACES. In production the binding in
 * `NotificationsModule` points at that provider, so this affordance does not exist
 * at all — rather than existing and being switched off by an environment variable in
 * the middle of the auth path. `POST /auth/otp/request` now returns
 * `{ requested: true }` and nothing else, in every environment.
 *
 * The E2E harness (`scripts/e2e-smoke.mjs`) reads the Redis key to log in.
 */
@Injectable()
export class StubSmsChannel implements NotificationChannel {
  private readonly logger = new Logger(StubSmsChannel.name);

  constructor(private readonly redis: RedisService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP sent to ${redactPhone(phone)}`);
    if (devOtpEchoEnabled()) {
      // DEV ONLY — never reachable in production, where this class is not bound.
      this.logger.debug(`[DEV ONLY] OTP for ${redactPhone(phone)} is ${code}`);
      await this.redis.set(devOtpKey(phone), code, 'EX', DEV_OTP_TTL_SECONDS);
    }
  }

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`SMS sent to ${redactPhone(to)}: ${message}`);
    return Promise.resolve();
  }
}

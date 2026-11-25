import { Logger } from '@nestjs/common';
import type { RedisService } from '../../redis/redis.service';
import { devOtpEchoEnabled } from '../auth/otp.service';
import { NotificationChannel, redactPhone } from './notification-channel';
import { DEV_OTP_TTL_SECONDS, devOtpKey } from './stub-sms.channel';
import type { TextbeeConfig } from './textbee.config';

/** How long one send may take before it counts as failed (BullMQ then retries). */
export const TEXTBEE_TIMEOUT_MS = 10_000;

/**
 * The OTP body (CHORE-028, ADR-0056). Worded as a friendly sign-in prompt with the
 * code split `482-913`: Airtel refused every classic "<code> is your … code. Do not
 * share it" text from the gateway SIM, while this exact wording was delivered.
 */
export function otpMessage(code: string): string {
  const shown = code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
  return `Hi, welcome to BulkSaving. Please enter ${shown} in the app to sign in.`;
}

type FetchFn = typeof fetch;

/**
 * Real SMS through the TextBee gateway (FEAT-046, ADR-0054) —
 * `POST {baseUrl}/gateway/send-sms` with the `x-api-key` header.
 *
 * A non-2xx answer or a network error THROWS, so the callers' BullMQ retries
 * (OTP send queue, notification outbox) handle it. The error never carries the
 * response body or the message: a gateway may echo the request back, and the
 * request holds the OTP.
 */
export class TextbeeSmsChannel implements NotificationChannel {
  private readonly logger = new Logger(TextbeeSmsChannel.name);

  constructor(
    private readonly config: TextbeeConfig,
    private readonly redis: RedisService,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    await this.deliver(phone, otpMessage(code));
    this.logger.log(`OTP sent to ${redactPhone(phone)} via TextBee`);
    if (devOtpEchoEnabled()) {
      // DEV ONLY (ADR-0037): keep the local toast working while real SMS is on.
      await this.redis.set(devOtpKey(phone), code, 'EX', DEV_OTP_TTL_SECONDS);
    }
  }

  async send(to: string, message: string): Promise<void> {
    await this.deliver(to, message);
    this.logger.log(`SMS sent to ${redactPhone(to)} via TextBee`);
  }

  private async deliver(to: string, message: string): Promise<void> {
    const body: Record<string, unknown> = {
      deviceId: this.config.deviceId,
      recipients: [to],
      message,
    };
    if (this.config.simSlotIndex !== null) {
      body.simSlotIndex = this.config.simSlotIndex;
    }
    let res: Response;
    try {
      res = await this.fetchFn(`${this.config.baseUrl}/gateway/send-sms`, {
        method: 'POST',
        headers: { 'x-api-key': this.config.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TEXTBEE_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.name : 'unknown error';
      throw new Error(`TextBee send to ${redactPhone(to)} failed: ${reason}`);
    }
    if (!res.ok) {
      throw new Error(`TextBee send to ${redactPhone(to)} failed: HTTP ${res.status}`);
    }
  }
}

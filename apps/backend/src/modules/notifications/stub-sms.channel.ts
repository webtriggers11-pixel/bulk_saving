import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, redactPhone } from './notification-channel';

/**
 * v1 stub SMS adapter. Does NOT really send — it logs a redacted line so dev
 * can see delivery happened. The raw OTP is NEVER logged by default; it is only
 * printed behind an explicit, clearly-marked DEV-only flag (`OTP_DEV_LOG=true`)
 * for local end-to-end clicking. Production must leave that flag off.
 */
@Injectable()
export class StubSmsChannel implements NotificationChannel {
  private readonly logger = new Logger(StubSmsChannel.name);

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP sent to ${redactPhone(phone)}`);
    if (process.env.OTP_DEV_LOG === 'true') {
      // DEV ONLY — never enable outside local development.
      this.logger.debug(`[DEV ONLY] OTP for ${redactPhone(phone)} is ${code}`);
    }
    return Promise.resolve();
  }

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`SMS sent to ${redactPhone(to)}: ${message}`);
    return Promise.resolve();
  }
}

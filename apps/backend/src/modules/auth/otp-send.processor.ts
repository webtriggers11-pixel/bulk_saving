import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { NOTIFICATION_CHANNEL, type NotificationChannel, redactPhone } from '../notifications/notification-channel';
import { ResidentsService } from '../residents/residents.service';
import { unsealOtp } from './otp-seal';

/** The admin door's OTP send queue (CHORE-017, ADR-0027). */
export const OTP_SEND_QUEUE = 'otp-send';
export const OTP_SEND_JOB = 'send-otp';
export const OTP_SEND_ATTEMPTS = 3;

/** A queued send. The code travels sealed (see otp-seal.ts), never in the clear. */
export interface OtpSendJobData {
  door: 'admin';
  phone: string;
  sealed: string;
}

/**
 * Delivers the admin door's codes, off the request path entirely (CHORE-017).
 *
 * The request enqueues a job for EVERY caller — administrator, resident or stranger —
 * so what the request does cannot differ by role in status, body, stored state or time.
 * The one decision that differs, "is this an administrator, so should it be sent?", is
 * made HERE, after the response has gone. That is ADR-0023's rule ("the only thing that
 * varies is whether the SMS is dispatched") moved to where the caller cannot see it.
 *
 * A provider failure — thrown synchronously or not — is rethrown for BullMQ's retry, with
 * the code redacted from the message first, because BullMQ stores `failedReason` in
 * Redis and a provider SDK may echo the request body back.
 */
@Processor(OTP_SEND_QUEUE)
export class OtpSendProcessor extends WorkerHost {
  private readonly logger = new Logger(OtpSendProcessor.name);

  constructor(
    private readonly residents: ResidentsService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {
    super();
  }

  /**
   * Resolves to nothing on purpose: BullMQ copies a job's return value into the queue's
   * events stream, which outlives the job — `{ sent: true | false }` there would tell a
   * Redis reader which numbers were administrators' (ADR-0027 V2).
   */
  async process(job: Job<OtpSendJobData>): Promise<void> {
    const { phone, sealed } = job.data;
    const admin = await this.residents.findAdminByPhone(phone);
    if (!admin) {
      // Generated, stored, and sent nowhere — exactly as before, but decided here.
      return;
    }
    const code = unsealOtp(sealed);
    try {
      await this.channel.sendOtp(phone, code);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const redacted = raw.split(code).join('******');
      this.logger.warn(`OTP dispatch to ${redactPhone(phone)} failed: ${redacted}`);
      throw new Error(redacted);
    }
  }
}

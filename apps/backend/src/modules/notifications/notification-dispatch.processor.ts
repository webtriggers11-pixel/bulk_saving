import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { NOTIFICATION_CHANNEL, type NotificationChannel, redactPhone } from './notification-channel';
import {
  NOTIFICATIONS_QUEUE,
  type NotificationJobData,
  NotificationsService,
} from './notifications.service';
import { PushService } from '../push/push.service';

/** What the processor reports back: whether it actually sent, and why not if it did not. */
export interface NotificationSendResult {
  sent: boolean;
  reason?: 'not-found' | 'already-terminal';
}

/**
 * Delivers one staged notification (FEAT-006, ADR-0013). The ONLY place a
 * lifecycle message reaches {@link NotificationChannel} — OTPs go direct and
 * never pass through here.
 *
 * Safety properties:
 *  - a row that is no longer PENDING is skipped, so a duplicate job can never
 *    double-send;
 *  - a missing row is retried (it may have been dispatched moments before its
 *    transaction became visible) and only accepted as gone on the final attempt;
 *  - a send failure records the attempt, moves the row to FAILED on the final
 *    attempt, and rethrows so BullMQ's backoff does the retrying.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDispatchProcessor.name);

  constructor(
    private readonly notifications: NotificationsService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
    private readonly push: PushService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<NotificationSendResult> {
    const { notificationId } = job.data;
    const attempts = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = attempts >= maxAttempts;

    const notification = await this.notifications.findForSend(notificationId);
    if (!notification) {
      if (!isFinalAttempt) {
        throw new Error(`Notification ${notificationId} not found (yet); retrying`);
      }
      this.logger.warn(`Notification ${notificationId} → no-op (row not found)`);
      return { sent: false, reason: 'not-found' };
    }
    if (notification.status !== NotificationStatus.PENDING) {
      // Already SENT (a duplicate job) or FAILED — never send twice.
      return { sent: false, reason: 'already-terminal' };
    }

    // FEAT-020 (ADR-0032): queue the push for each of the resident's devices FIRST, so a
    // failing SMS provider cannot hold push back — and never let push hold SMS back either:
    // a fan-out fault is logged and the SMS still goes (V2 P2). `fanOut` claims the row once,
    // so a retry of this job after an SMS failure does not push twice.
    try {
      await this.push.fanOut(notification);
    } catch (err) {
      this.logger.warn(
        `Push fan-out for ${notificationId} failed; SMS continues: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    try {
      await this.channel.send(notification.resident.phone, notification.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.notifications.recordAttemptFailure(
        notificationId,
        attempts,
        message,
        isFinalAttempt,
      );
      this.logger.warn(
        `Notification ${notificationId} (${notification.type}) to ${redactPhone(
          notification.resident.phone,
        )} failed on attempt ${attempts}/${maxAttempts}: ${message}`,
      );
      throw err;
    }

    const marked = await this.notifications.markSent(notificationId, attempts);
    this.logger.log(
      `Notification ${notificationId} (${notification.type}) → ${
        marked ? 'SENT' : 'already terminal'
      } for ${redactPhone(notification.resident.phone)}`,
    );
    return { sent: marked, ...(marked ? {} : { reason: 'already-terminal' as const }) };
  }
}

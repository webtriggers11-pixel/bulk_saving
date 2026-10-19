import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ACCENTS, type Accent } from '@bulk/shared';
import type { Job } from 'bullmq';
import { PUSH_SENDER, PushGoneError, type PushSender, redactEndpoint } from './push-sender';
import { pushFor, PUSH_TTL_SECONDS } from './push-templates';
import { PUSH_QUEUE, type PushJobData, PushService } from './push.service';

/** Parallel sends per worker process; scale out by running more processes (ADR-0032). */
const CONCURRENCY = Number(process.env.PUSH_CONCURRENCY) || 20;
/** A ceiling across ALL workers sharing this Redis, so a burst cannot trip push-service limits. */
const RATE_PER_SECOND = Number(process.env.PUSH_RATE_PER_SECOND) || 200;

export type PushSendResult = 'sent' | 'device-gone' | 'no-device' | 'no-notification' | 'disabled';

/**
 * Delivers one push to one device (FEAT-020, ADR-0032).
 *
 *  - The device or notification may have gone since fan-out (pruned, cascaded) → no-op.
 *  - 404/410 from the push service → the device is deleted, the job succeeds (no retry).
 *  - Any other failure → rethrown so BullMQ backs off and retries; on the FINAL attempt the
 *    device's failure streak grows, and a device that fails three jobs in a row is pruned.
 *  - Success resets the streak.
 *
 * Nothing about the device is logged beyond the push service host and a short suffix.
 */
@Processor(PUSH_QUEUE, { concurrency: CONCURRENCY, limiter: { max: RATE_PER_SECOND, duration: 1_000 } })
export class PushSendProcessor extends WorkerHost {
  private readonly logger = new Logger(PushSendProcessor.name);

  constructor(
    private readonly push: PushService,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {
    super();
  }

  async process(job: Job<PushJobData>): Promise<PushSendResult> {
    if (!this.sender.enabled) return 'disabled';
    const { notificationId, subscriptionId } = job.data;
    const [device, notification] = await Promise.all([
      this.push.findDevice(subscriptionId),
      this.push.findNotification(notificationId),
    ]);
    if (!device) return 'no-device';
    if (!notification) return 'no-notification';

    const accent: Accent = (ACCENTS as readonly string[]).includes(device.accent) ? (device.accent as Accent) : 'mono';
    const { payload, urgency } = pushFor(notification, accent);
    try {
      await this.sender.send(device, JSON.stringify(payload), { ttlSeconds: PUSH_TTL_SECONDS, urgency });
    } catch (err) {
      if (err instanceof PushGoneError) {
        await this.push.forget(device.id);
        this.logger.log(`Push device ${redactEndpoint(device.endpoint)} gone (${err.statusCode}) — removed`);
        return 'device-gone';
      }
      const attempts = job.attemptsMade + 1;
      if (attempts >= (job.opts.attempts ?? 1)) {
        await this.push.recordFinalFailure(device.id);
      }
      this.logger.warn(
        `Push ${notificationId} to ${redactEndpoint(device.endpoint)} failed (attempt ${attempts}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err;
    }
    await this.push.recordSuccess(device.id);
    return 'sent';
  }
}

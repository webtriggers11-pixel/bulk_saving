import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PushSubscribeBody } from '@bulk/shared';
import type { Notification, PushSubscription } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { PUSH_SENDER, type PushSender } from './push-sender';

/** BullMQ queue carrying one job per (notification, device) (FEAT-020, ADR-0032). */
export const PUSH_QUEUE = 'push-send';
export const PUSH_SEND_ATTEMPTS = 5;
/** Devices whose pushes fail this many jobs in a row (not 404/410 — those go at once) are pruned. */
export const MAX_CONSECUTIVE_FAILURES = 3;

export interface PushJobData {
  notificationId: string;
  subscriptionId: string;
}

/**
 * The deterministic job id: a retried fan-out can never queue a device twice. `_`, not `:`
 * — BullMQ refuses a custom id containing `:`, and that refusal failed the whole outbox job,
 * SMS included (caught by push.integration.spec). Both parts are cuids, which have no `_`.
 */
export function pushJobId(notificationId: string, subscriptionId: string): string {
  return `${notificationId}_${subscriptionId}`;
}

/**
 * Push subscriptions and fan-out (FEAT-020, ADR-0032).
 *
 * Tenancy (ADR-0003): a subscription is written with the resident and society from the
 * caller's JWT, never from the body. An endpoint is a capability held by one browser, so
 * re-subscribing the same endpoint from a different signed-in resident (a shared phone)
 * moves it to that resident rather than duplicating it.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PUSH_QUEUE) private readonly queue: Queue<PushJobData>,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  get enabled(): boolean {
    return this.sender.enabled;
  }

  get publicKey(): string | null {
    return this.sender.publicKey;
  }

  async subscribe(
    residentId: string,
    societyId: string,
    body: PushSubscribeBody,
    userAgent: string | undefined,
  ): Promise<void> {
    // Stored normalised (WHATWG serialisation): the URL we validated is the URL we send to,
    // whatever another parser would make of the raw string (V2 P3).
    const endpoint = new URL(body.endpoint).href;
    const data = {
      residentId,
      societyId,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      accent: body.accent,
      userAgent: userAgent?.slice(0, 200) ?? null,
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, ...data },
      // A fresh subscribe is a fresh start: forget earlier failures.
      update: { ...data, consecutiveFailures: 0 },
    });
  }

  /** Forget a device — only if it is the caller's (another resident's row is left alone). */
  async unsubscribe(residentId: string, endpoint: string): Promise<void> {
    let normalised = endpoint;
    try {
      normalised = new URL(endpoint).href;
    } catch {
      // Not a URL: nothing stored could match it anyway.
    }
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint: normalised, residentId } });
  }

  /**
   * Queue one push per device the notification's resident has — ONCE per notification.
   *
   * The once is a claim on the Notification row (`pushQueuedAt`, set only where it is
   * null), not the BullMQ job id: a completed job is evicted after a while, and a dispatch
   * retried during an SMS outage (or re-run by the boot reconciler) would then queue the
   * same pushes again (V2 P1). The job id still dedupes within one fan-out. If queueing
   * fails after the claim, the claim is released so the next dispatch attempt can retry.
   * No devices, or push switched off → nothing queued.
   */
  async fanOut(notification: Pick<Notification, 'id' | 'residentId'>): Promise<number> {
    if (!this.sender.enabled) return 0;
    const { count: claimed } = await this.prisma.notification.updateMany({
      where: { id: notification.id, pushQueuedAt: null },
      data: { pushQueuedAt: new Date() },
    });
    if (claimed === 0) return 0;
    let devices: Array<{ id: string }>;
    try {
      // Inside the try: if reading the devices fails, the claim is released too (V2 r2 P2).
      devices = await this.prisma.pushSubscription.findMany({
        where: { residentId: notification.residentId },
        select: { id: true },
      });
      if (devices.length === 0) return 0;
      await this.queue.addBulk(
      devices.map((device) => ({
        name: 'send',
        data: { notificationId: notification.id, subscriptionId: device.id },
        opts: {
          jobId: pushJobId(notification.id, device.id),
          attempts: PUSH_SEND_ATTEMPTS,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 24 * 60 * 60, count: 50_000 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      })),
    );
    } catch (err) {
      await this.prisma.notification.updateMany({ where: { id: notification.id }, data: { pushQueuedAt: null } });
      throw err;
    }
    return devices.length;
  }

  findDevice(id: string): Promise<PushSubscription | null> {
    return this.prisma.pushSubscription.findUnique({ where: { id } });
  }

  findNotification(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async recordSuccess(id: string): Promise<void> {
    await this.prisma.pushSubscription.updateMany({
      where: { id },
      data: { consecutiveFailures: 0, lastSuccessAt: new Date() },
    });
  }

  /** The push service says the device is gone: delete it now. */
  async forget(id: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { id } });
  }

  /** A job failed for good; after {@link MAX_CONSECUTIVE_FAILURES} in a row the device goes. */
  async recordFinalFailure(id: string): Promise<'kept' | 'pruned'> {
    const updated = await this.prisma.pushSubscription.updateMany({
      where: { id },
      data: { consecutiveFailures: { increment: 1 } },
    });
    if (updated.count === 0) return 'pruned';
    const { count } = await this.prisma.pushSubscription.deleteMany({
      where: { id, consecutiveFailures: { gte: MAX_CONSECUTIVE_FAILURES } },
    });
    if (count > 0) this.logger.warn(`Push device ${id} pruned after ${MAX_CONSECUTIVE_FAILURES} failed pushes`);
    return count > 0 ? 'pruned' : 'kept';
  }

}

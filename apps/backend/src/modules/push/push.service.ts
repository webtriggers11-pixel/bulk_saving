import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Accent, PushSubscribeBody } from '@bulk/shared';
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
    const data = {
      residentId,
      societyId,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      accent: body.accent,
      userAgent: userAgent?.slice(0, 200) ?? null,
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: { endpoint: body.endpoint, ...data },
      // A fresh subscribe is a fresh start: forget earlier failures.
      update: { ...data, consecutiveFailures: 0 },
    });
  }

  /** Forget a device — only if it is the caller's (another resident's row is left alone). */
  async unsubscribe(residentId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, residentId } });
  }

  /**
   * Queue one push per device the notification's resident has. Idempotent: the job id is
   * (notification, device), so the outbox retrying its dispatch job adds nothing new.
   * No devices, or push switched off → nothing queued.
   */
  async fanOut(notification: Pick<Notification, 'id' | 'residentId'>): Promise<number> {
    if (!this.sender.enabled) return 0;
    const devices = await this.prisma.pushSubscription.findMany({
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
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      })),
    );
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

  /** Update the colour a device's pushes are styled in (it changed accent in Appearance). */
  async setAccent(residentId: string, endpoint: string, accent: Accent): Promise<void> {
    await this.prisma.pushSubscription.updateMany({ where: { endpoint, residentId }, data: { accent } });
  }
}

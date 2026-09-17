import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { type Notification, NotificationStatus, type NotificationType, type Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

/** BullMQ queue carrying one send job per staged notification (FEAT-006, ADR-0013). */
export const NOTIFICATIONS_QUEUE = 'notifications';

/** The job name under which send jobs are added. */
export const NOTIFICATION_SEND_JOB = 'send-notification';

/** Payload of a send job — just the outbox row to deliver. */
export interface NotificationJobData {
  notificationId: string;
}

/** Send retries: a transient provider/Redis error must not drop a message. */
export const NOTIFICATION_SEND_ATTEMPTS = 5;

/**
 * How stale a PENDING row may be and still be worth sending. Bodies are rendered
 * at stage time (ADR-0013), so a row recovered after a long outage would text
 * "the round closes 16 Sep" about a round that closed days ago. One reminder
 * lead is the natural cutoff: anything older is no longer news.
 */
export const MAX_PENDING_AGE_MS = 24 * 60 * 60 * 1_000;

/** Cap on one reconciliation pass, so a huge backlog cannot stall boot. */
export const PENDING_SCAN_LIMIT = 500;

/** Prisma transaction client — staging always runs inside the caller's transaction. */
type Tx = Prisma.TransactionClient;

/** One row to stage. `body` is already rendered; the outbox never renders. */
export interface StagedNotification {
  residentId: string;
  roundId: string | null;
  type: NotificationType;
  /** Unique per event+recipient — the DB constraint that makes re-staging safe. */
  dedupeKey: string;
  body: string;
}

/**
 * The transactional notification outbox (FEAT-006, ADR-0013).
 *
 * Deliberately domain-agnostic: it knows residents, bodies and dedupe keys, not
 * rounds. Round-specific loading and rendering live in the rounds domain
 * (`RoundNotificationsService`), so this service never has to be edited when a
 * new event is added.
 *
 * Contract:
 *  - {@link stage} runs inside the CALLER'S transaction, so a rolled-back state
 *    change can never leave a message to send.
 *  - {@link dispatch} runs AFTER that transaction commits and never throws — a
 *    Redis outage leaves rows PENDING for the boot reconciler rather than
 *    failing the round operation that triggered them.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationJobData>,
  ) {}

  /**
   * Stage rows inside the caller's transaction and return the ids to dispatch.
   *
   * `skipDuplicates` on the unique `dedupeKey` is what makes an idempotent
   * re-close, a retried job or a double-fired scheduler stage nothing new. The
   * ids are then read back by key (createMany cannot return them); a row that
   * was already staged and is still PENDING is included, which is harmless
   * because dispatch is idempotent on `jobId`.
   */
  async stage(tx: Tx, rows: StagedNotification[]): Promise<string[]> {
    if (rows.length === 0) {
      return [];
    }
    await tx.notification.createMany({ data: rows, skipDuplicates: true });
    const staged = await tx.notification.findMany({
      where: { dedupeKey: { in: rows.map((r) => r.dedupeKey) }, status: NotificationStatus.PENDING },
      select: { id: true },
    });
    return staged.map((n) => n.id);
  }

  /**
   * Add one send job per notification id. Best-effort by contract: every failure
   * is logged and swallowed, because the caller has already committed a round
   * change and must not be failed by the messaging side. Anything that does not
   * reach the queue stays PENDING and is picked up by the boot reconciler.
   */
  async dispatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.queue.add(
          NOTIFICATION_SEND_JOB,
          { notificationId: id },
          {
            jobId: id,
            attempts: NOTIFICATION_SEND_ATTEMPTS,
            backoff: { type: 'exponential', delay: 1_000 },
            removeOnComplete: true,
            removeOnFail: { age: 24 * 60 * 60 },
          },
        );
      } catch (err) {
        this.logger.warn(
          `Could not dispatch notification ${id} (stays PENDING for the reconciler): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  /** Load a notification with the recipient's phone, or null if it is gone. */
  async findForSend(
    id: string,
  ): Promise<(Notification & { resident: { phone: string } }) | null> {
    return this.prisma.notification.findUnique({
      where: { id },
      include: { resident: { select: { phone: true } } },
    });
  }

  /**
   * Mark a row delivered. Guarded on PENDING so a racing duplicate delivery can
   * never overwrite a terminal state; returns false if the row was not PENDING.
   */
  async markSent(id: string, attempts: number): Promise<boolean> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, status: NotificationStatus.PENDING },
      data: { status: NotificationStatus.SENT, sentAt: new Date(), attempts, lastError: null },
    });
    return count > 0;
  }

  /**
   * Record a failed attempt. Only the FINAL attempt moves the row to FAILED —
   * earlier ones just record the count and the error so a message being retried
   * is never mistaken for a dead one.
   */
  async recordAttemptFailure(
    id: string,
    attempts: number,
    error: string,
    final: boolean,
  ): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, status: NotificationStatus.PENDING },
      data: {
        attempts,
        lastError: error.slice(0, 500),
        ...(final ? { status: NotificationStatus.FAILED } : {}),
      },
    });
  }

  /**
   * Still-PENDING rows recent enough to be worth sending, oldest first — the
   * reconciler's input (V2 P2-3). Rows older than {@link MAX_PENDING_AGE_MS} are
   * deliberately left behind rather than delivered as stale news; they stay in
   * the table as a record of what did not go out.
   */
  async listPending(limit = PENDING_SCAN_LIMIT): Promise<Array<{ id: string }>> {
    return this.prisma.notification.findMany({
      where: {
        status: NotificationStatus.PENDING,
        createdAt: { gte: new Date(Date.now() - MAX_PENDING_AGE_MS) },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /** How many PENDING rows were skipped as too old to send (observability). */
  async countStalePending(): Promise<number> {
    return this.prisma.notification.count({
      where: {
        status: NotificationStatus.PENDING,
        createdAt: { lt: new Date(Date.now() - MAX_PENDING_AGE_MS) },
      },
    });
  }

  /** True if a live (delayed/waiting/active) job already exists for this row. */
  async hasPendingJob(id: string): Promise<boolean> {
    const job = await this.queue.getJob(id);
    if (!job) {
      return false;
    }
    const state = await job.getState();
    return state === 'delayed' || state === 'waiting' || state === 'active' || state === 'prioritized';
  }
}

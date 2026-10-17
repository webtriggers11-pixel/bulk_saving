import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ROUND_JOB_BACKOFF, ROUND_JOB_REMOVE_ON_FAIL } from './round-closing.scheduler';

/** BullMQ queue for the "closing soon" reminder (FEAT-006, ADR-0013). */
export const ROUND_REMINDER_QUEUE = 'round-reminder';

/** The job name under which reminder jobs are added. */
export const ROUND_REMINDER_JOB = 'remind-round';

/** Payload of a reminder job — just the round to remind about. */
export interface RoundReminderJobData {
  roundId: string;
}

/** How long before the deadline the reminder fires. ADR-0013 revisit trigger if ops disagree. */
export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1_000;

/** Reminder retries: a transient DB/Redis error must not silently drop the nudge. */
export const ROUND_REMINDER_ATTEMPTS = 3;

/**
 * Job id for a round's reminder — namespaced so it cannot collide with a close
 * job. The separator is a hyphen, not a colon: BullMQ rejects a custom job id
 * containing `:` (it namespaces its own Redis keys with it).
 */
export function reminderJobId(roundId: string): string {
  return `reminder-${roundId}`;
}

/**
 * Schedules (and unschedules) the pre-deadline reminder for a round. One delayed
 * job per round, `jobId = reminder-<round id>`, so scheduling is de-duplicated
 * and a close/cancel can remove it by id.
 *
 * Deliberately mirrors {@link RoundClosingScheduler}: same idempotency rules,
 * same leftover-job handling. It does NOT move an existing pending job to a new
 * deadline — a future deadline-edit path must `cancel()` then `schedule()`.
 */
@Injectable()
export class RoundReminderScheduler {
  private readonly logger = new Logger(RoundReminderScheduler.name);

  constructor(
    @InjectQueue(ROUND_REMINDER_QUEUE) private readonly queue: Queue<RoundReminderJobData>,
  ) {}

  /**
   * The delay until `deadline − lead`, or null when that instant has already
   * passed — a round whose whole window is shorter than the lead gets no
   * reminder rather than an immediate one that would arrive with the join
   * confirmation.
   */
  static delayFor(deadline: Date, now: Date = new Date()): number | null {
    const fireAt = deadline.getTime() - REMINDER_LEAD_MS;
    const delay = fireAt - now.getTime();
    return delay > 0 ? delay : null;
  }

  /**
   * Ensure a reminder job exists for the round, firing `REMINDER_LEAD_MS` before
   * the deadline. Idempotent: a pending job is kept as-is; a leftover
   * failed/completed job under the same id is removed first (BullMQ would
   * otherwise silently ignore the add). Returns true if a job is now scheduled.
   */
  async schedule(roundId: string, deadline: Date): Promise<boolean> {
    const delay = RoundReminderScheduler.delayFor(deadline);
    if (delay === null) {
      return false;
    }
    const jobId = reminderJobId(roundId);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'delayed' || state === 'waiting' || state === 'active' || state === 'prioritized') {
        return true;
      }
      await existing.remove();
    }
    await this.queue.add(
      ROUND_REMINDER_JOB,
      { roundId },
      {
        jobId,
        delay,
        attempts: ROUND_REMINDER_ATTEMPTS,
        backoff: ROUND_JOB_BACKOFF,
        removeOnComplete: true,
        removeOnFail: ROUND_JOB_REMOVE_ON_FAIL,
      },
    );
    return true;
  }

  /** Best-effort removal of a round's pending reminder (idempotent no-op if gone). */
  async cancel(roundId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(reminderJobId(roundId));
      if (job) {
        await job.remove();
      }
    } catch (err) {
      // A job mid-processing (or already removed) can't be removed — harmless,
      // because the processor no-ops unless the round is still OPEN.
      this.logger.debug(
        `Could not remove reminder job for ${roundId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

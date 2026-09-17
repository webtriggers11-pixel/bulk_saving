import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

/** BullMQ queue name for the per-round deadline close jobs (FEAT-004, ADR-0011). */
export const ROUND_CLOSING_QUEUE = 'round-closing';

/** The job name under which close jobs are added. */
export const ROUND_CLOSING_JOB = 'close-round';

/** Payload of a deadline close job — just the round to (attempt to) close. */
export interface RoundClosingJobData {
  roundId: string;
}

/** Close-job retries: a transient DB error at the deadline must not strand a round OPEN. */
export const ROUND_CLOSING_ATTEMPTS = 6;

/**
 * Schedules (and unschedules) the deadline-driven close of a round via a BullMQ
 * delayed job. One delayed job per round, `jobId = round id`, so scheduling is
 * de-duplicated and a manual close/cancel can remove it by id. Failed attempts
 * retry with exponential backoff (~1s → ~16s). The actual close is idempotent
 * (RoundCloserProcessor -> RoundsService.closeRound), so retries, duplicate
 * schedules, and a job racing a manual close are all harmless.
 */
@Injectable()
export class RoundClosingScheduler {
  private readonly logger = new Logger(RoundClosingScheduler.name);

  constructor(
    @InjectQueue(ROUND_CLOSING_QUEUE) private readonly queue: Queue<RoundClosingJobData>,
  ) {}

  /**
   * Ensure a close job exists firing at `deadline` (delay clamped to >= 0).
   * Idempotent: a pending (delayed/waiting/active) job for the round is kept
   * as-is. A leftover failed/completed job under the same id would make BullMQ
   * silently ignore the add, so it is removed first. NOTE: this does not move an
   * existing pending job to a new deadline — a future deadline-edit path must
   * `cancel()` then `schedule()`.
   */
  async schedule(roundId: string, deadline: Date): Promise<void> {
    const existing = await this.queue.getJob(roundId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'delayed' || state === 'waiting' || state === 'active' || state === 'prioritized') {
        return;
      }
      await existing.remove();
    }
    const delay = Math.max(0, deadline.getTime() - Date.now());
    await this.queue.add(
      ROUND_CLOSING_JOB,
      { roundId },
      {
        jobId: roundId,
        delay,
        attempts: ROUND_CLOSING_ATTEMPTS,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 60 * 60 },
      },
    );
  }

  /** Best-effort removal of a round's pending close job (idempotent no-op if gone). */
  async cancel(roundId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(roundId);
      if (job) {
        await job.remove();
      }
    } catch (err) {
      // A job mid-processing (or already removed) can't be removed — harmless,
      // because closeRound is idempotent and no-ops on a non-OPEN round.
      this.logger.debug(
        `Could not remove close job ${roundId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

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

/**
 * Schedules (and unschedules) the deadline-driven close of a round via a BullMQ
 * delayed job. One delayed job per round, `jobId = round id` so a re-schedule is
 * de-duplicated/replaceable and a manual close/cancel can remove it by id. The
 * actual close is idempotent (RoundCloserProcessor -> RoundsService.closeRound),
 * so removing the job is only a best-effort optimisation against a double-fire.
 */
@Injectable()
export class RoundClosingScheduler {
  private readonly logger = new Logger(RoundClosingScheduler.name);

  constructor(
    @InjectQueue(ROUND_CLOSING_QUEUE) private readonly queue: Queue<RoundClosingJobData>,
  ) {}

  /** Enqueue a delayed close job firing at `deadline` (delay clamped to >= 0). */
  async schedule(roundId: string, deadline: Date): Promise<void> {
    const delay = Math.max(0, deadline.getTime() - Date.now());
    await this.queue.add(
      ROUND_CLOSING_JOB,
      { roundId },
      {
        jobId: roundId,
        delay,
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

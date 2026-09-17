import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ROUND_REMINDER_QUEUE, type RoundReminderJobData } from './round-reminder.scheduler';
import { RoundsService } from './rounds.service';

/** What the reminder reports: how many residents were notified, or null if the round is gone. */
export interface RoundReminderJobResult {
  notified: number | null;
}

/**
 * The pre-deadline nudge (FEAT-006, ADR-0013). When a round's delayed reminder
 * fires, it delegates to {@link RoundsService.remindClosingSoon}, which fans out
 * to the participants that exist AT THAT MOMENT — not the ones that existed when
 * the job was scheduled — and no-ops unless the round is still OPEN.
 *
 * Mirrors {@link RoundCloserProcessor}, including the not-found retry: a job can
 * in principle fire before its round's creating transaction is visible.
 */
@Processor(ROUND_REMINDER_QUEUE)
export class RoundReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(RoundReminderProcessor.name);

  constructor(private readonly rounds: RoundsService) {
    super();
  }

  async process(job: Job<RoundReminderJobData>): Promise<RoundReminderJobResult> {
    const { roundId } = job.data;
    const notified = await this.rounds.remindClosingSoon(roundId);
    if (notified === null) {
      const attempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 < attempts) {
        throw new Error(`Round ${roundId} not found (yet); retrying reminder`);
      }
      this.logger.log(`Round ${roundId} reminder → no-op (round not found)`);
      return { notified: null };
    }
    this.logger.log(`Round ${roundId} reminder → ${notified} resident(s) notified`);
    return { notified };
  }
}

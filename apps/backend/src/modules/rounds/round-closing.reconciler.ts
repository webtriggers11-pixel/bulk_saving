import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RoundClosingScheduler } from './round-closing.scheduler';
import { RoundsService } from './rounds.service';

/**
 * Safety net for the deadline scheduler (FEAT-004, ADR-0011 revisit trigger).
 * On boot, re-ensures every OPEN round has a close job — covering rounds created
 * before the scheduler existed (e.g. seed data), lost Redis state, and the rare
 * create/commit race. Past-deadline OPEN rounds get a zero-delay job and close
 * immediately. `schedule()` is idempotent, so this is safe on every boot.
 *
 * Skipped under Jest (NODE_ENV=test): parallel test apps share one DB and would
 * otherwise schedule jobs for each other's fixture rounds. Tests call
 * {@link reconcile} directly, scoped to their own society.
 */
@Injectable()
export class RoundClosingReconciler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoundClosingReconciler.name);

  constructor(
    private readonly rounds: RoundsService,
    private readonly scheduler: RoundClosingScheduler,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    try {
      const count = await this.reconcile();
      this.logger.log(`Ensured close jobs for ${count} OPEN round(s)`);
    } catch (err) {
      // Never block boot on the safety net; the next boot retries.
      this.logger.error(
        `Round close-job reconciliation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Ensure a close job for every OPEN round (optionally one society). Returns the count. */
  async reconcile(societyId?: string): Promise<number> {
    const open = await this.rounds.listOpenDeadlines(societyId);
    for (const round of open) {
      await this.scheduler.schedule(round.id, round.deadline);
    }
    return open.length;
  }
}

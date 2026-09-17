import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/**
 * Safety net for the outbox (FEAT-006, ADR-0013). Staging is transactional but
 * dispatch is best-effort, so a Redis outage (or a crash between commit and
 * dispatch) can leave a committed row PENDING with no job. On boot, every such
 * row is re-dispatched. Dispatch is idempotent on `jobId`, and the processor
 * skips rows that are no longer PENDING, so this can never double-send.
 *
 * Skipped under Jest (NODE_ENV=test): parallel test apps share one DB and would
 * otherwise dispatch each other's fixture rows. Tests call {@link reconcile}
 * directly with their own ids.
 */
@Injectable()
export class NotificationDispatchReconciler implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationDispatchReconciler.name);

  constructor(private readonly notifications: NotificationsService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    try {
      const count = await this.reconcile();
      if (count > 0) {
        this.logger.log(`Re-dispatched ${count} PENDING notification(s) with no job`);
      }
    } catch (err) {
      // Never block boot on the safety net; the next boot retries.
      this.logger.error(
        `Notification dispatch reconciliation failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Re-dispatch PENDING rows that have no live job. Pass `ids` to scope it (the
   * tests do); otherwise every PENDING row is considered. Returns how many were
   * re-dispatched.
   */
  async reconcile(ids?: string[]): Promise<number> {
    const candidates = ids ?? (await this.notifications.listPending()).map((n) => n.id);
    const orphaned: string[] = [];
    for (const id of candidates) {
      if (!(await this.notifications.hasPendingJob(id))) {
        orphaned.push(id);
      }
    }
    await this.notifications.dispatch(orphaned);
    return orphaned.length;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, type Prisma } from '@prisma/client';
import {
  type RoundForMessage,
  type TemplateInput,
  renderNotification,
} from '../notifications/notification-templates';
import {
  type StagedNotification,
  NotificationsService,
} from '../notifications/notifications.service';
import { computePricing } from './rounds.pricing';

type Tx = Prisma.TransactionClient;

/** The lifecycle events that fan out to every participant of a round. */
export type RoundFanoutType =
  | typeof NotificationType.ROUND_CLOSING_SOON
  | typeof NotificationType.ROUND_CLOSED_MET
  | typeof NotificationType.ROUND_CLOSED_EXPIRED
  | typeof NotificationType.ROUND_ASSIGNED
  | typeof NotificationType.ROUND_DELIVERED
  | typeof NotificationType.ROUND_CANCELLED;

/**
 * Turns a round change into outbox rows (FEAT-006, ADR-0013).
 *
 * Lives in the rounds domain on purpose: all knowledge of rounds, tiers, pricing
 * and vendors stays here, while `NotificationsService` stays a generic outbox.
 * Every method takes the CALLER'S transaction client, so the rows commit — or
 * roll back — with the state change that caused them. Nothing here mutates round
 * state; `RoundsService.transition()` remains the only status-writing path.
 */
@Injectable()
export class RoundNotificationsService {
  private readonly logger = new Logger(RoundNotificationsService.name);

  constructor(private readonly notifications: NotificationsService) {}

  /**
   * One join confirmation for the resident who just joined. The dedupe key is
   * the PARTICIPANT id, not the resident id: leaving deletes that row, so a
   * rejoin is a genuinely new pledge and legitimately gets a new confirmation,
   * while a retried or duplicated join of the same pledge does not.
   * Changing an existing pledge sends nothing (spec: no message for updates).
   */
  async stageJoined(tx: Tx, roundId: string, residentId: string): Promise<string[]> {
    const round = await this.loadRound(tx, roundId);
    if (!round) {
      return [];
    }
    const participant = round.participants.find((p) => p.residentId === residentId);
    if (!participant) {
      return [];
    }
    const { currentPrice } = this.pricing(round);
    const body = renderNotification({
      type: NotificationType.ROUND_JOINED,
      round: this.forMessage(round),
      units: participant.units,
      currentPrice,
    });
    return this.notifications.stage(tx, [
      {
        residentId,
        roundId,
        type: NotificationType.ROUND_JOINED,
        dedupeKey: `${NotificationType.ROUND_JOINED}:${participant.id}`,
        body,
      },
    ]);
  }

  /**
   * One row per current participant for a round-wide event. A round with no
   * participants stages nothing. Re-staging the same event is a no-op thanks to
   * the unique dedupe key, which is what makes an idempotent re-close safe.
   */
  async stageForParticipants(tx: Tx, roundId: string, type: RoundFanoutType): Promise<string[]> {
    const round = await this.loadRound(tx, roundId);
    if (!round || round.participants.length === 0) {
      return [];
    }
    const { currentPrice, target } = this.pricing(round);
    const forMessage = this.forMessage(round);

    if (type === NotificationType.ROUND_ASSIGNED && (!round.vendor || round.finalPrice === null)) {
      // Defensive: assign writes vendor + price in the same update as the status,
      // so this should be unreachable. Skip rather than render a broken message.
      this.logger.warn(`Round ${roundId} is ASSIGNED without a vendor/price; no message staged`);
      return [];
    }

    const rows: StagedNotification[] = round.participants.map((participant) => {
      const input = this.templateInput(type, {
        round: forMessage,
        units: participant.units,
        unitsCount: round.unitsCount,
        currentPrice,
        target,
        vendorName: round.vendor?.name ?? '',
        finalPrice: round.finalPrice ?? 0,
      });
      return {
        residentId: participant.residentId,
        roundId,
        type,
        dedupeKey: `${type}:${roundId}:${participant.residentId}`,
        body: renderNotification(input),
      };
    });
    return this.notifications.stage(tx, rows);
  }

  /** Hand staged ids to the queue. Separate from staging: only ever called AFTER commit. */
  async dispatch(ids: string[]): Promise<void> {
    await this.notifications.dispatch(ids);
  }

  /** Build the per-type template input from one loaded round + one participant. */
  private templateInput(
    type: RoundFanoutType,
    ctx: {
      round: RoundForMessage;
      units: number;
      unitsCount: number;
      currentPrice: number | null;
      target: number | null;
      vendorName: string;
      finalPrice: number;
    },
  ): TemplateInput {
    switch (type) {
      case NotificationType.ROUND_CLOSING_SOON:
        return {
          type,
          round: ctx.round,
          units: ctx.units,
          unitsCount: ctx.unitsCount,
          target: ctx.target,
          currentPrice: ctx.currentPrice,
        };
      case NotificationType.ROUND_CLOSED_MET:
        return { type, round: ctx.round, units: ctx.units, currentPrice: ctx.currentPrice };
      case NotificationType.ROUND_CLOSED_EXPIRED:
        return { type, round: ctx.round };
      case NotificationType.ROUND_ASSIGNED:
        return {
          type,
          round: ctx.round,
          vendorName: ctx.vendorName,
          finalPrice: ctx.finalPrice,
          units: ctx.units,
        };
      case NotificationType.ROUND_DELIVERED:
        return { type, round: ctx.round };
      case NotificationType.ROUND_CANCELLED:
        return { type, round: ctx.round };
    }
  }

  /** Load everything a message may mention, inside the caller's transaction. */
  private loadRound(tx: Tx, roundId: string) {
    return tx.round.findUnique({
      where: { id: roundId },
      include: {
        service: true,
        tiers: { orderBy: { threshold: 'asc' } },
        participants: true,
        vendor: true,
      },
    });
  }

  /**
   * The price a message may quote, and the target that unlocks one.
   *
   * `currentPrice` is null until the lowest threshold is actually met: below it
   * `computePricing` returns the lowest tier's price as a not-yet-unlocked
   * *starting* price (ADR-0010), and quoting that in an SMS would read as a
   * promise. A round with no tiers (defensive — rounds are created with at least
   * one) yields nulls rather than crashing a send.
   */
  private pricing(round: { unitsCount: number; tiers: Array<{ threshold: number; price: number }> }): {
    currentPrice: number | null;
    target: number | null;
  } {
    const tiers = round.tiers.map((t) => ({ threshold: t.threshold, price: t.price }));
    const lowest = tiers.reduce<{ threshold: number; price: number } | null>(
      (min, t) => (min === null || t.threshold < min.threshold ? t : min),
      null,
    );
    if (!lowest) {
      return { currentPrice: null, target: null };
    }
    const unlocked = round.unitsCount >= lowest.threshold;
    const { currentPrice } = computePricing(tiers, round.unitsCount);
    return { currentPrice: unlocked ? currentPrice : null, target: lowest.threshold };
  }

  private forMessage(round: { service: { name: string }; deadline: Date }): RoundForMessage {
    return { serviceName: round.service.name, deadline: round.deadline };
  }
}

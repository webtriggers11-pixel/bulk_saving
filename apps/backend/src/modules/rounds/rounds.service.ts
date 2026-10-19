import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, type Prisma } from '@prisma/client';
import type { AdminRoundParticipantDto, MyRoundDto, Page, PageQuery, RoundDto } from '@bulk/shared';
import { RoundStatus } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { pageArgs, pageOf } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { VendorsService } from '../vendors/vendors.service';
import { toRatingDto } from './ratings.mapper';
import { RoundNotificationsService } from './round-notifications.service';
import { buildAdminParticipant } from './rounds-admin.mapper';
import { buildRoundDto, type RoundWithView } from './rounds.mapper';
import { isLegalTransition } from './rounds.transitions';

/**
 * Prisma transaction client — the subset of PrismaService available inside
 * `$transaction`. Used so the concurrency-critical join/update/leave logic runs
 * entirely within one atomic transaction.
 */
type Tx = Prisma.TransactionClient;

/**
 * Interactive-transaction limits for round mutations (BUG-001). Every round
 * write first waits on the exclusive row lock, and Prisma's timeout clock
 * (default 5s) includes that wait — so on a hot round a queued join used to
 * expire and 500 even though it would have succeeded. The work done while
 * holding the lock is a handful of fast queries; the generous `timeout` only
 * covers time spent queued behind other writers.
 */
export const ROUND_TX_OPTIONS = { maxWait: 5_000, timeout: 30_000 } as const;

/**
 * Extra round columns a lifecycle transition may write together with the status
 * (FEAT-005, ADR-0012). Deliberately narrow: never `status` or `unitsCount`.
 */
type TransitionData = Pick<
  Prisma.RoundUncheckedUpdateInput,
  'vendorId' | 'finalPrice' | 'assignedAt' | 'deliveredAt'
>;

/** Statuses in which a participant's payment may be recorded (a vendor has been assigned). */
const PAYMENT_STATUSES: readonly RoundStatus[] = [
  RoundStatus.ASSIGNED,
  RoundStatus.DELIVERED,
  RoundStatus.RATED,
];

/**
 * The rounds domain heart: resident reads + the concurrency-critical join /
 * update / leave path, plus the guarded lifecycle {@link transition} (close /
 * cancel / assign / deliver / rate) and the FEAT-005 participant payment flag.
 * This is the ONLY place round `status` and the authoritative `unitsCount` are
 * mutated (ARCHITECTURE.md: "No status field is mutated anywhere else"); every
 * transition is validated
 * against the legal-transition map under the exclusive round row lock.
 *
 * Concurrency (ADR-0004): `unitsCount` is authoritative in Postgres. Every
 * mutating path (join/update/leave/close) runs inside a `prisma.$transaction`
 * that FIRST takes an exclusive row lock on the round (`SELECT ... FOR UPDATE`),
 * so ALL mutations on a given round are fully serialized — including two
 * requests from the SAME resident (double-tapped join, join+patch). The unit
 * delta is always computed AFTER the lock is held (never from a stale unlocked
 * read), and applied with a RELATIVE, status-guarded `{ increment: delta }`.
 * The final `unitsCount` therefore always equals sum(participant.units) with no
 * drift and no tier oversell, and a round closed mid-flight rejects the join.
 */
@Injectable()
export class RoundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendors: VendorsService,
    private readonly roundNotifications: RoundNotificationsService,
  ) {}

  /** Run a round mutation in an interactive transaction with {@link ROUND_TX_OPTIONS}. */
  private inRoundTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, ROUND_TX_OPTIONS);
  }

  /**
   * Run a round mutation that also stages notifications (FEAT-006, ADR-0013).
   * The callback returns its result together with the ids it staged INSIDE the
   * transaction; those ids reach the queue only after the transaction commits,
   * so a rolled-back change can never send a message. Dispatch is best-effort
   * and never throws, so the messaging side cannot fail a committed round
   * operation — undispatched rows stay PENDING for the boot reconciler.
   */
  private async inRoundTxNotifying<T>(
    fn: (tx: Tx) => Promise<{ result: T; staged: string[] }>,
  ): Promise<T> {
    const { result, staged } = await this.inRoundTx(fn);
    await this.roundNotifications.dispatch(staged);
    return result;
  }

  /** The include needed to shape a {@link RoundDto} for a specific caller. */
  private viewInclude(residentId: string): Prisma.RoundInclude {
    return {
      service: true,
      tiers: { orderBy: { threshold: 'asc' } },
      participants: { where: { residentId } },
    };
  }

  /**
   * OPEN rounds in the caller's society, each shaped with pricing + the caller's pledge —
   * one page of them (FEAT-025, ADR-0035): newest first, `id` as the tiebreaker so the
   * order is total and a cursor means one thing.
   */
  async listForSociety(societyId: string, residentId: string, page: PageQuery = {}): Promise<Page<RoundDto>> {
    const where = { societyId, status: 'OPEN' as const };
    const [rounds, total] = await Promise.all([
      this.prisma.round.findMany({
        where,
        include: this.viewInclude(residentId),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(page),
      }),
      this.prisma.round.count({ where }),
    ]);
    return pageOf(rounds as RoundWithView[], page, total, buildRoundDto);
  }

  /**
   * Rounds the caller has JOINED, in any status, newest first (FEAT-007) — the
   * "My Requests" view. `GET /rounds` stays OPEN-only: this is the only way a
   * resident can see a delivered round, and therefore the only way they can reach
   * the rating flow. Tenant-scoped like every resident read (ADR-0003).
   */
  async listMine(societyId: string, residentId: string, page: PageQuery = {}): Promise<Page<MyRoundDto>> {
    const where = { societyId, participants: { some: { residentId } } };
    const [rounds, total] = await Promise.all([
      this.prisma.round.findMany({
        where,
        include: { ...this.viewInclude(residentId), ratings: { where: { residentId } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(page),
      }),
      this.prisma.round.count({ where }),
    ]);
    return pageOf(rounds, page, total, (round) => ({
      ...buildRoundDto(round as RoundWithView),
      myRating: round.ratings[0] ? toRatingDto(round.ratings[0]) : null,
    }));
  }

  /**
   * Every OPEN round's id + deadline (optionally one society) — read-only input
   * for the scheduler reconciler, which re-ensures each has a close job.
   */
  async listOpenDeadlines(societyId?: string): Promise<Array<{ id: string; deadline: Date }>> {
    return this.prisma.round.findMany({
      where: { status: 'OPEN', ...(societyId ? { societyId } : {}) },
      select: { id: true, deadline: true },
    });
  }

  /**
   * Join a round (or change an existing pledge): upsert the caller's participant
   * row and apply the unit delta to `unitsCount` atomically. 404 if the round is
   * missing or in another society; 409 ROUND_CLOSED if it is not OPEN.
   */
  async join(roundId: string, societyId: string, residentId: string, units: number): Promise<RoundDto> {
    return this.inRoundTxNotifying(async (tx) => {
      await this.lockOpenRoundForWrite(tx, roundId, societyId);

      const existing = await tx.roundParticipant.findUnique({
        where: { roundId_residentId: { roundId, residentId } },
      });
      const delta = units - (existing?.units ?? 0);

      await tx.roundParticipant.upsert({
        where: { roundId_residentId: { roundId, residentId } },
        create: { roundId, residentId, units },
        update: { units },
      });

      const result = await this.applyDeltaAndBuild(tx, roundId, residentId, delta);
      // Confirmation only for a genuinely new pledge — changing an existing one
      // sends nothing (and the dedupe key is the participant row, so a rejoin
      // after leaving does get a fresh confirmation).
      const staged = existing
        ? []
        : await this.roundNotifications.stageJoined(tx, roundId, residentId);
      return { result, staged };
    });
  }

  /**
   * Change an EXISTING pledge to `units` and apply the delta atomically. 404 if
   * the caller has not joined; 404 / 409 for a missing / closed round.
   */
  async updatePledge(
    roundId: string,
    societyId: string,
    residentId: string,
    units: number,
  ): Promise<RoundDto> {
    return this.inRoundTx(async (tx) => {
      await this.lockOpenRoundForWrite(tx, roundId, societyId);

      const existing = await tx.roundParticipant.findUnique({
        where: { roundId_residentId: { roundId, residentId } },
      });
      if (!existing) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'You have not joined this round.',
        });
      }
      const delta = units - existing.units;

      await tx.roundParticipant.update({
        where: { roundId_residentId: { roundId, residentId } },
        data: { units },
      });

      return this.applyDeltaAndBuild(tx, roundId, residentId, delta);
    });
  }

  /**
   * Leave a round: delete the caller's participant row and decrement
   * `unitsCount` by their pledge atomically. 404 if the caller has not joined
   * (chosen over an idempotent 200); 404 / 409 for a missing / closed round.
   */
  async leave(roundId: string, societyId: string, residentId: string): Promise<RoundDto> {
    return this.inRoundTx(async (tx) => {
      await this.lockOpenRoundForWrite(tx, roundId, societyId);

      const existing = await tx.roundParticipant.findUnique({
        where: { roundId_residentId: { roundId, residentId } },
      });
      if (!existing) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'You have not joined this round.',
        });
      }

      await tx.roundParticipant.delete({
        where: { roundId_residentId: { roundId, residentId } },
      });

      return this.applyDeltaAndBuild(tx, roundId, residentId, -existing.units);
    });
  }

  /**
   * Manual admin close (FEAT-003 endpoint, now FEAT-004 semantics): routes
   * through {@link closeRound} so it yields CLOSED_MET / CLOSED_EXPIRED by the
   * units-vs-lowest-threshold rule. Unknown id → 404.
   */
  async close(roundId: string, viewerResidentId: string): Promise<RoundDto> {
    const dto = await this.closeRound(roundId, viewerResidentId);
    if (!dto) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Round not found.' });
    }
    return dto;
  }

  /**
   * Close a round at its deadline (also the manual-close core). Under the ADR-0004
   * row lock, in one transaction: no-op if the round is missing (returns null) or
   * already non-OPEN (returns its current view — idempotent, so the scheduled job
   * and a manual close can race harmlessly). Otherwise transitions to CLOSED_MET
   * iff `unitsCount >= the lowest tier threshold`, else CLOSED_EXPIRED. The
   * `viewerResidentId` only shapes `myUnits` in the returned view (the processor
   * passes none and ignores it).
   */
  async closeRound(roundId: string, viewerResidentId = ''): Promise<RoundDto | null> {
    return this.inRoundTxNotifying(async (tx) => {
      const locked = await this.lockRoundForUpdate(tx, roundId);
      if (!locked) {
        return { result: null, staged: [] };
      }
      if (locked.status !== RoundStatus.OPEN) {
        // Idempotent no-op: already closed/cancelled — return the current view.
        // Nothing is staged, so a re-close never produces a second message.
        return { result: await this.buildRoundById(tx, roundId, viewerResidentId), staged: [] };
      }

      const lowest = await tx.roundTier.findFirst({
        where: { roundId },
        orderBy: { threshold: 'asc' },
        select: { threshold: true },
      });
      const met = lowest !== null && locked.unitsCount >= lowest.threshold;
      const to = met ? RoundStatus.CLOSED_MET : RoundStatus.CLOSED_EXPIRED;
      const result = await this.transition(tx, roundId, to, viewerResidentId);
      const staged = await this.roundNotifications.stageForParticipants(
        tx,
        roundId,
        met ? NotificationType.ROUND_CLOSED_MET : NotificationType.ROUND_CLOSED_EXPIRED,
      );
      return { result, staged };
    });
  }

  /**
   * Cancel a round (SUPER_ADMIN). Guarded: legal only from a pre-DELIVERED state
   * (OPEN / CLOSED_MET / CLOSED_EXPIRED / ASSIGNED); from DELIVERED / RATED /
   * CANCELLED → 409 INVALID_ROUND_TRANSITION. Unknown id → 404. A round with any
   * collected payment → 409 PAYMENTS_COLLECTED: once CANCELLED, payment flags can no
   * longer be changed and drop out of the dashboard totals, so the admin must undo
   * (refund) them first rather than let collected money become invisible.
   */
  async cancel(roundId: string, viewerResidentId = ''): Promise<RoundDto> {
    return this.inRoundTxNotifying(async (tx) => {
      const result = await this.transition(
        tx,
        roundId,
        RoundStatus.CANCELLED,
        viewerResidentId,
        async () => {
          const collected = await tx.roundParticipant.count({
            where: { roundId, paymentCollectedAt: { not: null } },
          });
          if (collected > 0) {
            throw new ConflictException({
              code: ErrorCode.PAYMENTS_COLLECTED,
              message: `Undo the ${collected} collected payment(s) before cancelling this round.`,
            });
          }
          return {};
        },
      );
      const staged = await this.roundNotifications.stageForParticipants(
        tx,
        roundId,
        NotificationType.ROUND_CANCELLED,
      );
      return { result, staged };
    });
  }

  /**
   * CLOSED_MET → ASSIGNED (FEAT-005, ADR-0012): assign a vendor at a negotiated
   * per-unit `finalPrice`. One transaction, under the round row lock, in this order:
   *  1. round exists (else 404 NOT_FOUND);
   *  2. the move is legal from the LOCKED status (else 409 INVALID_ROUND_TRANSITION);
   *  3. the vendor exists (else 404 NOT_FOUND) and is active (else 400 VENDOR_INACTIVE);
   *  4. ONE update writes status + vendorId + finalPrice + assignedAt.
   * Legality is checked first so an illegal assign is always a 409 regardless of the
   * vendor, and every check runs before the single write, so a rejection writes nothing.
   */
  async assign(
    roundId: string,
    vendorId: string,
    finalPrice: number,
    viewerResidentId = '',
  ): Promise<RoundDto> {
    return this.inRoundTxNotifying(async (tx) => {
      const result = await this.transition(
        tx,
        roundId,
        RoundStatus.ASSIGNED,
        viewerResidentId,
        async () => {
          // Share-lock the vendor row so a concurrent deactivation can't commit
          // between this check and the assignment write.
          await tx.$queryRaw`SELECT "id" FROM "Vendor" WHERE "id" = ${vendorId} FOR SHARE`;
          const vendor = await this.vendors.getById(vendorId, tx);
          if (!vendor.active) {
            throw new BadRequestException({
              code: ErrorCode.VENDOR_INACTIVE,
              message: 'This vendor is inactive.',
            });
          }
          return { vendorId: vendor.id, finalPrice, assignedAt: new Date() };
        },
      );
      // Staged AFTER the transition, so the message quotes the vendor and price
      // that were just written in the same transaction.
      const staged = await this.roundNotifications.stageForParticipants(
        tx,
        roundId,
        NotificationType.ROUND_ASSIGNED,
      );
      return { result, staged };
    });
  }

  /** ASSIGNED → DELIVERED (service performed), stamping `deliveredAt` in the same guarded write. */
  async deliver(roundId: string, viewerResidentId = ''): Promise<RoundDto> {
    return this.inRoundTxNotifying(async (tx) => {
      const result = await this.transition(
        tx,
        roundId,
        RoundStatus.DELIVERED,
        viewerResidentId,
        async () => ({ deliveredAt: new Date() }),
      );
      const staged = await this.roundNotifications.stageForParticipants(
        tx,
        roundId,
        NotificationType.ROUND_DELIVERED,
      );
      return { result, staged };
    });
  }

  /**
   * Fan out the "closing soon" reminder for a round (FEAT-006, ADR-0013) —
   * called by the delayed {@link RoundReminderProcessor}.
   *
   * Returns null if the round is gone (the processor retries, then gives up), 0
   * if it is no longer OPEN or has no participants, else the number of residents
   * staged. Recipients are read AT FIRE TIME, so everyone who joined since the
   * job was scheduled is included.
   *
   * It takes the exclusive round row lock even though it writes no round state
   * (V2 P2-1): an unlocked status read under read-committed can see OPEN while a
   * close/cancel commits underneath, which would text "closes soon — invite a
   * neighbour" AFTER "this round was cancelled". The lock makes the status read
   * and the staging one serialized unit against every other round mutation. The
   * critical section is three fast local queries.
   */
  async remindClosingSoon(roundId: string): Promise<number | null> {
    const staged = await this.inRoundTx(async (tx) => {
      const locked = await this.lockRoundForUpdate(tx, roundId);
      if (!locked) {
        return null;
      }
      if (locked.status !== RoundStatus.OPEN) {
        return [];
      }
      return this.roundNotifications.stageForParticipants(
        tx,
        roundId,
        NotificationType.ROUND_CLOSING_SOON,
      );
    });
    if (staged === null) {
      return null;
    }
    await this.roundNotifications.dispatch(staged);
    return staged.length;
  }

  /** DELIVERED → RATED, strictly guarded: an illegal move throws 409 as usual. */
  async markRated(roundId: string, viewerResidentId = ''): Promise<RoundDto> {
    return this.inRoundTx((tx) =>
      this.transition(tx, roundId, RoundStatus.RATED, viewerResidentId),
    );
  }

  /**
   * DELIVERED → RATED, but a NO-OP when the round has already moved (FEAT-007).
   *
   * This is what the rating path uses. The status the rating service read was taken
   * without the row lock, so two participants rating the same DELIVERED round at the
   * same moment both believe they are the first; under {@link markRated} the loser
   * would get a 409 INVALID_ROUND_TRANSITION for a rating that was in fact saved.
   * That is the DESIGNED traffic pattern — the FEAT-006 delivered SMS asks every
   * participant to rate at the same instant — so the decision is re-made here, under
   * the lock, and a round that is no longer DELIVERED simply returns null.
   */
  async markRatedIfDelivered(roundId: string, viewerResidentId = ''): Promise<RoundDto | null> {
    return this.inRoundTx(async (tx) => {
      const locked = await this.lockRoundForUpdate(tx, roundId);
      if (!locked || locked.status !== RoundStatus.DELIVERED) {
        // Missing, or someone else already flipped it (or it moved on) — nothing to do.
        return null;
      }
      return this.transition(tx, roundId, RoundStatus.RATED, viewerResidentId);
    });
  }

  /**
   * Set or clear one participant's manual payment flag (FEAT-005, ADR-0012). Not a
   * status transition, but it runs under the round row lock so it serializes with
   * assign / cancel. Order: round exists (404); the participant belongs to THIS round
   * (404); the round is ASSIGNED / DELIVERED / RATED (else 409 PAYMENT_NOT_ALLOWED).
   * `collected: true` keeps an existing timestamp (idempotent); `false` clears it.
   */
  async setPaymentCollected(
    roundId: string,
    participantId: string,
    collected: boolean,
  ): Promise<AdminRoundParticipantDto> {
    return this.inRoundTx(async (tx) => {
      const locked = await this.lockRoundForUpdate(tx, roundId);
      if (!locked) {
        throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Round not found.' });
      }
      const participant = await tx.roundParticipant.findFirst({
        where: { id: participantId, roundId },
      });
      if (!participant) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Participant not found in this round.',
        });
      }
      if (!PAYMENT_STATUSES.includes(locked.status)) {
        throw new ConflictException({
          code: ErrorCode.PAYMENT_NOT_ALLOWED,
          message: `Payments cannot be recorded for a ${locked.status} round.`,
        });
      }

      const paymentCollectedAt = collected ? (participant.paymentCollectedAt ?? new Date()) : null;
      const updated = await tx.roundParticipant.update({
        where: { id: participantId },
        data: { paymentCollectedAt },
        include: { resident: true, round: { select: { finalPrice: true } } },
      });
      // Load this resident's rating too (FEAT-007): without it the response would
      // always claim `rating: null`, so a client that merged it rather than
      // refetching would show a rating vanishing when a payment is toggled.
      const rating = await tx.rating.findUnique({
        where: { roundId_residentId: { roundId, residentId: updated.residentId } },
      });
      return buildAdminParticipant(updated, updated.round.finalPrice, rating);
    });
  }

  /**
   * The SINGLE guarded status write (ARCHITECTURE invariant). Takes the exclusive
   * round row lock (so it can never interleave with a join or another transition),
   * reads the current status, validates the move against the legal-transition map,
   * and applies it. Illegal move → 409 INVALID_ROUND_TRANSITION; unknown id → 404.
   * Must run inside a `prisma.$transaction` (callers pass the tx client).
   *
   * `prepareData` (FEAT-005) runs AFTER the lock + legality check and BEFORE the
   * write; it may validate (and throw, aborting with nothing written) and returns
   * extra columns (vendor, price, timestamps) written in the SAME single update as
   * the status, so status and its data can never diverge.
   */
  private async transition(
    tx: Tx,
    roundId: string,
    to: RoundStatus,
    viewerResidentId: string,
    prepareData?: () => Promise<TransitionData>,
  ): Promise<RoundDto> {
    const locked = await this.lockRoundForUpdate(tx, roundId);
    if (!locked) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Round not found.' });
    }
    if (!isLegalTransition(locked.status, to)) {
      throw new ConflictException({
        code: ErrorCode.INVALID_ROUND_TRANSITION,
        message: `A round cannot move from ${locked.status} to ${to}.`,
      });
    }
    const extra = prepareData ? await prepareData() : {};
    const updated = await tx.round.update({
      where: { id: roundId },
      data: { ...extra, status: to },
      include: this.viewInclude(viewerResidentId),
    });
    return buildRoundDto(updated as RoundWithView);
  }

  /**
   * Take an EXCLUSIVE row lock on the round (`SELECT ... FOR UPDATE`) so all
   * mutations on it serialize, then assert it is OPEN. Scoped to the caller's
   * society: cross-society or missing → 404 (tenant isolation, ADR-0003); not
   * OPEN → 409 ROUND_CLOSED. Must be the FIRST statement in the mutating tx, so
   * the participant read + delta are computed while the lock is held.
   */
  private async lockOpenRoundForWrite(tx: Tx, roundId: string, societyId: string): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status" FROM "Round"
      WHERE "id" = ${roundId} AND "societyId" = ${societyId}
      FOR UPDATE`;
    const round = rows[0];
    if (!round) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Round not found.' });
    }
    if (round.status !== 'OPEN') {
      throw new ConflictException({
        code: ErrorCode.ROUND_CLOSED,
        message: 'This round is no longer open.',
      });
    }
  }

  /**
   * Take an exclusive row lock on the round by id (no society scope) and return
   * its current status + authoritative unit count, or null if it does not exist.
   * The basis for every status transition, so the read is never stale.
   */
  private async lockRoundForUpdate(
    tx: Tx,
    roundId: string,
  ): Promise<{ status: RoundStatus; unitsCount: number } | null> {
    const rows = await tx.$queryRaw<Array<{ status: RoundStatus; unitsCount: number }>>`
      SELECT "status", "unitsCount" FROM "Round" WHERE "id" = ${roundId} FOR UPDATE`;
    return rows[0] ?? null;
  }

  /** Load + shape a round's view by id inside a tx (for idempotent no-op returns). */
  private async buildRoundById(
    tx: Tx,
    roundId: string,
    viewerResidentId: string,
  ): Promise<RoundDto> {
    const round = await tx.round.findUniqueOrThrow({
      where: { id: roundId },
      include: this.viewInclude(viewerResidentId),
    });
    return buildRoundDto(round as RoundWithView);
  }

  /**
   * Apply the relative unit delta to `unitsCount` and return the shaped view.
   * The `status: 'OPEN'` guard is the ADR-0004 canonical safety net: combined
   * with the row lock held since the start of the tx, the increment can only
   * ever touch a still-open round.
   */
  private async applyDeltaAndBuild(
    tx: Tx,
    roundId: string,
    residentId: string,
    delta: number,
  ): Promise<RoundDto> {
    const updated = await tx.round.update({
      where: { id: roundId, status: 'OPEN' },
      data: { unitsCount: { increment: delta } },
      include: this.viewInclude(residentId),
    });
    return buildRoundDto(updated as RoundWithView);
  }
}

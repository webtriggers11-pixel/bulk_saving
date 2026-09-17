import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RoundDto } from '@bulk/shared';
import { RoundStatus } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { buildRoundDto, type RoundWithView } from './rounds.mapper';
import { isLegalTransition } from './rounds.transitions';

/**
 * Prisma transaction client — the subset of PrismaService available inside
 * `$transaction`. Used so the concurrency-critical join/update/leave logic runs
 * entirely within one atomic transaction.
 */
type Tx = Prisma.TransactionClient;

/**
 * The rounds domain heart: resident reads + the concurrency-critical join /
 * update / leave path, plus the guarded lifecycle {@link transition} (close /
 * cancel / and the future assign→deliver→rate moves). This is the ONLY place
 * round `status` and the authoritative `unitsCount` are mutated (ARCHITECTURE.md:
 * "No status field is mutated anywhere else"); every transition is validated
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
  constructor(private readonly prisma: PrismaService) {}

  /** The include needed to shape a {@link RoundDto} for a specific caller. */
  private viewInclude(residentId: string): Prisma.RoundInclude {
    return {
      service: true,
      tiers: { orderBy: { threshold: 'asc' } },
      participants: { where: { residentId } },
    };
  }

  /** OPEN rounds in the caller's society, each shaped with pricing + the caller's pledge. */
  async listForSociety(societyId: string, residentId: string): Promise<RoundDto[]> {
    const rounds = await this.prisma.round.findMany({
      where: { societyId, status: 'OPEN' },
      include: this.viewInclude(residentId),
      orderBy: { createdAt: 'desc' },
    });
    return (rounds as RoundWithView[]).map(buildRoundDto);
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
    return this.prisma.$transaction(async (tx) => {
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

      return this.applyDeltaAndBuild(tx, roundId, residentId, delta);
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
    return this.prisma.$transaction(async (tx) => {
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
    return this.prisma.$transaction(async (tx) => {
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
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lockRoundForUpdate(tx, roundId);
      if (!locked) {
        return null;
      }
      if (locked.status !== RoundStatus.OPEN) {
        // Idempotent no-op: already closed/cancelled — return the current view.
        return this.buildRoundById(tx, roundId, viewerResidentId);
      }

      const lowest = await tx.roundTier.findFirst({
        where: { roundId },
        orderBy: { threshold: 'asc' },
        select: { threshold: true },
      });
      const met = lowest !== null && locked.unitsCount >= lowest.threshold;
      const to = met ? RoundStatus.CLOSED_MET : RoundStatus.CLOSED_EXPIRED;
      return this.transition(tx, roundId, to, viewerResidentId);
    });
  }

  /**
   * Cancel a round (SUPER_ADMIN). Guarded: legal only from a pre-DELIVERED state
   * (OPEN / CLOSED_MET / CLOSED_EXPIRED / ASSIGNED); from DELIVERED / RATED /
   * CANCELLED → 409 INVALID_ROUND_TRANSITION. Unknown id → 404.
   */
  async cancel(roundId: string, viewerResidentId = ''): Promise<RoundDto> {
    return this.prisma.$transaction((tx) =>
      this.transition(tx, roundId, RoundStatus.CANCELLED, viewerResidentId),
    );
  }

  /**
   * CLOSED_MET → ASSIGNED (vendor assigned). Guarded like every transition. The
   * endpoint + vendor/price data are wired in FEAT-005; the move lives here now.
   */
  async markAssigned(roundId: string, viewerResidentId = ''): Promise<RoundDto> {
    return this.prisma.$transaction((tx) =>
      this.transition(tx, roundId, RoundStatus.ASSIGNED, viewerResidentId),
    );
  }

  /** ASSIGNED → DELIVERED (service performed). Endpoint wired in FEAT-005. */
  async markDelivered(roundId: string, viewerResidentId = ''): Promise<RoundDto> {
    return this.prisma.$transaction((tx) =>
      this.transition(tx, roundId, RoundStatus.DELIVERED, viewerResidentId),
    );
  }

  /** DELIVERED → RATED (residents rated the service). Endpoint wired in FEAT-007. */
  async markRated(roundId: string, viewerResidentId = ''): Promise<RoundDto> {
    return this.prisma.$transaction((tx) =>
      this.transition(tx, roundId, RoundStatus.RATED, viewerResidentId),
    );
  }

  /**
   * The SINGLE guarded status write (ARCHITECTURE invariant). Takes the exclusive
   * round row lock (so it can never interleave with a join or another transition),
   * reads the current status, validates the move against the legal-transition map,
   * and applies it. Illegal move → 409 INVALID_ROUND_TRANSITION; unknown id → 404.
   * Must run inside a `prisma.$transaction` (callers pass the tx client).
   */
  private async transition(
    tx: Tx,
    roundId: string,
    to: RoundStatus,
    viewerResidentId: string,
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
    const updated = await tx.round.update({
      where: { id: roundId },
      data: { status: to },
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

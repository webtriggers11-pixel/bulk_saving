import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RoundDto } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { buildRoundDto, type RoundWithView } from './rounds.mapper';

/**
 * Prisma transaction client — the subset of PrismaService available inside
 * `$transaction`. Used so the concurrency-critical join/update/leave logic runs
 * entirely within one atomic transaction.
 */
type Tx = Prisma.TransactionClient;

/**
 * The rounds domain heart: resident reads + the concurrency-critical join /
 * update / leave path, plus the OPEN→CLOSED transition. This is the ONLY place
 * round `status` and the authoritative `unitsCount` are mutated (ARCHITECTURE.md:
 * "No status field is mutated anywhere else").
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
   * Transition a round OPEN→CLOSED (interim manual close; FEAT-004 adds the full
   * lifecycle + deadline-driven closing). Unknown id → 404. This is the only
   * status mutation in the app.
   */
  async close(roundId: string, viewerResidentId: string): Promise<RoundDto> {
    return this.prisma.$transaction(async (tx) => {
      // Same exclusive row lock as the join path, so a close can never interleave
      // with an in-flight join: whichever takes the lock first runs to completion.
      const locked = await this.lockRoundRow(tx, roundId);
      if (!locked) {
        throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Round not found.' });
      }
      const updated = await tx.round.update({
        where: { id: roundId },
        data: { status: 'CLOSED' },
        include: this.viewInclude(viewerResidentId),
      });
      return buildRoundDto(updated as RoundWithView);
    });
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

  /** Take an exclusive row lock on the round by id (no society scope). */
  private async lockRoundRow(tx: Tx, roundId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Round" WHERE "id" = ${roundId} FOR UPDATE`;
    return rows.length > 0;
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

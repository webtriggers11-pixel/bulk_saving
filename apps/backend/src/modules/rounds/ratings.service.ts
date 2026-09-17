import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoundStatus, type RateRoundBody, type RatingDto, type RatingSummary } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { toRatingDto } from './ratings.mapper';
import { RoundsService } from './rounds.service';

/** Statuses in which a resident may rate: the job has actually been done. */
const RATEABLE: readonly RoundStatus[] = [RoundStatus.DELIVERED, RoundStatus.RATED];

/**
 * Post-service ratings (FEAT-007, ADR-0017).
 *
 * A rating hangs off the ROUND, one per participant, so it is always attributable
 * to the job that was done and — through `round.vendorId` (ADR-0012) — to the
 * vendor who did it. The FIRST rating moves the round DELIVERED → RATED, and it
 * does so through {@link RoundsService.markRatedIfDelivered}: this service never
 * writes `status` itself, because `RoundsService.transition()` is the only path
 * allowed to (ARCHITECTURE.md, ADR-0011).
 */
@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rounds: RoundsService,
  ) {}

  /**
   * Create or replace the caller's rating of a round.
   *
   * Order of checks, all before any write: the round exists in the CALLER'S society
   * (else 404 — tenant isolation, ADR-0003); the caller actually joined it (else 403
   * NOT_A_PARTICIPANT — the round is legitimately visible to their society, so 404
   * would be a lie); the round has been delivered (else 409 ROUND_NOT_DELIVERED).
   * A rejected rating therefore writes nothing.
   */
  async rate(
    roundId: string,
    societyId: string,
    residentId: string,
    body: RateRoundBody,
  ): Promise<RatingDto> {
    const round = await this.loadRateableRound(roundId, societyId, residentId);
    const comment = body.comment?.trim();

    const rating = await this.prisma.rating.upsert({
      where: { roundId_residentId: { roundId, residentId } },
      create: {
        roundId,
        residentId,
        stars: body.stars,
        comment: comment && comment.length > 0 ? comment : null,
      },
      update: {
        stars: body.stars,
        comment: comment && comment.length > 0 ? comment : null,
      },
    });

    // First rating on a DELIVERED round closes the lifecycle. The status read above
    // was unlocked, so `markRatedIfDelivered` re-decides under the row lock and
    // no-ops if another participant won the race — their rating and ours are both
    // saved, and neither resident sees a spurious 409 (V2 P1-1, reproduced live).
    if (round.status === RoundStatus.DELIVERED) {
      await this.rounds.markRatedIfDelivered(roundId, residentId);
    }
    return toRatingDto(rating);
  }

  /**
   * Remove the caller's own rating. The round stays RATED — status does not roll
   * backwards (ADR-0017), so the lifecycle remains monotonic. 404 if there is
   * nothing to remove.
   */
  async remove(roundId: string, societyId: string, residentId: string): Promise<void> {
    await this.loadRateableRound(roundId, societyId, residentId);
    const existing = await this.prisma.rating.findUnique({
      where: { roundId_residentId: { roundId, residentId } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'You have not rated this round.',
      });
    }
    await this.prisma.rating.delete({ where: { id: existing.id } });
  }

  /** Platform-wide aggregate — the BRIEF's success metric. */
  async platformSummary(): Promise<RatingSummary> {
    const [agg, count] = await Promise.all([
      this.prisma.rating.aggregate({ _avg: { stars: true } }),
      this.prisma.rating.count(),
    ]);
    const average = agg._avg.stars;
    return {
      average: average === null ? null : Math.round(average * 10) / 10,
      count,
    };
  }

  /**
   * Shared guard for both write paths: the round must be in the caller's society,
   * the caller must be a participant, and the job must have been delivered.
   */
  private async loadRateableRound(
    roundId: string,
    societyId: string,
    residentId: string,
  ): Promise<{ status: RoundStatus }> {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, societyId },
      select: {
        status: true,
        participants: { where: { residentId }, select: { id: true } },
      },
    });
    if (!round) {
      // Missing, or in another society — indistinguishable on purpose (ADR-0003).
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Round not found.' });
    }
    if (round.participants.length === 0) {
      throw new ForbiddenException({
        code: ErrorCode.NOT_A_PARTICIPANT,
        message: 'Only residents who joined this round can rate it.',
      });
    }
    if (!RATEABLE.includes(round.status as RoundStatus)) {
      throw new ConflictException({
        code: ErrorCode.ROUND_NOT_DELIVERED,
        message: 'This round has not been delivered yet.',
      });
    }
    return { status: round.status as RoundStatus };
  }
}

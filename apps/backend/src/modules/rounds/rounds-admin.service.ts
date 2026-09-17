import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateRoundBody, RoundDto } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { RoundClosingScheduler } from './round-closing.scheduler';
import { buildRoundDto, type RoundWithView } from './rounds.mapper';
import { RoundsService } from './rounds.service';

/**
 * Super-admin round management (FEAT-003 + FEAT-004, ADR-0010/0011): open a round
 * for a (society, service) with preset tiers, close it, and cancel it. All
 * resident-facing reads and the join path live in {@link RoundsService}; status
 * mutations (close/cancel) are delegated there so the state machine stays in one
 * place. Opening a round schedules its deadline close job; closing/cancelling
 * removes that pending job (best-effort — the close itself is idempotent).
 */
@Injectable()
export class RoundsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rounds: RoundsService,
    private readonly scheduler: RoundClosingScheduler,
  ) {}

  /**
   * Open a round. Validates: the service is offered + enabled (and active) in the
   * society (else 400); tiers are non-empty with strictly ascending thresholds
   * and positive prices (else 400); the deadline is in the future (else 400); no
   * OPEN round already exists for the pair (else 409 ROUND_ALREADY_OPEN). Round +
   * tiers are created atomically.
   */
  async createRound(body: CreateRoundBody, viewerResidentId: string): Promise<RoundDto> {
    const { societyId, serviceId, tiers } = body;

    this.assertTiersValid(tiers);
    this.assertDeadlineFuture(body.deadline);
    await this.assertServiceOffered(societyId, serviceId);
    await this.assertNoOpenRound(societyId, serviceId);

    try {
      const created = await this.prisma.round.create({
        data: {
          societyId,
          serviceId,
          deadline: new Date(body.deadline),
          tiers: {
            create: tiers.map((t) => ({ threshold: t.threshold, price: t.price })),
          },
        },
        include: {
          service: true,
          tiers: { orderBy: { threshold: 'asc' } },
          participants: { where: { residentId: viewerResidentId } },
        },
      });
      // Schedule the deadline-driven close (jobId = round id, delay = deadline − now).
      await this.scheduler.schedule(created.id, created.deadline);
      return buildRoundDto(created as RoundWithView);
    } catch (err) {
      // Partial unique index race: a concurrent open won → surface 409, never 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.roundAlreadyOpen();
      }
      throw err;
    }
  }

  /**
   * Close a round (delegates the guarded transition to the state-machine owner),
   * then remove its now-redundant scheduled close job.
   */
  async close(roundId: string, viewerResidentId: string): Promise<RoundDto> {
    const dto = await this.rounds.close(roundId, viewerResidentId);
    await this.scheduler.cancel(roundId);
    return dto;
  }

  /**
   * Cancel a round (SUPER_ADMIN): guarded transition to CANCELLED, then remove its
   * scheduled close job. Unknown id → 404; illegal from a terminal state → 409.
   */
  async cancel(roundId: string, viewerResidentId: string): Promise<RoundDto> {
    const dto = await this.rounds.cancel(roundId, viewerResidentId);
    await this.scheduler.cancel(roundId);
    return dto;
  }

  /** Tiers must be non-empty with positive prices and STRICTLY ascending thresholds. */
  private assertTiersValid(tiers: CreateRoundBody['tiers']): void {
    if (tiers.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'At least one price tier is required.',
      });
    }
    for (let i = 0; i < tiers.length; i += 1) {
      if (tiers[i].price <= 0) {
        throw new BadRequestException({
          code: ErrorCode.BAD_REQUEST,
          message: 'Tier prices must be positive.',
        });
      }
      if (i > 0 && tiers[i].threshold <= tiers[i - 1].threshold) {
        throw new BadRequestException({
          code: ErrorCode.BAD_REQUEST,
          message: 'Tier thresholds must be strictly ascending.',
        });
      }
    }
  }

  /** The deadline must be a future instant. */
  private assertDeadlineFuture(deadline: string): void {
    if (new Date(deadline).getTime() <= Date.now()) {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'Deadline must be in the future.',
      });
    }
  }

  /** The service must be offered + enabled for the society, and the service active. */
  private async assertServiceOffered(societyId: string, serviceId: string): Promise<void> {
    const offering = await this.prisma.serviceOffering.findUnique({
      where: { societyId_serviceId: { societyId, serviceId } },
      include: { service: true },
    });
    if (!offering || !offering.enabled || !offering.service.active) {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'Service is not offered/enabled in this society.',
      });
    }
  }

  /** At most one OPEN round per (society, service). */
  private async assertNoOpenRound(societyId: string, serviceId: string): Promise<void> {
    const open = await this.prisma.round.findFirst({
      where: { societyId, serviceId, status: 'OPEN' },
      select: { id: true },
    });
    if (open) {
      throw this.roundAlreadyOpen();
    }
  }

  private roundAlreadyOpen(): ConflictException {
    return new ConflictException({
      code: ErrorCode.ROUND_ALREADY_OPEN,
      message: 'An open round already exists for this service in this society.',
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminDashboardDto,
  AdminRoundDetailDto,
  AdminRoundParticipantDto,
  AdminRoundSummaryDto,
  AdminRoundsQuery,
  AdminSocietyDemand,
  CreateRoundBody,
  RoundDto,
} from '@bulk/shared';
import { RoundStatus } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { RoundClosingScheduler } from './round-closing.scheduler';
import { RoundReminderScheduler } from './round-reminder.scheduler';
import {
  adminRoundDetailInclude,
  adminRoundSummaryInclude,
  buildAdminRoundDetail,
  buildAdminRoundSummary,
  computePaymentSummary,
} from './rounds-admin.mapper';
import { buildRoundDto, type RoundWithView } from './rounds.mapper';
import { ROUND_TX_OPTIONS, RoundsService } from './rounds.service';

/**
 * Super-admin round management (FEAT-003 + FEAT-004, ADR-0010/0011): open a round
 * for a (society, service) with preset tiers, close it, and cancel it. All
 * resident-facing reads and the join path live in {@link RoundsService}; status
 * mutations (close/cancel) are delegated there so the state machine stays in one
 * place. Opening a round schedules its deadline close job; closing/cancelling
 * removes that pending job (best-effort — the close itself is idempotent).
 *
 * FEAT-005 (ADR-0012) adds the cross-society admin read models (round summaries,
 * round detail with participants, dashboard aggregates) and the assign / deliver /
 * payment actions, which again delegate every write to {@link RoundsService}.
 */
/** v1 cap on the admin rounds list (no pagination yet, FEAT-005 spec). */
export const ADMIN_ROUNDS_LIMIT = 200;

/** Statuses whose rounds carry a final price and therefore owe payments (ADR-0012). */
const PAYABLE_STATUSES: RoundStatus[] = [
  RoundStatus.ASSIGNED,
  RoundStatus.DELIVERED,
  RoundStatus.RATED,
];

@Injectable()
export class RoundsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rounds: RoundsService,
    private readonly scheduler: RoundClosingScheduler,
    private readonly reminders: RoundReminderScheduler,
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
      // ROUND_TX_OPTIONS (V2 P2-4): this transaction now makes TWO sets of Redis
      // round-trips (close job + reminder job), and Prisma's default 5s budget
      // covers all of it — a slow Redis would otherwise abort a valid create.
      // Create + enqueue are coupled: the deadline job is added INSIDE the
      // transaction, so an enqueue failure (Redis down) rolls the round back
      // instead of leaving an OPEN round that never auto-closes. If the enqueue
      // succeeds but the commit then fails, the orphan job finds no round and
      // closeRound no-ops. The boot-time reconciler is the final safety net.
      const created = await this.prisma.$transaction(async (tx) => {
        const round = await tx.round.create({
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
        await this.scheduler.schedule(round.id, round.deadline);
        // …and the FEAT-006 "closing soon" nudge 24h earlier. Scheduled in the
        // same transaction for the same reason: Redis is already required here,
        // so a queue failure should roll the round back rather than open a round
        // whose queued follow-ups silently went missing. A round whose whole
        // window is shorter than the 24h lead simply gets no reminder.
        await this.reminders.schedule(round.id, round.deadline);
        return round;
      }, ROUND_TX_OPTIONS);
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
    await this.reminders.cancel(roundId);
    return dto;
  }

  /**
   * Cancel a round (SUPER_ADMIN): guarded transition to CANCELLED, then remove its
   * scheduled close job. Unknown id → 404; illegal from a terminal state → 409.
   */
  async cancel(roundId: string, viewerResidentId: string): Promise<RoundDto> {
    const dto = await this.rounds.cancel(roundId, viewerResidentId);
    await this.scheduler.cancel(roundId);
    await this.reminders.cancel(roundId);
    return dto;
  }

  /**
   * Rounds across ALL societies (the explicit cross-tenant admin read), optionally
   * filtered by status and society, newest first, capped at {@link ADMIN_ROUNDS_LIMIT}.
   */
  async listRounds(query: AdminRoundsQuery): Promise<AdminRoundSummaryDto[]> {
    const rounds = await this.prisma.round.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.societyId ? { societyId: query.societyId } : {}),
      },
      include: adminRoundSummaryInclude,
      orderBy: { createdAt: 'desc' },
      take: ADMIN_ROUNDS_LIMIT,
    });
    return rounds.map(buildAdminRoundSummary);
  }

  /** One round with every participant (resident name + phone, payment state). Unknown id → 404. */
  async getRoundDetail(roundId: string): Promise<AdminRoundDetailDto> {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: adminRoundDetailInclude,
    });
    if (!round) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Round not found.' });
    }
    return buildAdminRoundDetail(round);
  }

  /**
   * Dashboard aggregates in a fixed number of queries (no per-society N+1):
   *  - `statusCounts`: one groupBy over status, zero-filled for all 7 statuses;
   *  - `demandBySociety`: every society (by name) with its OPEN round count and
   *    pledged units (one groupBy) and distinct residents joined in OPEN rounds;
   *  - `payments`: `finalPrice × units` over ASSIGNED / DELIVERED / RATED rounds,
   *    split by whether the participant's payment is collected.
   */
  async getDashboard(): Promise<AdminDashboardDto> {
    const [statusGroups, societies, openGroups, openParticipants, payableRounds] =
      await Promise.all([
        this.prisma.round.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.society.findMany({
          select: { id: true, name: true, city: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.round.groupBy({
          by: ['societyId'],
          where: { status: RoundStatus.OPEN },
          _count: { _all: true },
          _sum: { unitsCount: true },
        }),
        this.prisma.roundParticipant.findMany({
          where: { round: { status: RoundStatus.OPEN } },
          select: { residentId: true, round: { select: { societyId: true } } },
        }),
        this.prisma.round.findMany({
          where: { status: { in: PAYABLE_STATUSES } },
          select: {
            finalPrice: true,
            participants: { select: { units: true, paymentCollectedAt: true } },
          },
        }),
      ]);

    const statusCounts = Object.fromEntries(
      Object.values(RoundStatus).map((status) => [status, 0]),
    ) as Record<RoundStatus, number>;
    for (const group of statusGroups) {
      statusCounts[group.status as RoundStatus] = group._count._all;
    }

    const openBySociety = new Map(openGroups.map((g) => [g.societyId, g]));
    const residentsBySociety = new Map<string, Set<string>>();
    for (const p of openParticipants) {
      const set = residentsBySociety.get(p.round.societyId) ?? new Set<string>();
      set.add(p.residentId);
      residentsBySociety.set(p.round.societyId, set);
    }
    const demandBySociety: AdminSocietyDemand[] = societies.map((society) => {
      const open = openBySociety.get(society.id);
      return {
        society,
        openRounds: open?._count._all ?? 0,
        unitsPledged: open?._sum.unitsCount ?? 0,
        residentsJoined: residentsBySociety.get(society.id)?.size ?? 0,
      };
    });

    let collectedAmount = 0;
    let outstandingAmount = 0;
    for (const round of payableRounds) {
      const summary = computePaymentSummary(round.finalPrice, round.participants);
      collectedAmount += summary.collectedAmount;
      outstandingAmount += summary.outstandingAmount;
    }

    return { statusCounts, demandBySociety, payments: { collectedAmount, outstandingAmount } };
  }

  /**
   * Assign a CLOSED_MET round to a vendor at the negotiated per-unit price. The
   * guarded write (lock, legality, vendor checks, one update) lives in
   * {@link RoundsService.assign}; this returns the refreshed admin detail.
   */
  async assign(
    roundId: string,
    vendorId: string,
    finalPrice: number,
  ): Promise<AdminRoundDetailDto> {
    await this.rounds.assign(roundId, vendorId, finalPrice);
    return this.getRoundDetail(roundId);
  }

  /** Mark an ASSIGNED round delivered (guarded in {@link RoundsService.deliver}); returns the detail. */
  async deliver(roundId: string): Promise<AdminRoundDetailDto> {
    await this.rounds.deliver(roundId);
    return this.getRoundDetail(roundId);
  }

  /** Set or clear a participant's payment flag (guarded in {@link RoundsService.setPaymentCollected}). */
  setPayment(
    roundId: string,
    participantId: string,
    collected: boolean,
  ): Promise<AdminRoundParticipantDto> {
    return this.rounds.setPaymentCollected(roundId, participantId, collected);
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

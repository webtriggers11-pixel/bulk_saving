import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminDashboardDto,
  AdminRoundDetailDto,
  AdminRoundParticipantDto,
  AdminRoundSummaryDto,
  AdminRoundsQuery,
  AdminServiceAsk,
  AdminSocietyDemand,
  CreateRoundBody,
  RoundDto,
  Page,
  PageQuery,
  UpdateRoundBody,
} from '@bulk/shared';
import { RoundStatus } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { pageArgs, pageOf } from '../../common/pagination';
import { containsInsensitive, searchTerm } from '../../common/list-filters';
import { PrismaService } from '../../prisma/prisma.service';
import { RatingsService } from './ratings.service';
import { RoundNotificationsService } from './round-notifications.service';
import { RoundClosingScheduler } from './round-closing.scheduler';
import { RoundReminderScheduler } from './round-reminder.scheduler';
import {
  adminRoundDetailInclude,
  adminRoundSummaryInclude,
  buildAdminRoundDetail,
  buildAdminRoundSummary,
  buildAdminParticipant,
} from './rounds-admin.mapper';
import { buildRoundDto, type RoundWithView } from './rounds.mapper';
import { ROUND_TX_OPTIONS, RoundsService } from './rounds.service';
import { waitingAskGroups } from './service-asks.query';

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
/** Retired by FEAT-025 (ADR-0035): the list is paged; nothing is silently cut off any more. */

/** Statuses whose rounds carry a final price and therefore owe payments (ADR-0012). */
const PAYABLE_STATUSES: RoundStatus[] = [
  RoundStatus.ASSIGNED,
  RoundStatus.DELIVERED,
  RoundStatus.RATED,
];

@Injectable()
export class RoundsAdminService {
  private readonly logger = new Logger(RoundsAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rounds: RoundsService,
    private readonly scheduler: RoundClosingScheduler,
    private readonly reminders: RoundReminderScheduler,
    private readonly ratings: RatingsService,
    private readonly roundNotifications: RoundNotificationsService,
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
        // FEAT-022: everyone who asked for this service hears it opened — staged here,
        // so the message exists if and only if the round does (ADR-0013).
        const askNotifications = await this.roundNotifications.stageAskOpened(tx, round);
        return { round, askNotifications };
      }, ROUND_TX_OPTIONS);
      await this.roundNotifications.dispatch(created.askNotifications);
      return buildRoundDto(created.round as RoundWithView);
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
  async cancel(roundId: string, viewerResidentId: string, reason: string): Promise<RoundDto> {
    // FEAT-039 (ADR-0048 §1): a reason is required (the DTO trims and bounds it).
    const dto = await this.rounds.cancel(roundId, viewerResidentId, reason);
    await this.scheduler.cancel(roundId);
    await this.reminders.cancel(roundId);
    return dto;
  }

  /**
   * Rounds across ALL societies (the explicit cross-tenant admin read), optionally
   * filtered by status and society — and (FEAT-015) a search over service, society and
   * vendor name plus an exact service category — newest first, capped at
   * {@link ADMIN_ROUNDS_LIMIT}.
   */
  async listRounds(query: AdminRoundsQuery): Promise<Page<AdminRoundSummaryDto>> {
    const q = searchTerm(query.q);
    const where: Prisma.RoundWhereInput = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.societyId ? { societyId: query.societyId } : {}),
        ...(query.category ? { service: { category: query.category } } : {}),
        ...(q
          ? {
              OR: [
                { service: { name: containsInsensitive(q) } },
                { society: { name: containsInsensitive(q) } },
                { vendor: { name: containsInsensitive(q) } },
              ],
            }
          : {}),
    };
    // FEAT-025: one page, newest first with `id` as the tiebreaker.
    const [rounds, total] = await Promise.all([
      this.prisma.round.findMany({
        where,
        include: adminRoundSummaryInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.round.count({ where }),
    ]);
    return pageOf(rounds, query, total, buildAdminRoundSummary);
  }

  /**
   * One round's participants, joined first, a page at a time (FEAT-044, ADR-0035), each with
   * their rating if they left one. Unknown round → 404.
   */
  async listParticipants(roundId: string, query: PageQuery): Promise<Page<AdminRoundParticipantDto>> {
    const round = await this.prisma.round.findUnique({ where: { id: roundId }, select: { finalPrice: true } });
    if (!round) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Round not found.' });
    }
    const where: Prisma.RoundParticipantWhereInput = { roundId };
    const [rows, total] = await Promise.all([
      this.prisma.roundParticipant.findMany({
        where,
        include: { resident: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.roundParticipant.count({ where }),
    ]);
    const ratings = await this.prisma.rating.findMany({
      where: { roundId, residentId: { in: rows.map((r) => r.residentId) } },
    });
    const byResident = new Map(ratings.map((r) => [r.residentId, r]));
    return pageOf(rows, query, total, (p) => buildAdminParticipant(p, round.finalPrice, byResident.get(p.residentId) ?? null));
  }

  /** One round: its summary (payment counts over every participant) and rating aggregate. Unknown id → 404. */
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
    const [statusGroups, payments] = await Promise.all([
      this.prisma.round.groupBy({ by: ['status'], _count: { _all: true } }),
      this.paymentTotals(),
    ]);

    const statusCounts = Object.fromEntries(
      Object.values(RoundStatus).map((status) => [status, 0]),
    ) as Record<RoundStatus, number>;
    for (const group of statusGroups) {
      statusCounts[group.status as RoundStatus] = group._count._all;
    }

    // FEAT-007: the BRIEF's success metric ("delivered jobs average >= 4.0 / 5").
    const ratings = await this.ratings.platformSummary();
    const { asks, mostAsked, waiting } = await this.askedFor();
    return {
      statusCounts,
      asks,
      asksMostAsked: mostAsked,
      asksWaiting: waiting,
      payments,
      ratings,
    };
  }

  /**
   * FEAT-044: `finalPrice × units` over ASSIGNED / DELIVERED / RATED rounds, split by whether the
   * participant has paid, summed in Postgres. It used to load every payable participant into
   * memory. A tagged `$queryRaw` (parameterised) in a service; ADR-0005 keeps raw SQL out of
   * controllers only.
   */
  private async paymentTotals(): Promise<{ collectedAmount: number; outstandingAmount: number }> {
    const statuses = PAYABLE_STATUSES as readonly string[];
    // SUM(bigint) is numeric in Postgres → a Prisma.Decimal here (V2 P3-6).
    const [row] = await this.prisma.$queryRaw<{ collected: Prisma.Decimal | null; outstanding: Prisma.Decimal | null }[]>`
      SELECT
        SUM(CASE WHEN p."paymentCollectedAt" IS NOT NULL THEN r."finalPrice"::bigint * p."units" ELSE 0 END) AS collected,
        SUM(CASE WHEN p."paymentCollectedAt" IS NULL THEN r."finalPrice"::bigint * p."units" ELSE 0 END) AS outstanding
      FROM "RoundParticipant" p
      JOIN "Round" r ON r."id" = p."roundId"
      WHERE r."status"::text IN (${Prisma.join(statuses)}) AND r."finalPrice" IS NOT NULL`;
    return { collectedAmount: Number(row?.collected ?? 0), outstandingAmount: Number(row?.outstanding ?? 0) };
  }

  /**
   * FEAT-044: demand by society, a page at a time by society name (ADR-0035): OPEN rounds,
   * pledged units and distinct residents joined, computed for this page's societies only.
   */
  async demandBySociety(query: PageQuery): Promise<Page<AdminSocietyDemand>> {
    const [societies, total] = await Promise.all([
      this.prisma.society.findMany({
        select: { id: true, name: true, city: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.society.count(),
    ]);
    const ids = societies.map((s) => s.id);
    const [openGroups, joined] = await Promise.all([
      this.prisma.round.groupBy({
        by: ['societyId'],
        where: { status: RoundStatus.OPEN, societyId: { in: ids } },
        _count: { _all: true },
        _sum: { unitsCount: true },
      }),
      this.prisma.$queryRaw<{ societyId: string; residents: bigint }[]>`
        SELECT r."societyId" AS "societyId", COUNT(DISTINCT p."residentId") AS residents
        FROM "RoundParticipant" p
        JOIN "Round" r ON r."id" = p."roundId"
        WHERE r."status"::text = ${RoundStatus.OPEN} AND r."societyId" IN (${ids.length ? Prisma.join(ids) : Prisma.sql`NULL`})
        GROUP BY r."societyId"`,
    ]);
    const openBySociety = new Map(openGroups.map((g) => [g.societyId, g]));
    const joinedBySociety = new Map(joined.map((j) => [j.societyId, Number(j.residents)]));
    return pageOf(societies, query, total, (society) => {
      const open = openBySociety.get(society.id);
      return {
        society,
        openRounds: open?._count._all ?? 0,
        unitsPledged: open?._sum.unitsCount ?? 0,
        residentsJoined: joinedBySociety.get(society.id) ?? 0,
      };
    });
  }

  /**
   * FEAT-022 (ADR-0033): what residents are asking for, per society and service. BUG-029:
   * newest request first, with when it came in and how long the oldest ask has waited.
   * Top 20: this is a to-do list for opening rounds, not a report.
   */
  private async askedFor(): Promise<{ asks: AdminServiceAsk[]; mostAsked: AdminServiceAsk[]; waiting: number }> {
    const all = await waitingAskGroups(this.prisma);
    const newest = all.slice(0, 20);
    // FEAT-037 V2 P2-1: "Most asked" ranks EVERY waiting pair (stable sort keeps newest-first on ties),
    // not just the 20 newest, so an old, much-asked request still tops it.
    const mostAsked = [...all].sort((x, y) => y.askCount - x.askCount).slice(0, 20);
    const groups = [...new Map([...newest, ...mostAsked].map((g) => [`${g.societyId}|${g.serviceId}`, g])).values()];
    if (groups.length === 0) return { asks: [], mostAsked: [], waiting: 0 };
    const [societies, services] = await Promise.all([
      this.prisma.society.findMany({ where: { id: { in: groups.map((g) => g.societyId) } }, select: { id: true, name: true } }),
      this.prisma.service.findMany({ where: { id: { in: groups.map((g) => g.serviceId) } }, select: { id: true, name: true, slug: true } }),
    ]);
    const societyById = new Map(societies.map((s) => [s.id, s]));
    const serviceById = new Map(services.map((s) => [s.id, s]));
    const toDto = (list: typeof groups): AdminServiceAsk[] =>
      list.flatMap((g) => {
        const society = societyById.get(g.societyId);
        const service = serviceById.get(g.serviceId);
        if (!society || !service) return [];
        return [{ society, service, askCount: g.askCount, since: g.since.toISOString(), latest: g.latest.toISOString() }];
      });
    return { asks: toDto(newest), mostAsked: toDto(mostAsked), waiting: all.length };
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

  /**
   * Reopen a CANCELLED round until `deadline` (FEAT-039, ADR-0048). The guarded transition, the
   * job scheduling and the messages live in {@link RoundsService.reopen}. Another OPEN round for
   * the same society and service → 409 ROUND_ALREADY_OPEN.
   */
  async reopen(roundId: string, deadline: string, viewerResidentId: string): Promise<AdminRoundDetailDto> {
    this.assertDeadlineFuture(deadline);
    // V2 r3 P2-1: the same "can this round exist?" checks as create — the service must still be
    // offered (enabled + active) and the society active. A reopen must not resurrect a round for a
    // service residents can no longer see.
    const round = await this.prisma.round.findUnique({ where: { id: roundId }, include: { society: { select: { active: true } } } });
    if (!round) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Round not found.' });
    if (!round.society.active) {
      throw new BadRequestException({ code: ErrorCode.BAD_REQUEST, message: 'This society is switched off. Switch it back on before reopening.' });
    }
    await this.assertServiceOffered(round.societyId, round.serviceId);
    try {
      // V2 r3 P3-1: reschedule, not schedule — a close job or reminder that survived the cancel is
      // MOVED to the new deadline (changeDelay) instead of kept at the old one.
      await this.rounds.reopen(roundId, new Date(deadline), viewerResidentId, async (at) => {
        await this.scheduler.reschedule(roundId, at);
        await this.reminders.reschedule(roundId, at);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.roundAlreadyOpen();
      }
      throw err;
    }
    return this.getRoundDetail(roundId);
  }

  /**
   * Edit an OPEN round's deadline and/or tiers (FEAT-038, ADR-0047). Validated like create; the
   * guarded write and the job moves happen in {@link RoundsService.updateOpenRound}. Returns the
   * refreshed admin detail.
   */
  async updateRound(roundId: string, body: UpdateRoundBody): Promise<AdminRoundDetailDto> {
    if (body.deadline === undefined && body.tiers === undefined) {
      throw new BadRequestException({ code: ErrorCode.BAD_REQUEST, message: 'Change the deadline or the price tiers.' });
    }
    if (body.tiers !== undefined) this.assertTiersValid(body.tiers);
    if (body.deadline !== undefined) this.assertDeadlineFuture(body.deadline);
    const deadline = body.deadline !== undefined ? new Date(body.deadline) : undefined;
    await this.rounds.updateOpenRound(roundId, {
      ...(deadline ? { deadline } : {}),
      ...(body.tiers !== undefined ? { tiers: body.tiers } : {}),
    });
    if (deadline) {
      // After commit (V2 P2-1). Run whenever a deadline was sent, so saving again retries a
      // move that failed. If it fails, the close job still re-arms itself for the real deadline.
      // V2 r2 P3-1: move to the COMMITTED deadline, not the request's, so two edits whose moves
      // finish out of order still leave the jobs at whatever the database says.
      try {
        const { deadline: committed } = await this.prisma.round.findUniqueOrThrow({ where: { id: roundId }, select: { deadline: true } });
        await this.scheduler.reschedule(roundId, committed);
        await this.reminders.reschedule(roundId, committed);
      } catch (err) {
        this.logger.error(`Round ${roundId}: saved, but moving its jobs failed: ${err instanceof Error ? err.message : String(err)}`);
        throw new ServiceUnavailableException({
          code: ErrorCode.INTERNAL_ERROR,
          message: 'The change is saved, but the automatic close time could not be moved. Save again to retry.',
        });
      }
    }
    return this.getRoundDetail(roundId);
  }

  /** Tiers: non-empty, positive prices, STRICTLY ascending thresholds and STRICTLY falling prices (BUG-030). */
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
      // BUG-030: a group buy gets CHEAPER as more units join. A tier that costs the same or more
      // than the one before it would charge everyone more for reaching it.
      if (i > 0 && tiers[i].price >= tiers[i - 1].price) {
        throw new BadRequestException({
          code: ErrorCode.BAD_REQUEST,
          message: 'Each tier\'s price must be lower than the one before it: more people, lower price.',
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

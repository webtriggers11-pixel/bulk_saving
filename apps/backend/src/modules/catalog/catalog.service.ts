import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoundStatus } from '@prisma/client';
import type { CatalogQuery, ServiceDemand, ServiceDto } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { containsInsensitive, searchTerm } from '../../common/list-filters';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resident catalog reads (FEAT-002, ADR-0009). The catalog for a society is the
 * set of its ENABLED offerings joined to ACTIVE master services. Every read is
 * scoped by `societyId` from the authenticated context (ADR-0003) — never from
 * request input — so a resident only ever sees their own society's services.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The caller's society catalog: enabled offerings ⋈ active services, in one
   * joined query (`include`, no N+1). Ordered by category then name for a
   * stable, groupable list.
   */
  async listForSociety(societyId: string, query: CatalogQuery = {}, residentId?: string): Promise<ServiceDto[]> {
    // FEAT-015 filters narrow WITHIN the society; `societyId` stays the caller's own.
    const q = searchTerm(query.q);
    const offerings = await this.prisma.serviceOffering.findMany({
      where: {
        societyId,
        enabled: true,
        service: {
          active: true,
          ...(query.category ? { category: query.category } : {}),
          ...(q
            ? { OR: [{ name: containsInsensitive(q) }, { description: containsInsensitive(q) }, { unitLabel: containsInsensitive(q) }] }
            : {}),
        },
      },
      include: { service: true },
      orderBy: [{ service: { category: 'asc' } }, { service: { name: 'asc' } }],
    });
    // FEAT-022: asks waiting in THIS society, and which of them are the caller's — two
    // grouped reads for the whole list, not one per service.
    const serviceIds = offerings.map((o) => o.serviceId);
    const [counts, mine] = await Promise.all([
      this.prisma.serviceAsk.groupBy({
        by: ['serviceId'],
        where: { societyId, serviceId: { in: serviceIds } },
        _count: { _all: true },
      }),
      residentId
        ? this.prisma.serviceAsk.findMany({ where: { residentId, serviceId: { in: serviceIds } }, select: { serviceId: true } })
        : Promise.resolve([]),
    ]);
    const askCount = new Map(counts.map((c) => [c.serviceId, c._count._all]));
    const askedByMe = new Set(mine.map((m) => m.serviceId));

    return offerings.map((offering): ServiceDto => {
      const { service } = offering;
      return {
        id: service.id,
        name: service.name,
        slug: service.slug,
        description: service.description,
        category: service.category,
        // FEAT-010 / V2 P1-C: indicativePrice is per unit, so the catalog needs the
        // word for it — otherwise "From ₹3,500" says nothing.
        unitLabel: service.unitLabel,
        unitLabelPlural: service.unitLabelPlural,
        unitDescription: service.unitDescription,
        ...(service.imageUrl !== null ? { imageUrl: service.imageUrl } : {}),
        ...(offering.indicativePrice !== null
          ? { indicativePrice: offering.indicativePrice }
          : {}),
        demand: { askCount: askCount.get(service.id) ?? 0, askedByMe: askedByMe.has(service.id) },
      };
    });
  }

  /**
   * "Ask for this service" (FEAT-022, ADR-0033). Idempotent — asking twice is one ask.
   * Refused for a service this society does not offer (404, the same answer as any
   * unknown id — ADR-0003), and while a round is already open for it: join that instead.
   */
  async ask(residentId: string, societyId: string, serviceId: string): Promise<ServiceDemand> {
    await this.assertOffered(societyId, serviceId);
    const open = await this.prisma.round.findFirst({
      where: { societyId, serviceId, status: RoundStatus.OPEN },
      select: { id: true },
    });
    if (open) {
      throw new ConflictException({
        code: ErrorCode.ROUND_ALREADY_OPEN,
        message: 'A group buy for this service is already open — join it instead.',
      });
    }
    try {
      await this.prisma.serviceAsk.create({ data: { residentId, societyId, serviceId } });
    } catch (err) {
      // Already asked: the unique (resident, service) key — idempotent, not an error.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
    return this.demand(residentId, societyId, serviceId);
  }

  /** Withdraw an ask. Idempotent; only ever the caller's own. */
  async withdraw(residentId: string, societyId: string, serviceId: string): Promise<ServiceDemand> {
    await this.assertOffered(societyId, serviceId);
    await this.prisma.serviceAsk.deleteMany({ where: { residentId, serviceId } });
    return this.demand(residentId, societyId, serviceId);
  }

  private async demand(residentId: string, societyId: string, serviceId: string): Promise<ServiceDemand> {
    const [askCount, mine] = await Promise.all([
      this.prisma.serviceAsk.count({ where: { societyId, serviceId } }),
      this.prisma.serviceAsk.count({ where: { residentId, serviceId } }),
    ]);
    return { askCount, askedByMe: mine > 0 };
  }

  private async assertOffered(societyId: string, serviceId: string): Promise<void> {
    const offering = await this.prisma.serviceOffering.findFirst({
      where: { societyId, serviceId, enabled: true, service: { active: true } },
      select: { id: true },
    });
    if (!offering) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Service not found.' });
    }
  }
}

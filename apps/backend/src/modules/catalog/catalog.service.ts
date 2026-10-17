import { Injectable } from '@nestjs/common';
import type { CatalogQuery, ServiceDto } from '@bulk/shared';
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
  async listForSociety(societyId: string, query: CatalogQuery = {}): Promise<ServiceDto[]> {
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
      };
    });
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminServiceDto,
  CreateServiceBody,
  ServiceOfferingDto,
  UpdateServiceBody,
  UpsertOfferingBody,
} from '@bulk/shared';
import type { Service, ServiceOffering } from '@prisma/client';
import { ErrorCode } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Super-admin catalog management (FEAT-002): master `Service` CRUD + per-society
 * `ServiceOffering` upserts. These are the ONLY writes into the catalog domain;
 * the resident-facing read lives in {@link CatalogService}.
 */
@Injectable()
export class CatalogAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a master service. A duplicate `slug` is rejected with SERVICE_SLUG_TAKEN. */
  async createService(body: CreateServiceBody): Promise<AdminServiceDto> {
    await this.assertSlugFree(body.slug);
    const service = await this.prisma.service.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        category: body.category,
        imageUrl: body.imageUrl ?? null,
        // FEAT-010: omitted labels fall back to the column defaults (unit/units),
        // i.e. exactly the pre-FEAT-010 wording — never an empty string.
        ...(body.unitLabel !== undefined ? { unitLabel: body.unitLabel } : {}),
        ...(body.unitLabelPlural !== undefined ? { unitLabelPlural: body.unitLabelPlural } : {}),
        unitDescription: body.unitDescription ?? null,
      },
    });
    return toAdminServiceDto(service);
  }

  /** All master services (super-admin view), newest first. */
  async listServices(): Promise<AdminServiceDto[]> {
    const services = await this.prisma.service.findMany({ orderBy: { createdAt: 'desc' } });
    return services.map(toAdminServiceDto);
  }

  /**
   * Update a master service / toggle `active`. A missing id is NOT_FOUND; a slug
   * that collides with a different service is SERVICE_SLUG_TAKEN.
   */
  async updateService(id: string, body: UpdateServiceBody): Promise<AdminServiceDto> {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Service not found.' });
    }
    if (body.slug !== undefined && body.slug !== existing.slug) {
      await this.assertSlugFree(body.slug);
    }
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.unitLabel !== undefined ? { unitLabel: body.unitLabel } : {}),
        ...(body.unitLabelPlural !== undefined ? { unitLabelPlural: body.unitLabelPlural } : {}),
        ...(body.unitDescription !== undefined ? { unitDescription: body.unitDescription } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
    return toAdminServiceDto(service);
  }

  /**
   * Enable/disable a service for a society (+ optional indicative price), keyed
   * by the unique `(societyId, serviceId)` pair. Both the society and the service
   * must exist (NOT_FOUND otherwise) before the offering row is upserted.
   */
  async upsertOffering(
    societyId: string,
    serviceId: string,
    body: UpsertOfferingBody,
  ): Promise<ServiceOfferingDto> {
    const [society, service] = await Promise.all([
      this.prisma.society.findUnique({ where: { id: societyId } }),
      this.prisma.service.findUnique({ where: { id: serviceId } }),
    ]);
    if (!society) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Society not found.' });
    }
    if (!service) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Service not found.' });
    }

    const indicativePrice = body.indicativePrice ?? null;
    const offering = await this.prisma.serviceOffering.upsert({
      where: { societyId_serviceId: { societyId, serviceId } },
      create: { societyId, serviceId, enabled: body.enabled, indicativePrice },
      update: { enabled: body.enabled, indicativePrice },
    });
    return toOfferingDto(offering);
  }

  private async assertSlugFree(slug: string): Promise<void> {
    const clash = await this.prisma.service.findUnique({ where: { slug } });
    if (clash) {
      throw new ConflictException({
        code: ErrorCode.SERVICE_SLUG_TAKEN,
        message: `A service with slug "${slug}" already exists.`,
      });
    }
  }
}

/** Map a Prisma Service to the full super-admin DTO. */
function toAdminServiceDto(service: Service): AdminServiceDto {
  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    category: service.category,
    imageUrl: service.imageUrl,
    unitLabel: service.unitLabel,
    unitLabelPlural: service.unitLabelPlural,
    unitDescription: service.unitDescription,
    active: service.active,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

/** Map a Prisma ServiceOffering to its super-admin DTO. */
function toOfferingDto(offering: ServiceOffering): ServiceOfferingDto {
  return {
    id: offering.id,
    societyId: offering.societyId,
    serviceId: offering.serviceId,
    enabled: offering.enabled,
    indicativePrice: offering.indicativePrice,
  };
}

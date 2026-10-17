import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Vendor } from '@prisma/client';
import type { AdminVendorsQuery, CreateVendorBody, RatingSummary, UpdateVendorBody, VendorDto } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { activeFrom, containsInsensitive, searchTerm } from '../../common/list-filters';
import { PrismaService } from '../../prisma/prisma.service';
import { groupStarsByVendor, summarise } from '../rounds/ratings.mapper';

/** A Prisma client usable for vendor reads: the root client or a transaction client. */
type VendorReader = Pick<Prisma.TransactionClient, 'vendor'>;

/**
 * Global vendor list (FEAT-005, ADR-0012). Vendors are city-level (not
 * society-scoped), admin-managed and have no login. Rounds reference a vendor with
 * `onDelete: Restrict`, so there is no delete: the admin deactivates instead.
 */
@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every vendor: active first, then by name, each with its rating aggregate
   * (FEAT-007, ADR-0017). The average is computed by joining through the vendor's
   * rounds rather than read from a denormalised column, so it can never drift; the
   * count ships with it, because an average of 5.0 from one rating is not the same
   * claim as 5.0 from fifty.
   */
  async list(query: AdminVendorsQuery = {}): Promise<VendorDto[]> {
    // FEAT-015 filters (ADR-0026). Category is matched case-insensitively and exactly:
    // vendor categories are free text (not the closed service list), so "home care"
    // and "Home Care" are the same trade here.
    const q = searchTerm(query.q);
    const active = activeFrom(query.status);
    const where: Prisma.VendorWhereInput = {
      ...(q ? { OR: [{ name: containsInsensitive(q) }, { phone: { contains: q } }, { notes: containsInsensitive(q) }] } : {}),
      ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
      ...(active !== undefined ? { active } : {}),
    };
    const [vendors, grouped] = await Promise.all([
      this.prisma.vendor.findMany({ where, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
      this.prisma.rating.findMany({
        where: { round: { vendorId: { not: null } } },
        select: { stars: true, round: { select: { vendorId: true } } },
      }),
    ]);
    const starsByVendor = groupStarsByVendor(grouped);
    return vendors.map((vendor) => toVendorDto(vendor, summarise(starsByVendor.get(vendor.id) ?? [])));
  }

  /** Add a vendor (active by default). */
  async create(body: CreateVendorBody): Promise<VendorDto> {
    const vendor = await this.prisma.vendor.create({
      data: {
        name: body.name,
        phone: body.phone,
        category: body.category ?? null,
        notes: body.notes ?? null,
      },
    });
    return toVendorDto(vendor);
  }

  /** Partially update a vendor / toggle `active`; null clears category or notes. Unknown id → 404. */
  async update(id: string, body: UpdateVendorBody): Promise<VendorDto> {
    await this.getById(id);
    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
    return toVendorDto(vendor);
  }

  /**
   * Load a vendor or throw 404 NOT_FOUND. Accepts a transaction client so the rounds
   * state machine can validate the vendor inside its row-locked assign transaction.
   */
  async getById(id: string, client: VendorReader = this.prisma): Promise<Vendor> {
    const vendor = await client.vendor.findUnique({ where: { id } });
    if (!vendor) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Vendor not found.' });
    }
    return vendor;
  }
}

/** Map a Prisma Vendor to its super-admin DTO. */
export function toVendorDto(
  vendor: Vendor,
  ratings: RatingSummary = { average: null, count: 0 },
): VendorDto {
  return {
    id: vendor.id,
    name: vendor.name,
    phone: vendor.phone,
    category: vendor.category,
    notes: vendor.notes,
    active: vendor.active,
    createdAt: vendor.createdAt.toISOString(),
    updatedAt: vendor.updatedAt.toISOString(),
    // FEAT-007. A freshly created or just-updated vendor is shaped with the empty
    // default; only the list read joins the aggregate, which is where it is shown.
    averageRating: ratings.average,
    ratingCount: ratings.count,
  };
}

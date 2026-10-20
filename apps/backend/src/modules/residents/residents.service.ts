import { Injectable } from '@nestjs/common';
import type { Resident } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resident data access. Every tenant-scoped read is filtered by `societyId`
 * (ADR-0003) — a resident id alone never crosses a society boundary.
 */
@Injectable()
export class ResidentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create the resident (or link the existing one) and mark the phone verified. */
  upsertVerified(societyId: string, phone: string, name?: string): Promise<Resident> {
    const now = new Date();
    return this.prisma.resident.upsert({
      where: { societyId_phone: { societyId, phone } },
      create: { societyId, phone, name: name ?? null, verifiedAt: now },
      update: { verifiedAt: now, ...(name !== undefined ? { name } : {}) },
    });
  }

  /**
   * The WhatsApp door's upsert (FEAT-027, ADR-0038): like {@link upsertVerified}, except the
   * name is a DEFAULT — the WhatsApp profile name is used only when the row is being created,
   * and never overwrites a name the resident chose.
   */
  upsertVerifiedDefaultName(societyId: string, phone: string, defaultName: string | null): Promise<Resident> {
    const now = new Date();
    return this.prisma.resident.upsert({
      where: { societyId_phone: { societyId, phone } },
      create: { societyId, phone, name: defaultName ? defaultName.slice(0, 80) : null, verifiedAt: now },
      update: { verifiedAt: now },
    });
  }

  /**
   * Stamp `verifiedAt` on an EXISTING resident (FEAT-012).
   *
   * The admin sign-in path's counterpart to `upsertVerified` — same effect on the row,
   * minus the half that can create one. Separated rather than parameterised: "may this
   * call bring an account into existence" is the kind of thing a boolean argument hides.
   */
  async markVerified(resident: Resident): Promise<Resident> {
    const verifiedAt = new Date();
    // `updateMany`, not `update`: the row was read a round-trip ago, and if it has
    // since been deleted `update` throws P2025 — a 500 out of a sign-in that should
    // simply have refused. Zero rows updated is not an error here; the caller has
    // already made its authorisation decision on the row it holds.
    //
    // The residual cost of that race, stated rather than hidden: a session is issued
    // for a resident that no longer exists. It is bounded — `GET /me` and
    // `AuthService.refresh` both re-read the row and refuse — so it costs one
    // 15-minute access token and one orphaned `refresh:<id>:<sid>` key, which has no TTL
    // (ADR-0024, ADR-0034) and must be deleted by hand if it ever matters.
    await this.prisma.resident.updateMany({ where: { id: resident.id }, data: { verifiedAt } });
    return { ...resident, verifiedAt };
  }

  /**
   * The one SUPER_ADMIN row with this phone number, or null (FEAT-012, ADR-0023).
   *
   * Filtered on role, and unique among ADMIN rows rather than among all rows. An
   * administrator of one society who later joins another through the resident door
   * holds two rows with the same phone; treating that as ambiguous would silently
   * lock them out of the dashboard by way of using the product normally (V2). Two
   * SUPER_ADMIN rows is still ambiguous — there is no one society to sign them into,
   * and guessing is how a session lands in a tenant nobody chose.
   *
   * This is only ever consulted AFTER the OTP. It decides authorisation, never what
   * the caller is told about an unverified number.
   */
  async findAdminByPhone(phone: string): Promise<Resident | null> {
    const admins = await this.prisma.resident.findMany({
      where: { phone, role: 'SUPER_ADMIN' },
      take: 2,
    });
    return admins.length === 1 ? admins[0] : null;
  }

  /** Fetch a resident by id — for the trusted authenticated-context path only. */
  findById(id: string): Promise<Resident | null> {
    return this.prisma.resident.findUnique({ where: { id } });
  }

  /** Tenant-scoped fetch: returns the resident only if it belongs to `societyId`. */
  findInSociety(id: string, societyId: string): Promise<Resident | null> {
    return this.prisma.resident.findFirst({ where: { id, societyId } });
  }
}

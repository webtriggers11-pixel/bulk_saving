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
   * Stamp `verifiedAt` on an EXISTING resident (FEAT-012).
   *
   * The admin sign-in path's counterpart to `upsertVerified` — same effect on the row,
   * minus the half that can create one. Separated rather than parameterised: "may this
   * call bring an account into existence" is the kind of thing a boolean argument hides.
   */
  markVerified(id: string): Promise<Resident> {
    return this.prisma.resident.update({ where: { id }, data: { verifiedAt: new Date() } });
  }

  /**
   * The one resident with this phone number, or null (FEAT-012, ADR-0023).
   *
   * This is the admin sign-in path's replacement for the invite code: it is where
   * `societyId` comes from, so it must be unambiguous. `phone` is unique only WITHIN a
   * society, so the same number can hold a row in two of them — and picking whichever
   * Postgres returned first would scope an OTP, or a session, to a tenant nobody chose.
   * Two matches is therefore treated exactly like zero.
   *
   * Role is deliberately NOT part of the query: the admin path checks the role itself,
   * after the OTP, so that "this number is not an administrator" is something you are
   * only told once you have proven you control the number.
   */
  async findUniqueByPhone(phone: string): Promise<Resident | null> {
    const matches = await this.prisma.resident.findMany({ where: { phone }, take: 2 });
    return matches.length === 1 ? matches[0] : null;
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

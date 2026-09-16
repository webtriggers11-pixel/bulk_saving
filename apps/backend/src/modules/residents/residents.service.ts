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

  /** Fetch a resident by id — for the trusted authenticated-context path only. */
  findById(id: string): Promise<Resident | null> {
    return this.prisma.resident.findUnique({ where: { id } });
  }

  /** Tenant-scoped fetch: returns the resident only if it belongs to `societyId`. */
  findInSociety(id: string, societyId: string): Promise<Resident | null> {
    return this.prisma.resident.findFirst({ where: { id, societyId } });
  }
}

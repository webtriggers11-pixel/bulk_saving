import type { Resident } from '@prisma/client';
import type { Role, ResidentDto } from '@bulk/shared';

/**
 * Map a Prisma Resident to the safe client-facing DTO. Only whitelisted fields
 * cross this boundary — no internal/secret state ever leaves via this shape.
 */
export function toResidentDto(resident: Resident): ResidentDto {
  return {
    id: resident.id,
    societyId: resident.societyId,
    phone: resident.phone,
    name: resident.name,
    role: resident.role as Role,
    verifiedAt: resident.verifiedAt ? resident.verifiedAt.toISOString() : null,
    createdAt: resident.createdAt.toISOString(),
  };
}

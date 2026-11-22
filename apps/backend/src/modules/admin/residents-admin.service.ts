import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoundStatus } from '@prisma/client';
import {
  Role,
  type AdminResidentDto,
  type AdminResidentsQuery,
  type Page,
  type UpdateResidentBody,
} from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { containsInsensitive, searchTerm } from '../../common/list-filters';
import { pageArgs, pageOf } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

/** A pledge counts while its round is not cancelled: those are the rows a removal would orphan. */
const LIVE_PLEDGE = {
  round: { status: { not: RoundStatus.CANCELLED } },
} satisfies Prisma.RoundParticipantWhereInput;

export const RESIDENT_ROW = {
  society: { select: { id: true, name: true } },
  _count: { select: { roundParticipations: { where: LIVE_PLEDGE } } },
} satisfies Prisma.ResidentInclude;
type Row = Prisma.ResidentGetPayload<{ include: typeof RESIDENT_ROW }>;

/**
 * Every resident, across every society, for the super-admin (FEAT-033, ADR-0044) — the
 * second explicit cross-tenant read after the societies list. Reached only through the
 * SUPER_ADMIN-guarded admin controller.
 */
@Injectable()
export class ResidentsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(query: AdminResidentsQuery = {}): Promise<Page<AdminResidentDto>> {
    const q = searchTerm(query.q);
    // V2 P3: a term that is all spaces/dashes leaves an empty phone fragment, which would match everyone.
    const phoneTerm = q?.replace(/[\s-]/g, '') ?? '';
    const where: Prisma.ResidentWhereInput = {
      ...(q
        ? {
            OR: [
              { name: containsInsensitive(q) },
              ...(phoneTerm ? [{ phone: { contains: phoneTerm } }] : []),
            ],
          }
        : {}),
      ...(query.societyId ? { societyId: query.societyId } : {}),
      ...(query.role ? { role: query.role } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.resident.findMany({
        where,
        include: RESIDENT_ROW,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.resident.count({ where }),
    ]);
    return pageOf(rows, query, total, toResidentDto);
  }

  /**
   * Rename and/or change a role (ADR-0044 §3). An admin cannot change their own role, and
   * the last SUPER_ADMIN cannot be demoted — both would lock the admin door (ADR-0023).
   * The check and the write share a serializable transaction, so two admins demoting each
   * other at once cannot both succeed.
   */
  async update(actorId: string, id: string, body: UpdateResidentBody): Promise<AdminResidentDto> {
    return this.prisma
      .$transaction(
        async (tx) => {
          const current = await tx.resident.findUnique({ where: { id } });
          if (!current) throw notFound();
          if (body.role !== undefined && body.role !== current.role) {
            if (id === actorId)
              throw conflict('You cannot change your own role. Ask another admin.');
            if (
              current.role === Role.SUPER_ADMIN &&
              (await tx.resident.count({ where: { role: Role.SUPER_ADMIN } })) <= 1
            ) {
              throw conflict('This is the last admin. Make someone else an admin first.');
            }
          }
          const row = await tx.resident.update({
            where: { id },
            data: {
              ...(body.name !== undefined ? { name: body.name } : {}),
              ...(body.role !== undefined ? { role: body.role } : {}),
            },
            include: RESIDENT_ROW,
          });
          return toResidentDto(row);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch(raceOutcome);
  }

  /**
   * Remove a resident (ADR-0044 §5). Refused for yourself, for the last admin, and for anyone
   * with a pledge in a round that is not cancelled: the schema would cascade the pledge away
   * without RoundService adjusting the round's unit count. Their sessions end at once.
   */
  async remove(actorId: string, id: string): Promise<{ deleted: true }> {
    if (id === actorId) throw conflict('You cannot remove yourself.');
    await this.prisma
      .$transaction(
        async (tx) => {
          const current = await tx.resident.findUnique({ where: { id }, include: RESIDENT_ROW });
          if (!current) throw notFound();
          if (
            current.role === Role.SUPER_ADMIN &&
            (await tx.resident.count({ where: { role: Role.SUPER_ADMIN } })) <= 1
          ) {
            throw conflict('This is the last admin and cannot be removed.');
          }
          const pledges = current._count.roundParticipations;
          if (pledges > 0) {
            // V2 P2: any pledge outside a cancelled round blocks removal, closed and delivered ones
            // included. Deleting would cascade away that round's units, payments and rating history
            // (ADR-0044 §5). Deactivating keeps the history and still ends their access.
            throw conflict(
              `This resident has ${pledges} pledge(s) in group buys. Removing them would erase that history, so deactivate them instead.`,
            );
          }
          await tx.resident.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch(raceOutcome);
    await this.auth.revokeAllSessions(id);
    return { deleted: true };
  }
}

/**
 * V2 P2: a race answers 404/409, never a 500. A serializable abort (P2034) means another
 * admin changed the same rows mid-check; a missing row (P2025) means it was deleted between
 * the read and the write.
 */
function raceOutcome(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2034')
      throw conflict('Another admin changed this user at the same moment. Reload and try again.');
    if (err.code === 'P2025') throw notFound();
  }
  throw err;
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Resident not found.' });
}

function conflict(message: string): ConflictException {
  return new ConflictException({ code: ErrorCode.CONFLICT, message });
}

export function toResidentDto(row: Row): AdminResidentDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role as Role,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    society: { id: row.society.id, name: row.society.name },
    pledgeCount: row._count.roundParticipations,
  };
}
